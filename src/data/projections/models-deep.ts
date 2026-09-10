/**
 * data.models_deep.json projection — visitor-facing /models feature payload.
 *
 * Carries only the compact fields needed by the static magazine page. It is
 * the sole public projection that exposes selected rationale_ja strings;
 * data.score_history.json intentionally remains rationale-free.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { computeDriftReport, type AioisScore, type DriftReport } from '../../graph/aiois-drift.js';
import { ModelsDeepProjectionSchema, type ModelsDeepProjectionShape } from '../../lib/projection-schemas.js';
import { occupationPath } from '../../lib/urls.js';
import {
  formatModelDisplay,
  formatVendorDisplay,
  isWhitelistedVendor,
  VENDOR_WHITELIST,
} from '../../site/score-attribution.js';
import {
  DEFAULT_MODEL_STORY_EDITORIAL_ID,
  modelStoryEditorialSentenceId,
  type ModelEditorialPanelIdentity,
} from '../../site/model-editorial.js';
import type { Aiois10 } from '../../graph/types.js';
import type { ScoreHistEntry } from '../../graph/score-strategy.js';
import type { Indexes } from '../lib/indexes.js';
import personalityCopy from '../../content/model-personality.ja.json';
import storyOverridesJson from '../../content/model-story-overrides.ja.json';

export const MODEL_PROJECTION_MAX_BYTES = 30 * 1024;
const STORY_MIN = 3;
const STORY_MAX = 5;
const STRONG_THRESHOLD = 0.75;
const MODERATE_THRESHOLD = 0.5;
const AIOIS_DIM_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as const;

type Strength = 'strong' | 'moderate';
type Direction = 'positive' | 'negative';
export type ModelsDeepProjection = ModelsDeepProjectionShape;

interface BatchSummary {
  readonly key: string;
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly provider: string;
  readonly coveredCount: number;
  readonly aioisCoverage: number;
  readonly backfill: boolean;
}

interface PairSummary {
  readonly base: BatchSummary;
  readonly candidate: BatchSummary;
  readonly report: DriftReport;
}

interface OccupationSpread {
  readonly id: number;
  readonly title: string;
  readonly spread: number;
}

interface StoryCandidate {
  readonly spread: OccupationSpread;
  readonly scores: ModelsDeepProjection['stories'][number]['scores'];
}

export interface ModelsDeepBuildResult {
  files: string[];
  modelCards: number;
  consensus: number;
  stories: number;
  bytes: number;
}

function batchKey(model: string, date: string): string {
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

function buildBatchSummaries(indexes: Indexes): BatchSummary[] {
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

function selectPanel(batches: readonly BatchSummary[]): BatchSummary[] {
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

function panelEntry(
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

function buildLanes(
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

function buildPairSummaries(indexes: Indexes, batches: readonly BatchSummary[]): PairSummary[] {
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

function occupationSpreads(
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

function modelKey(model: string): string {
  return model.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function fallbackPersonalityId(model: string): string {
  const specific = `${modelKey(model)}_neutral`;
  if (specific in personalityCopy.sentences) return specific;
  return 'default_neutral';
}

function choosePersonalityId(
  model: string,
  dimDrifts: readonly number[],
  sign: 1 | -1,
  availableIds: ReadonlySet<string>,
): string {
  const fallback = availableIds.has(`${modelKey(model)}_neutral`) ? `${modelKey(model)}_neutral` : 'default_neutral';
  const signedDrifts = dimDrifts.map((value, index) => ({
    dim: AIOIS_DIM_KEYS[index]!,
    value: value * sign,
    abs: Math.abs(value),
  }));
  signedDrifts.sort((a, b) => b.abs - a.abs || AIOIS_DIM_KEYS.indexOf(a.dim) - AIOIS_DIM_KEYS.indexOf(b.dim));
  const driver = signedDrifts[0];
  if (!driver || driver.abs < MODERATE_THRESHOLD) return fallback;

  const strength: Strength = driver.abs >= STRONG_THRESHOLD ? 'strong' : 'moderate';
  const direction: Direction = driver.value >= 0 ? 'positive' : 'negative';
  const specific = `${modelKey(model)}_${driver.dim}_${direction}_${strength}`;
  if (availableIds.has(specific)) return specific;
  const generic = `default_${driver.dim}_${direction}_${strength}`;
  if (availableIds.has(generic)) return generic;
  return fallback;
}

function personalityIdForModel(
  model: string,
  pairs: readonly PairSummary[],
): string {
  const pair = [...pairs].reverse().find((candidatePair) =>
    candidatePair.candidate.model === model || candidatePair.base.model === model,
  );
  if (!pair) return fallbackPersonalityId(model);

  const sign = pair.candidate.model === model ? 1 : -1;
  return choosePersonalityId(model, pair.report.dimDrift, sign, new Set(Object.keys(personalityCopy.sentences)));
}

export function selectPersonalitySentenceIdForTest(
  model: string,
  dimDrifts: readonly number[],
  role: 'baseline' | 'candidate',
  availableIds: ReadonlySet<string> = new Set(['default_neutral']),
): string {
  return choosePersonalityId(model, dimDrifts, role === 'candidate' ? 1 : -1, availableIds);
}

function consensusRows(rows: readonly OccupationSpread[]): ModelsDeepProjection['consensus'] {
  return [...rows]
    .sort((a, b) => a.spread - b.spread || a.id - b.id)
    .slice(0, 3)
    .map((row) => ({
      id: row.id,
      title_ja: row.title,
      href: occupationPath(row.id),
    }));
}

function findStoryCandidate(
  indexes: Indexes,
  panel: readonly BatchSummary[],
  spread: OccupationSpread,
): StoryCandidate | null {
  const history = indexes.historyByOcc.get(spread.id);
  if (!history) return null;
  const scores: ModelsDeepProjection['stories'][number]['scores'][number][] = [];
  for (const batch of panel) {
    const entry = history.find((item) => batchKey(item.model, item.date) === batch.key);
    if (!entry?.rationale_ja) return null;
    scores.push({
      provider: batch.provider,
      model: batch.model,
      modelDisplay: batch.modelDisplay,
      transformation: entry.aiois?.transformation ?? entry.ai_risk,
      rationale_ja: entry.rationale_ja,
    });
  }
  return { spread, scores };
}

function automaticStoryIds(rows: readonly OccupationSpread[]): number[] {
  return [...rows]
    .sort((a, b) => b.spread - a.spread || a.id - b.id)
    .map((row) => row.id);
}

function configuredStoryIds(config: ModelsStoryOverrideConfig, automaticIds: readonly number[]): number[] {
  const requested = [...config.pinned_ids, ...config.replace_ids, ...automaticIds];
  const seen = new Set<number>();
  const resolved: number[] = [];
  for (const id of requested) {
    if (seen.has(id)) continue;
    seen.add(id);
    resolved.push(id);
    if (resolved.length >= STORY_MAX) break;
  }
  return resolved;
}

function editorialSentenceId(
  id: number,
  panel: ModelEditorialPanelIdentity,
  availableIds: ReadonlySet<string> = new Set(Object.keys(storyOverrides.editorial_sentences)),
): string {
  const specific = modelStoryEditorialSentenceId(id, panel);
  return availableIds.has(specific) ? specific : DEFAULT_MODEL_STORY_EDITORIAL_ID;
}

export function selectEditorialSentenceIdForTest(
  id: number,
  panel: ModelEditorialPanelIdentity,
  availableIds: ReadonlySet<string>,
): string {
  return editorialSentenceId(id, panel, availableIds);
}

function storyRows(
  indexes: Indexes,
  panel: readonly BatchSummary[],
  spreads: readonly OccupationSpread[],
): ModelsDeepProjection['stories'] {
  const autoIds = automaticStoryIds(spreads);
  const requestedIds = configuredStoryIds(storyOverrides, autoIds);
  const stories: ModelsDeepProjection['stories'] = [];
  const used = new Set<number>();
  const byId = new Map(spreads.map((row) => [row.id, row]));
  const panelIdentity: ModelEditorialPanelIdentity = {
    entries: panel.map((batch) => ({ model: batch.model, date: batch.date })),
  };

  function tryAdd(id: number, isOverride: boolean): void {
    if (used.has(id) || stories.length >= STORY_MAX) return;
    const spread = byId.get(id);
    if (!spread) {
      if (isOverride) {
        console.warn(`[models-deep] curated story id ${id} unavailable in current vendor panel; filling automatically`);
      }
      return;
    }
    const candidate = findStoryCandidate(indexes, panel, spread);
    if (!candidate) {
      if (isOverride) {
        console.warn(`[models-deep] curated story id ${id} unavailable in current vendor panel; filling automatically`);
      }
      return;
    }
    used.add(id);
    stories.push({
      id: candidate.spread.id,
      title_ja: candidate.spread.title,
      href: occupationPath(candidate.spread.id),
      scores: candidate.scores,
      spread: candidate.spread.spread,
      editorial_sentence_id: editorialSentenceId(candidate.spread.id, panelIdentity),
    });
  }

  const overrideIds = new Set([...storyOverrides.pinned_ids, ...storyOverrides.replace_ids]);
  for (const id of requestedIds) tryAdd(id, overrideIds.has(id));
  for (const id of autoIds) tryAdd(id, false);

  if (stories.length < STORY_MIN) {
    throw new Error(`[models-deep] resolved ${stories.length} stories; at least ${STORY_MIN} are required`);
  }
  return stories;
}

/** Typed view of the committed overrides. The JSON import infers `never[]` for
 *  an empty `pinned_ids`, which is the correct state when the story list should
 *  simply follow the current pair's biggest movers. */
