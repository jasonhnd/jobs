import { occupationPath } from '../../../lib/urls.js';
import { DEFAULT_MODEL_STORY_EDITORIAL_ID, modelStoryEditorialSentenceId, type ModelEditorialPanelIdentity } from '../../../site/model-editorial.js';
import personalityCopy from '../../../content/model-personality.ja.json';
import storyOverridesJson from '../../../content/model-story-overrides.ja.json';
import type { Indexes } from '../../lib/indexes.js';
import type { ModelsDeepProjection } from '../models-deep.js';
import { batchKey, type BatchSummary } from './batches.js';
import { choosePersonalityId } from './personality.js';

const STORY_MIN = 3;
const STORY_MAX = 5;

export interface OccupationSpread {
  readonly id: number;
  readonly title: string;
  readonly spread: number;
}

interface StoryCandidate {
  readonly spread: OccupationSpread;
  readonly scores: ModelsDeepProjection['stories'][number]['scores'];
}

export function selectPersonalitySentenceIdForTest(
  model: string,
  dimDrifts: readonly number[],
  role: 'baseline' | 'candidate',
  availableIds: ReadonlySet<string> = new Set(['default_neutral']),
): string {
  return choosePersonalityId(model, dimDrifts, role === 'candidate' ? 1 : -1, availableIds);
}

export function consensusRows(rows: readonly OccupationSpread[]): ModelsDeepProjection['consensus'] {
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

export function automaticStoryIds(rows: readonly OccupationSpread[]): number[] {
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

export function storyRows(
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

export function warnAboutOrphanedCuration(
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

