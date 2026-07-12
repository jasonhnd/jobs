/**
 * Pure data model for /models. Input is score history already loaded into the
 * graph; this module only groups, aggregates, and calls the shared drift core.
 */
import { computeDriftReport, type AioisScore, type DriftReport, type DriftRow } from '@/graph/aiois-drift';
import type { KnowledgeGraph, ScoreHistoryEntry } from '@/graph';
import { formatModelDisplay } from '@/site/score-attribution';

export const AIOIS_DIM_LABELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'] as const;

type BatchKey = string;

export interface BatchSummary {
  readonly key: BatchKey;
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly coverage: number;
  readonly total: number;
  readonly aioisCoverage: number;
  readonly isCanonical: boolean;
  readonly meanTransformation: number;
  readonly meanDisplacement: number | null;
  readonly dimMeans: readonly number[] | null;
}

export interface DriftPairSummary {
  readonly key: string;
  readonly base: BatchSummary;
  readonly candidate: BatchSummary;
  readonly report: DriftReport;
}

export interface ModelsPageModel {
  readonly batches: readonly BatchSummary[];
  readonly canonical: BatchSummary;
  readonly driftPairs: readonly DriftPairSummary[];
  readonly largestDivergences: readonly DriftRow[];
  readonly latestPair: DriftPairSummary | null;
}

export interface ModelsPageInput {
  readonly historyByOcc: ReadonlyMap<number, readonly ScoreHistoryEntry[]>;
  readonly titlesByOcc: ReadonlyMap<number, string>;
  readonly totalOccupations: number;
}

function batchKey(model: string, date: string): BatchKey {
  return `${date}::${model}`;
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : 0;
}

function dimsArray(entry: ScoreHistoryEntry): readonly number[] | null {
  if (entry.dims == null) return null;
  return [
    entry.dims.d1, entry.dims.d2, entry.dims.d3, entry.dims.d4, entry.dims.d5,
    entry.dims.d6, entry.dims.d7, entry.dims.d8, entry.dims.d9, entry.dims.d10,
  ];
}

function chooseCanonical(batches: readonly Omit<BatchSummary, 'isCanonical'>[]): BatchKey {
  const sorted = [...batches].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    Number(b.aioisCoverage > 0) - Number(a.aioisCoverage > 0) ||
    b.coverage - a.coverage ||
    a.model.localeCompare(b.model),
  );
  return sorted[0]?.key ?? '';
}

function toAioisScoreMap(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistoryEntry[]>,
  key: BatchKey,
): Map<number, AioisScore> {
  const out = new Map<number, AioisScore>();
  for (const [id, history] of historyByOcc) {
    const entry = history.find((h) => batchKey(h.model, h.date) === key);
    if (!entry || entry.displacement == null) continue;
    const dims = dimsArray(entry);
    if (dims == null) continue;
    out.set(id, {
      aiRisk: entry.transformation,
      displacement: entry.displacement,
      dims,
      confidence: entry.confidence,
    });
  }
  return out;
}

export function buildModelsPageModel(input: ModelsPageInput): ModelsPageModel {
  const grouped = new Map<BatchKey, ScoreHistoryEntry[]>();
  for (const history of input.historyByOcc.values()) {
    for (const entry of history) {
      const key = batchKey(entry.model, entry.date);
      let bucket = grouped.get(key);
      if (!bucket) {
        bucket = [];
        grouped.set(key, bucket);
      }
      bucket.push(entry);
    }
  }

  const baseSummaries = [...grouped.entries()].map(([key, entries]) => {
    const first = entries[0]!;
    const aioisEntries = entries.filter((entry) => entry.displacement != null && entry.dims != null);
    const dimMeans = aioisEntries.length
      ? AIOIS_DIM_LABELS.map((_, idx) => mean(aioisEntries.map((entry) => dimsArray(entry)![idx]!)))
      : null;
    return {
      key,
      model: first.model,
      modelDisplay: formatModelDisplay(first.model),
      date: first.date,
      coverage: entries.length,
      total: input.totalOccupations,
      aioisCoverage: aioisEntries.length,
      meanTransformation: mean(entries.map((entry) => entry.transformation)),
      meanDisplacement: aioisEntries.length ? mean(aioisEntries.map((entry) => entry.displacement!)) : null,
      dimMeans,
    } satisfies Omit<BatchSummary, 'isCanonical'>;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));

  const canonicalKey = chooseCanonical(baseSummaries);
  const batches: BatchSummary[] = baseSummaries.map((batch) => ({
    ...batch,
    isCanonical: batch.key === canonicalKey,
  }));
  const canonical = batches.find((batch) => batch.isCanonical) ?? batches[batches.length - 1];
  if (!canonical) {
    throw new Error('/models requires at least one score batch');
  }

  const aioisBatches = batches.filter((batch) => batch.aioisCoverage > 0);
  const driftPairs: DriftPairSummary[] = [];
  for (let i = 1; i < aioisBatches.length; i += 1) {
    const base = aioisBatches[i - 1]!;
    const candidate = aioisBatches[i]!;
    const baseScores = toAioisScoreMap(input.historyByOcc, base.key);
    const candidateScores = toAioisScoreMap(input.historyByOcc, candidate.key);
    const commonCount = [...candidateScores.keys()].filter((id) => baseScores.has(id)).length;
    const report = computeDriftReport(baseScores, candidateScores, input.titlesByOcc, {
      rankThreshold: commonCount >= 100 ? 50 : 10,
      lowConfidence: 0.7,
    });
    driftPairs.push({
      key: `${base.key}__${candidate.key}`,
      base,
      candidate,
      report,
    });
  }

  const latestPair = driftPairs[driftPairs.length - 1] ?? null;
  const largestDivergences = latestPair
    ? [...latestPair.report.rows]
      .sort((a, b) => Math.abs(b.dT) - Math.abs(a.dT) || a.id - b.id)
      .slice(0, 20)
    : [];

  return {
    batches,
    canonical,
    driftPairs,
    largestDivergences,
    latestPair,
  };
}

export function buildModelsPageModelFromGraph(
  graph: KnowledgeGraph,
  totalOccupations: number,
): ModelsPageModel {
  const historyByOcc = new Map<number, readonly ScoreHistoryEntry[]>();
  const titlesByOcc = new Map<number, string>();
  for (const [id, occupation] of graph.occupations) {
    titlesByOcc.set(Number(id), occupation.titleJa);
    const history = graph.scoreHistoryByOcc.get(id);
    if (history) historyByOcc.set(Number(id), history);
  }
  return buildModelsPageModel({ historyByOcc, titlesByOcc, totalOccupations });
}

export function formatSigned(n: number, digits = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
}

export function formatFixed(n: number | null, digits = 2): string {
  return n == null ? '—' : n.toFixed(digits);
}