const storyOverrides: ModelsStoryOverrideConfig = storyOverridesJson;

export interface ModelsStoryOverrideConfig {
  readonly pinned_ids: readonly number[];
  readonly replace_ids: readonly number[];
  readonly editorial_sentences: Readonly<Record<string, string>>;
}

export function selectStoryIdsForTest(
  config: Pick<ModelsStoryOverrideConfig, 'pinned_ids' | 'replace_ids'>,
  automaticIdsInput: readonly number[],
): number[] {
  return configuredStoryIds({ ...config, editorial_sentences: {} }, automaticIdsInput);
}

export function resolveStoryIdsForTest(
  config: Pick<ModelsStoryOverrideConfig, 'pinned_ids' | 'replace_ids'>,
  automaticIdsInput: readonly number[],
  availableIds: ReadonlySet<number>,
  minStories = STORY_MIN,
): number[] {
  const requestedIds = configuredStoryIds({ ...config, editorial_sentences: {} }, automaticIdsInput);
  const overrideIds = new Set([...config.pinned_ids, ...config.replace_ids]);
  const resolved: number[] = [];
  const used = new Set<number>();

  function tryAdd(id: number): void {
    if (used.has(id) || resolved.length >= STORY_MAX || !availableIds.has(id)) return;
    used.add(id);
    resolved.push(id);
  }

  for (const id of requestedIds) {
    if (!availableIds.has(id) && overrideIds.has(id)) continue;
    tryAdd(id);
  }
  for (const id of automaticIdsInput) tryAdd(id);

  if (resolved.length < minStories) {
    throw new Error(`[models-deep] resolved ${resolved.length} stories; at least ${minStories} are required`);
  }
  return resolved;
}

