/**
 * data.models_deep.json projection — small rationale payload for /models.
 *
 * Keep this separate from data.score_history.json so the history projection
 * remains numeric-only and small.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { computeDriftReport, type AioisScore } from '../../graph/aiois-drift.js';
import type { ScoreHistEntry } from '../../graph/score-strategy.js';
import { ModelsDeepProjectionSchema } from '../../lib/projection-schemas.js';
import { formatModelDisplay } from '../../site/score-attribution.js';
import type { Indexes } from '../lib/indexes.js';

const RATIONALE_LIMIT = 500;
const PAIR_LIMIT = 8;

interface BatchMeta {
  readonly key: string;
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
}

export interface ModelsDeepBatch {
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
}

export interface ModelsDeepRationalePair {
  readonly id: number;
  readonly title_ja: string;
  readonly href: string;
  readonly baseline_transformation: number;
  readonly candidate_transformation: number;
  readonly drift: number;
  readonly baseline_rationale_ja: string;
  readonly candidate_rationale_ja: string;
}

export interface ModelsDeepPayload {
  readonly latest_pair: {
    readonly baseline: ModelsDeepBatch;
    readonly candidate: ModelsDeepBatch;
  } | null;
  readonly rationale_pairs: readonly ModelsDeepRationalePair[];
}

export interface ModelsDeepBuildResult {
  files: string[];
  pairs: number;
  bytes: number;
}

function batchKey(model: string, date: string): string {
  return `${date}::${model}`;
}

function dimsArray(entry: ScoreHistEntry): readonly number[] | null {
  const aiois = entry.aiois;
  if (aiois == null) return null;
  return [
    aiois.d1, aiois.d2, aiois.d3, aiois.d4, aiois.d5,
    aiois.d6, aiois.d7, aiois.d8, aiois.d9, aiois.d10,
  ];
}

function toAioisScoreMap(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistEntry[]>,
  key: string,
): Map<number, AioisScore> {
  const out = new Map<number, AioisScore>();
  for (const [id, history] of historyByOcc) {
    const entry = history.find((h) => batchKey(h.model, h.date) === key);
    const dims = entry ? dimsArray(entry) : null;
    if (!entry || !entry.aiois || dims == null) continue;
    out.set(id, {
      aiRisk: entry.ai_risk,
      displacement: entry.aiois.displacement,
      dims,
      confidence: entry.confidence ?? null,
    });
  }
  return out;
}

function entryByKey(history: readonly ScoreHistEntry[], key: string): ScoreHistEntry | null {
  return history.find((entry) => batchKey(entry.model, entry.date) === key) ?? null;
}

function capUtf8(input: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(input).length <= maxBytes) return input;
  let out = '';
  for (const ch of input) {
    const next = out + ch;
    if (encoder.encode(next).length > maxBytes) break;
    out = next;
  }
  return out;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildAioisBatches(indexes: Indexes): readonly BatchMeta[] {
  const batches = new Map<string, BatchMeta>();
  for (const history of indexes.historyByOcc.values()) {
    for (const entry of history) {
      if (entry.aiois == null) continue;
      const key = batchKey(entry.model, entry.date);
      if (!batches.has(key)) {
        batches.set(key, {
          key,
          model: entry.model,
          modelDisplay: formatModelDisplay(entry.model),
          date: entry.date,
        });
      }
    }
  }
  return [...batches.values()].sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
}

export function buildModelsDeepPayload(indexes: Indexes): ModelsDeepPayload {
  const batches = buildAioisBatches(indexes);
  if (batches.length < 2) {
    return ModelsDeepProjectionSchema.parse({ latest_pair: null, rationale_pairs: [] });
  }

  const baseline = batches[batches.length - 2]!;
  const candidate = batches[batches.length - 1]!;
  const titles = new Map([...indexes.occById].map(([id, occ]) => [id, occ.title_ja]));
  const baseScores = toAioisScoreMap(indexes.historyByOcc, baseline.key);
  const candidateScores = toAioisScoreMap(indexes.historyByOcc, candidate.key);
  const commonCount = [...candidateScores.keys()].filter((id) => baseScores.has(id)).length;
  const report = computeDriftReport(baseScores, candidateScores, titles, {
    rankThreshold: commonCount >= 100 ? 50 : 10,
    lowConfidence: 0.7,
  });

  const rationale_pairs: ModelsDeepRationalePair[] = [];
  for (const row of [...report.rows].sort((a, b) => Math.abs(b.dT) - Math.abs(a.dT) || a.id - b.id)) {
    const history = indexes.historyByOcc.get(row.id);
    const baseEntry = history ? entryByKey(history, baseline.key) : null;
    const candidateEntry = history ? entryByKey(history, candidate.key) : null;
    if (!baseEntry?.rationale_ja || !candidateEntry?.rationale_ja) continue;
    rationale_pairs.push({
      id: row.id,
      title_ja: row.title,
      href: `/${row.id}`,
      baseline_transformation: round1(row.baseT),
      candidate_transformation: round1(row.candT),
      drift: round1(row.dT),
      baseline_rationale_ja: capUtf8(baseEntry.rationale_ja, RATIONALE_LIMIT),
      candidate_rationale_ja: capUtf8(candidateEntry.rationale_ja, RATIONALE_LIMIT),
    });
    if (rationale_pairs.length >= PAIR_LIMIT) break;
  }

  return ModelsDeepProjectionSchema.parse({
    latest_pair: {
      baseline: { model: baseline.model, modelDisplay: baseline.modelDisplay, date: baseline.date },
      candidate: { model: candidate.model, modelDisplay: candidate.modelDisplay, date: candidate.date },
    },
    rationale_pairs,
  });
}

export async function buildModelsDeep(
  indexes: Indexes,
  distRoot: string,
): Promise<ModelsDeepBuildResult> {
  const payload = buildModelsDeepPayload(indexes);
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > 30_000) {
    throw new Error(`[models-deep] data.models_deep.json exceeds 30 KB: ${bytes} bytes`);
  }
  const outPath = join(distRoot, 'data.models_deep.json');
  await writeFile(outPath, `${json}\n`, 'utf-8');

  return {
    files: [outPath],
    pairs: payload.rationale_pairs.length,
    bytes,
  };
}
