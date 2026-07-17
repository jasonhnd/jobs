/**
 * data.models_by_model.json projection — per-model static data pages.
 *
 * Consumer: /models/{slug}. Carries compact distribution, top/bottom rows,
 * and drift summaries only. It intentionally excludes rationale_ja.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  computeDriftReport,
  riskBand,
  type AioisScore,
  type Band,
  type DriftReport,
} from '../../graph/aiois-drift.js';
import { ModelsByModelProjectionSchema, type ModelsByModelProjectionShape } from '../../lib/projection-schemas.js';
import { occupationPath } from '../../lib/urls.js';
import { formatModelDisplay, modelIdFromSlug, modelSlug } from '../../site/score-attribution.js';
import type { ScoreRun } from '../schema/index.js';
import type { ScoreEntry } from '../schema/score-run.js';
import type { Indexes } from '../lib/indexes.js';

const HISTOGRAM_BINS = 20;
const HISTOGRAM_WIDTH = 0.5;
const TOP_N = 10;
const DRIFT_N = 5;
const MODEL_PAGE_MAX_BYTES = 24 * 1024;

type ModelRecord = ModelsByModelProjectionShape['models'][string];
type DriftRecord = ModelRecord['drift'];
type OccupationRow = ModelRecord['highest'][number];

interface BatchSummary {
  readonly run: ScoreRun;
  readonly slug: string;
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly provider: string;
  readonly coveredCount: number;
  readonly promptVersion: string;
  readonly rows: readonly OccupationScoreRow[];
}

interface OccupationScoreRow {
  readonly id: number;
  readonly title: string;
  readonly transformation: number;
  readonly score: ScoreEntry;
}

export interface ModelsByModelBuildResult {
  files: string[];
  models: number;
  maxPageBytes: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function batchKey(run: ScoreRun): string {
  return `${run.run.run_date}::${run.scorer.model}`;
}

function transformation(score: ScoreEntry): number {
  return score.aiois?.transformation ?? score.ai_risk;
}

function occupationTitle(indexes: Indexes, id: number): string {
  return indexes.occById.get(id)?.title_ja ?? `職業 ${id}`;
}

function buildRows(indexes: Indexes, run: ScoreRun): OccupationScoreRow[] {
  return Object.entries(run.scores)
    .map(([idRaw, score]) => {
      const id = Number.parseInt(idRaw, 10);
      if (!Number.isFinite(id)) {
        throw new Error(`[models-by-model] non-int occupation id in ${batchKey(run)}: ${idRaw}`);
      }
      return {
        id,
        title: occupationTitle(indexes, id),
        transformation: transformation(score),
        score,
      };
    })
    .sort((a, b) => a.id - b.id);
}

function occupationRuns(indexes: Indexes): ScoreRun[] {
  return [...indexes.runsByModel.values()]
    .flat()
    .filter((run) => run.scope === 'occupations')
    .sort((a, b) =>
      a.run.run_date.localeCompare(b.run.run_date) ||
      a.scorer.model.localeCompare(b.scorer.model),
    );
}

function buildBatchSummaries(indexes: Indexes): BatchSummary[] {
  const runs = occupationRuns(indexes);
  const knownModelIds = runs.map((run) => run.scorer.model);

  for (const modelId of knownModelIds) {
    const slug = modelSlug(modelId);
    if (modelIdFromSlug(slug, knownModelIds) !== modelId) {
      throw new Error(`[models-by-model] model slug round-trip failed for ${modelId} (${slug})`);
    }
  }

  return runs.map((run) => ({
    run,
    slug: modelSlug(run.scorer.model),
    model: run.scorer.model,
    modelDisplay: formatModelDisplay(run.scorer.model),
    date: run.run.run_date,
    provider: run.scorer.model_provider,
    coveredCount: Object.keys(run.scores).length,
    promptVersion: run.prompt.prompt_version,
    rows: buildRows(indexes, run),
  }));
}

function bandCounts(rows: readonly OccupationScoreRow[]): ModelRecord['distribution']['bands'] {
  const counts: Record<Band, number> = { low: 0, mid: 0, high: 0 };
  for (const row of rows) counts[riskBand(row.transformation)] += 1;
  const total = rows.length;
  return {
    low: { count: counts.low, pct: total ? round1((counts.low / total) * 100) : 0 },
    mid: { count: counts.mid, pct: total ? round1((counts.mid / total) * 100) : 0 },
    high: { count: counts.high, pct: total ? round1((counts.high / total) * 100) : 0 },
  };
}

function histogram(rows: readonly OccupationScoreRow[]): ModelRecord['distribution']['histogram'] {
  const bins = Array.from({ length: HISTOGRAM_BINS }, (_, i) => ({
    from: round1(i * HISTOGRAM_WIDTH),
    to: round1((i + 1) * HISTOGRAM_WIDTH),
    count: 0,
  }));
  for (const row of rows) {
    const idx = Math.min(HISTOGRAM_BINS - 1, Math.max(0, Math.floor(row.transformation / HISTOGRAM_WIDTH)));
    bins[idx]!.count += 1;
  }
  return bins;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function distribution(rows: readonly OccupationScoreRow[]): ModelRecord['distribution'] {
  const values = rows.map((row) => row.transformation);
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  return {
    mean_transformation: round1(mean),
    median_transformation: round1(median(values)),
    bands: bandCounts(rows),
    histogram: histogram(rows),
  };
}

function toOccupationRow(row: OccupationScoreRow): OccupationRow {
  return {
    id: row.id,
    title_ja: row.title,
    href: occupationPath(row.id),
    transformation: row.transformation,
    band: riskBand(row.transformation),
  };
}

function highest(rows: readonly OccupationScoreRow[]): OccupationRow[] {
  return [...rows]
    .sort((a, b) => b.transformation - a.transformation || a.id - b.id)
    .slice(0, TOP_N)
    .map(toOccupationRow);
}

function lowest(rows: readonly OccupationScoreRow[]): OccupationRow[] {
  return [...rows]
    .sort((a, b) => a.transformation - b.transformation || a.id - b.id)
    .slice(0, TOP_N)
    .map(toOccupationRow);
}

function toAioisScoreMap(batch: BatchSummary): Map<number, AioisScore> {
  const out = new Map<number, AioisScore>();
  for (const row of batch.rows) {
    const dims = row.score.aiois
      ? [
        row.score.aiois.d1,
        row.score.aiois.d2,
        row.score.aiois.d3,
        row.score.aiois.d4,
        row.score.aiois.d5,
        row.score.aiois.d6,
        row.score.aiois.d7,
        row.score.aiois.d8,
        row.score.aiois.d9,
        row.score.aiois.d10,
      ]
      : Array.from({ length: 10 }, () => row.transformation);
    out.set(row.id, {
      aiRisk: row.transformation,
      displacement: row.score.aiois?.displacement ?? row.transformation,
      dims,
      confidence: row.score.confidence ?? null,
    });
  }
  return out;
}

function predecessorFor(batch: BatchSummary, batches: readonly BatchSummary[]): BatchSummary | null {
  const earlierDates = batches
    .filter((candidate) => candidate.date < batch.date)
    .map((candidate) => candidate.date)
    .sort();
  const date = earlierDates[earlierDates.length - 1];
  if (!date) return null;
  return batches
    .filter((candidate) => candidate.date === date)
    .sort((a, b) => a.model.localeCompare(b.model))[0] ?? null;
}

function crossingSeverity(from: Band, to: Band): number {
  const order: Record<Band, number> = { low: 0, mid: 1, high: 2 };
  return Math.abs(order[to] - order[from]);
}

function driftFor(
  batch: BatchSummary,
  batches: readonly BatchSummary[],
  titles: ReadonlyMap<number, string>,
): DriftRecord {
  const predecessor = predecessorFor(batch, batches);
  if (!predecessor) {
    return { baseline: true, note_id: 'first_batch' };
  }

  const candidateScores = toAioisScoreMap(batch);
  const predecessorScores = toAioisScoreMap(predecessor);
  const commonCount = [...candidateScores.keys()].filter((id) => predecessorScores.has(id)).length;
  const report: DriftReport = computeDriftReport(predecessorScores, candidateScores, titles, {
    rankThreshold: commonCount >= 100 ? 50 : 10,
    lowConfidence: 0.7,
  });

  return {
    predecessor: {
      model: predecessor.model,
      modelDisplay: predecessor.modelDisplay,
      date: predecessor.date,
      slug: predecessor.slug,
    },
    compared_count: report.comparedCount,
    mean_delta_t: round1(report.meanDriftT),
    movers: [...report.rows]
      .sort((a, b) => Math.abs(b.dT) - Math.abs(a.dT) || a.id - b.id)
      .slice(0, DRIFT_N)
      .map((row) => ({
        id: row.id,
        title_ja: row.title,
        href: occupationPath(row.id),
        delta_t: round1(row.dT),
        from: row.baseT,
        to: row.candT,
      })),
    band_crossings: [...report.rows]
      .filter((row) => row.baseBand !== row.candBand)
      .sort((a, b) => crossingSeverity(b.baseBand, b.candBand) - crossingSeverity(a.baseBand, a.candBand) || a.id - b.id)
      .slice(0, DRIFT_N)
      .map((row) => ({
        id: row.id,
        title_ja: row.title,
        href: occupationPath(row.id),
        from_band: row.baseBand,
        to_band: row.candBand,
      })),
  };
}

function navFor(index: number, batches: readonly BatchSummary[]): ModelRecord['nav'] {
  const prev = batches[index - 1];
  const next = batches[index + 1];
  return {
    prev: prev ? { slug: prev.slug, modelDisplay: prev.modelDisplay } : null,
    next: next ? { slug: next.slug, modelDisplay: next.modelDisplay } : null,
  };
}

export function buildModelsByModelPayload(
  indexes: Indexes,
  generatedAt = new Date().toISOString(),
): ModelsByModelProjectionShape {
  const batches = buildBatchSummaries(indexes);
  const titles = new Map([...indexes.occById.entries()].map(([id, occ]) => [id, occ.title_ja]));
  const models: ModelsByModelProjectionShape['models'] = {};

  batches.forEach((batch, index) => {
    if (batch.slug in models) {
      throw new Error(`[models-by-model] duplicate model slug: ${batch.slug}`);
    }
    models[batch.slug] = {
      slug: batch.slug,
      model: batch.model,
      modelDisplay: batch.modelDisplay,
      provider: batch.provider,
      date: batch.date,
      covered_count: batch.coveredCount,
      prompt_version: batch.promptVersion,
      distribution: distribution(batch.rows),
      highest: highest(batch.rows),
      lowest: lowest(batch.rows),
      drift: driftFor(batch, batches, titles),
      nav: navFor(index, batches),
    };
  });

  return ModelsByModelProjectionSchema.parse({ generated_at: generatedAt, models });
}

export function modelsByModelMaxPageBytes(payload: ModelsByModelProjectionShape): number {
  return Math.max(0, ...Object.values(payload.models).map((model) => Buffer.byteLength(JSON.stringify(model), 'utf-8')));
}

export async function buildModelsByModel(
  indexes: Indexes,
  distRoot: string,
): Promise<ModelsByModelBuildResult> {
  const payload = buildModelsByModelPayload(indexes);
  const maxPageBytes = modelsByModelMaxPageBytes(payload);
  if (maxPageBytes > MODEL_PAGE_MAX_BYTES) {
    throw new Error(`[models-by-model] largest per-page payload is ${maxPageBytes} bytes; max is ${MODEL_PAGE_MAX_BYTES}`);
  }

  const outPath = join(distRoot, 'data.models_by_model.json');
  await writeFile(outPath, JSON.stringify(payload) + '\n', 'utf-8');

  return {
    files: [outPath],
    models: Object.keys(payload.models).length,
    maxPageBytes,
  };
}