export function selectConsensusRowsForTest(
  rows: readonly { readonly id: number; readonly spread: number }[],
): readonly number[] {
  return [...rows]
    .sort((a, b) => a.spread - b.spread || a.id - b.id)
    .slice(0, 3)
    .map((row) => row.id);
}

export function selectAutomaticStoryIdsForTest(
  rows: readonly { readonly id: number; readonly spread: number }[],
): readonly number[] {
  return [...rows]
    .sort((a, b) => b.spread - a.spread || a.id - b.id)
    .map((row) => row.id);
}

export function buildModelsDeepPayload(indexes: Indexes, generatedAt = new Date().toISOString()): ModelsDeepProjection {
  const batches = buildBatchSummaries(indexes);
  const pairs = buildPairSummaries(indexes, batches);
  const panelBatches = selectPanel(batches);
  const { comparedCount, rows } = occupationSpreads(indexes, panelBatches);
  if (comparedCount < 1) {
    throw new Error('[models-deep] vendor panel has no occupation scored by every panel entry');
  }

  const payload: ModelsDeepProjection = {
    generated_at: generatedAt,
    panel: {
      entries: panelBatches.map((batch) => panelEntry(batch, pairs)),
      compared_count: comparedCount,
    },
    lanes: buildLanes(batches, panelBatches, pairs),
    consensus: consensusRows(rows),
    stories: storyRows(indexes, panelBatches, rows),
  };

  const parsed = ModelsDeepProjectionSchema.parse(payload);
  warnAboutOrphanedCuration(parsed, automaticStoryIds(rows));
  return parsed;
}

export function modelsDeepPayloadBytes(payload: ModelsDeepProjection): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf-8');
}

/** One orphaned piece of curated copy, with enough context to act on it. */
export interface OrphanedCurationReport {
  readonly editorialKeys: readonly string[];
  readonly personalityKeys: readonly string[];
  readonly stalePins: readonly number[];
  /** Biggest movers of the current pair that the stale pins are keeping out. */
  readonly displacedIds: readonly number[];
  readonly activeEditorialCount: number;
}

