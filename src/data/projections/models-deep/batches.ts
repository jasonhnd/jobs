import { computeDriftReport, type AioisScore, type DriftReport } from '../../../graph/aiois-drift.js';
import type { Aiois10 } from '../../../graph/types.js';
import type { ScoreHistEntry } from '../../../graph/score-strategy.js';
import { formatModelDisplay, formatVendorDisplay, isWhitelistedVendor, VENDOR_WHITELIST } from '../../../site/score-attribution.js';
import type { Indexes } from '../../lib/indexes.js';
import type { ModelsDeepProjection } from '../models-deep.js';
import { AIOIS_DIM_KEYS, personalityIdForModel } from './personality.js';
import type { OccupationSpread } from './stories.js';

export interface BatchSummary {
  readonly key: string;
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly provider: string;
  readonly coveredCount: number;
  readonly aioisCoverage: number;
  readonly backfill: boolean;
}

export interface PairSummary {
  readonly base: BatchSummary;
  readonly candidate: BatchSummary;
  readonly report: DriftReport;
}

export function batchKey(model: string, date: string): string {
  return `${date}::${model}`;
}

function modelDisplay(model: string): string {
  return formatModelDisplay(model).replace(/^Claude\s+/, '');
}

function dimsArray(aiois: Aiois10): readonly number[] {
  return AIOIS_DIM_KEYS.map((key) => aiois[key]);
}

function toAioisScoreMap(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistEntry[]>,
  key: string,
): Map<number, AioisScore> {
  const out = new Map<number, AioisScore>();
  for (const [id, history] of historyByOcc) {
    const entry = history.find((h) => batchKey(h.model, h.date) === key);
    if (!entry?.aiois) continue;
    out.set(id, {
      aiRisk: entry.ai_risk,
      displacement: entry.aiois.displacement,
      dims: dimsArray(entry.aiois),
      confidence: entry.confidence ?? null,
    });
  }
  return out;
}

export function buildBatchSummaries(indexes: Indexes): BatchSummary[] {
  const grouped = new Map<string, ScoreHistEntry[]>();
  for (const history of indexes.historyByOcc.values()) {
    for (const entry of history) {
      const key = batchKey(entry.model, entry.date);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry);
    }
  }

  return [...grouped.entries()]
    .map(([key, entries]) => {
      const first = entries[0]!;
      if (!isWhitelistedVendor(first.provider)) {
        throw new Error(
          `[models-deep] batch ${key} has model_provider "${first.provider}" outside VENDOR_WHITELIST`,
        );
      }
      if (entries.some((e) => (e.backfill === true) !== (first.backfill === true))) {
        throw new Error(`[models-deep] batch ${key} mixes backfill and non-backfill entries`);
      }
      return {
        key,
        model: first.model,
        modelDisplay: modelDisplay(first.model),
        date: first.date,
        provider: first.provider,
        coveredCount: entries.length,
        aioisCoverage: entries.filter((entry) => entry.aiois != null).length,
        backfill: first.backfill === true,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
}

function newestComparableForProvider(
  batches: readonly BatchSummary[],
  provider: string,
): BatchSummary | null {
  const candidates = batches.filter((batch) => batch.provider === provider && batch.aioisCoverage > 0 && !batch.backfill);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.date.localeCompare(a.date) || a.model.localeCompare(b.model))[0]!;
}

function newestBatchForProvider(
  batches: readonly BatchSummary[],
  provider: string,
): BatchSummary | null {
  const candidates = batches.filter((batch) => batch.provider === provider && !batch.backfill);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.date.localeCompare(a.date) || a.model.localeCompare(b.model))[0]!;
}

export function selectPanel(batches: readonly BatchSummary[]): BatchSummary[] {
  const panel: BatchSummary[] = [];
  for (const provider of VENDOR_WHITELIST) {
    const latest = newestComparableForProvider(batches, provider);
    if (latest) panel.push(latest);
  }
  panel.sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
  if (panel.length === 0) {
    throw new Error('[models-deep] no comparable AIOIS-10 batch for any whitelisted vendor');
  }
  return panel;
}

export function panelEntry(
  batch: BatchSummary,
  pairs: readonly PairSummary[],
): ModelsDeepProjection['panel']['entries'][number] {
  return {
    provider: batch.provider,
    vendorDisplay: formatVendorDisplay(batch.provider),
    model: batch.model,
    modelDisplay: batch.modelDisplay,
    date: batch.date,
    covered_count: batch.coveredCount,
    personality_sentence_id: personalityIdForModel(batch.model, pairs),
  };
}

export function buildLanes(
  batches: readonly BatchSummary[],
  panel: readonly BatchSummary[],
  pairs: readonly PairSummary[],
): ModelsDeepProjection['lanes'] {
  const lanes: ModelsDeepProjection['lanes'] = [];
  for (const provider of VENDOR_WHITELIST) {
    const latestBatch = panel.find((batch) => batch.provider === provider)
      ?? newestBatchForProvider(batches, provider);
    if (!latestBatch) continue;
    const history = batches
      .filter((batch) => batch.provider === provider && batch.key !== latestBatch.key)
      .sort((a, b) => b.date.localeCompare(a.date) || a.model.localeCompare(b.model))
      .map((batch) => ({
        model: batch.model,
        modelDisplay: batch.modelDisplay,
        date: batch.date,
        covered_count: batch.coveredCount,
      }));
    lanes.push({
      provider,
      vendorDisplay: formatVendorDisplay(provider),
      latest: panelEntry(latestBatch, pairs),
      history,
    });
  }
  return lanes;
}

export function buildPairSummaries(indexes: Indexes, batches: readonly BatchSummary[]): PairSummary[] {
  const titles = new Map([...indexes.occById.entries()].map(([id, occ]) => [id, occ.title_ja]));
  // Backfill batches are excluded from the adjacent-pair chain: appending one after the newest run would otherwise make the newest model the *base* of its last pair and flip its personality sign (mms-9).
  const aioisBatches = batches.filter((batch) => batch.aioisCoverage > 0 && !batch.backfill);
  const pairs: PairSummary[] = [];

  for (let i = 1; i < aioisBatches.length; i += 1) {
    const base = aioisBatches[i - 1]!;
    const candidate = aioisBatches[i]!;
    const baseScores = toAioisScoreMap(indexes.historyByOcc, base.key);
    const candidateScores = toAioisScoreMap(indexes.historyByOcc, candidate.key);
    const commonCount = [...candidateScores.keys()].filter((id) => baseScores.has(id)).length;
    pairs.push({
      base,
      candidate,
      report: computeDriftReport(baseScores, candidateScores, titles, {
        rankThreshold: commonCount >= 100 ? 50 : 10,
        lowConfidence: 0.7,
      }),
    });
  }

  return pairs;
}

export function occupationSpreads(
  indexes: Indexes,
  panel: readonly BatchSummary[],
): { readonly comparedCount: number; readonly rows: readonly OccupationSpread[] } {
  const maps = panel.map((batch) => toAioisScoreMap(indexes.historyByOcc, batch.key));
  const first = maps[0];
  if (!first) return { comparedCount: 0, rows: [] };
  const commonIds = [...first.keys()].filter((id) => maps.every((map) => map.has(id)));
  const rows = commonIds.map((id) => {
    const values = maps.map((map) => map.get(id)!.aiRisk);
    return {
      id,
      title: indexes.occById.get(id)?.title_ja ?? `職業 ${id}`,
      spread: Math.max(...values) - Math.min(...values),
    };
  });
  return { comparedCount: commonIds.length, rows };
}