/**
 * Curated copy is scoped to an exact batch panel on purpose (#162): a re-run must
 * not inherit another panel's prose, and DATA_ARCHITECTURE mandates the generic
 * fallback. The defect this reports is that the handover is otherwise SILENT —
 * on the day a batch lands, every reviewed sentence goes dark and the build says
 * nothing. Issue #219.
 *
 * Deliberately a warning, not a failure: MULTI_MODEL_SCORING states curation
 * must not block landing a batch. Re-curating is the follow-up task, and this is
 * what tells you the task exists.
 *
 * `default_*` personality ids are a lookup table — most are unused at any given
 * time by design — so only MODEL-SPECIFIC keys can be orphans. Listing the whole
 * table would train everyone to ignore the warning.
 */
export function reportOrphanedCuration(
  payload: ModelsDeepProjection,
  automaticStoryIdsForPair: readonly number[],
  overrides: ModelsStoryOverrideConfig = storyOverrides,
  personalitySentences: Readonly<Record<string, string>> = personalityCopy.sentences,
): OrphanedCurationReport {
  const panel: ModelEditorialPanelIdentity = {
    entries: payload.panel.entries.map((entry) => ({ model: entry.model, date: entry.date })),
  };
  const panelSuffix = modelStoryEditorialSentenceId(0, panel).slice(1);

  const allEditorial = Object.keys(overrides.editorial_sentences)
    .filter((key) => key !== DEFAULT_MODEL_STORY_EDITORIAL_ID);
  const editorialKeys = allEditorial.filter((key) => !key.endsWith(panelSuffix)).sort();
  const activeEditorialCount = allEditorial.length - editorialKeys.length;

  const usedPersonality = new Set(payload.panel.entries.map((entry) => entry.personality_sentence_id));
  const personalityKeys = Object.keys(personalitySentences)
    .filter((key) => !key.startsWith('default_') && !usedPersonality.has(key))
    .sort();

  const shownIds = new Set(payload.stories.map((story) => story.id));
  const wouldShow = automaticStoryIdsForPair.slice(0, STORY_MAX);
  const wouldShowSet = new Set(wouldShow);
  const stalePins = [...overrides.pinned_ids, ...overrides.replace_ids]
    .filter((id) => shownIds.has(id) && !wouldShowSet.has(id))
    .sort((a, b) => a - b);
  const displacedIds = wouldShow.filter((id) => !shownIds.has(id));

  return { editorialKeys, personalityKeys, stalePins, displacedIds, activeEditorialCount };
}

function warnAboutOrphanedCuration(
  payload: ModelsDeepProjection,
  automaticStoryIdsForPair: readonly number[],
): void {
  const { editorialKeys, personalityKeys, stalePins, displacedIds, activeEditorialCount } =
    reportOrphanedCuration(payload, automaticStoryIdsForPair);
  if (editorialKeys.length === 0 && personalityKeys.length === 0 && stalePins.length === 0) return;

  const panelLabel = payload.panel.entries.map((entry) => `${entry.model}@${entry.date}`).join(' / ');
  console.warn(`[models-deep] curated /models copy is out of date for the current panel (${panelLabel}):`);
  console.warn(`  active reviewed story sentences: ${activeEditorialCount}`);

  if (editorialKeys.length > 0) {
    console.warn(`  ${editorialKeys.length} story sentence(s) scoped to an older pair, now showing generic copy:`);
    for (const key of editorialKeys) console.warn(`    ${key}`);
  }
  if (personalityKeys.length > 0) {
    console.warn(`  ${personalityKeys.length} model-specific personality sentence(s) no longer selected:`);
    for (const key of personalityKeys) console.warn(`    ${key}`);
  }
  if (stalePins.length > 0) {
    console.warn(
      `  ${stalePins.length} pinned story id(s) are not among this pair's biggest movers ` +
      '(src/content/model-story-overrides.ja.json):',
    );
    console.warn(`    pinned:    ${stalePins.join(', ')}`);
    if (displacedIds.length > 0) {
      console.warn(`    keeping out: ${displacedIds.join(', ')}`);
    }
  }
  console.warn('  Re-curating is a follow-up task and does not block landing a batch.');
}

export async function buildModelsDeep(
  indexes: Indexes,
  distRoot: string,
): Promise<ModelsDeepBuildResult> {
  const payload = buildModelsDeepPayload(indexes);
  const bytes = modelsDeepPayloadBytes(payload);
  if (bytes > MODEL_PROJECTION_MAX_BYTES) {
    throw new Error(`[models-deep] projection is ${bytes} bytes; max is ${MODEL_PROJECTION_MAX_BYTES}`);
  }

  const outPath = join(distRoot, 'data.models_deep.json');
  await writeFile(outPath, JSON.stringify(payload) + '\n', 'utf-8');

  return {
    files: [outPath],
    modelCards: payload.lanes.length,
    consensus: payload.consensus.length,
    stories: payload.stories.length,
    bytes,
  };
}
