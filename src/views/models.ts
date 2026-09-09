import { ModelsDeepProjectionSchema, type ModelsDeepProjectionShape } from '@/lib/projection-schemas';
import { formatModelDisplay, formatVendorDisplay, runSlug, SCORE_PANEL, type ScorePanel } from '@/site/score-attribution';
import {
  CONSENSUS_AGING_NOTE,
  CONSENSUS_FAQ_SENTENCE,
  CONSENSUS_HEADLINE_LABEL,
  MODELS_HUB_NOW_LABEL,
} from '@/site/consensus-copy';
import {
  DEFAULT_MODEL_STORY_EDITORIAL_ID,
  modelStoryEditorialSentenceId,
} from '@/site/model-editorial';

export type ModelsDeepProjection = ModelsDeepProjectionShape;

export interface ModelPersonalityCopy {
  readonly sentences: Readonly<Record<string, string>>;
}

export interface ModelStoryCopy {
  readonly editorial_sentences: Readonly<Record<string, string>>;
}

/** Temporary pair-shaped view of the vendor panel until 8.22 rewrites the hub. */
export interface ModelsFeatureLatestPair {
  readonly baseline: { readonly model: string; readonly modelDisplay: string; readonly date: string };
  readonly candidate: { readonly model: string; readonly modelDisplay: string; readonly date: string };
  readonly compared_count: number;
}

export interface ModelsFeaturePageModel {
  readonly projectionJson: string;
  readonly pageLastUpdated: string;
  readonly batchDatesText: string;
  readonly modelCount: number;
  readonly latestPair: ModelsFeatureLatestPair;
  readonly currentModel: ModelsFeatureModelCard;
  readonly consensusSummary: ModelsConsensusSummary;
  readonly modelCards: ReadonlyArray<ModelsFeatureModelCard>;
  readonly modelRoster: ReadonlyArray<ModelsFeatureModelCard>;
  readonly dateRangeText: string;
  readonly coverageRangeText: string;
  readonly consensus: ModelsDeepProjection['consensus'];
  readonly stories: ReadonlyArray<ModelsFeatureStory>;
}

export interface ModelsFeatureModelCard {
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly covered_count: number;
  readonly personality_sentence_id: string;
  readonly slug: string;
  readonly href: string;
  readonly personality_sentence: string;
}

export interface ModelsFeatureStory {
  readonly id: number;
  readonly title_ja: string;
  readonly href: string;
  readonly editorial_sentence_id: string;
  readonly editorial_sentence: string;
  readonly baseline_transformation: number;
  readonly candidate_transformation: number;
  readonly baseline_rationale_ja: string;
  readonly candidate_rationale_ja: string;
}

export interface ModelsConsensusSummary {
  readonly label: string;
  readonly headline: string;
  readonly oneLiner: string;
  readonly vendorCount: number;
  readonly latestRunDate: string;
  readonly agingNote: string | null;
  readonly latestModelDisplay: string;
  readonly latestModelHref: string;
}

function requireCopy(copy: Readonly<Record<string, string>>, id: string, label: string): string {
  const sentence = copy[id];
  if (!sentence) {
    throw new Error(`/models ${label} copy missing id: ${id}`);
  }
  return sentence;
}

function genericPersonalityFallbackId(id: string): string | null {
  const match = id.match(/(?:^|_)((?:d[1-9]|d10)_(?:positive|negative)_(?:strong|moderate))$/);
  return match ? `default_${match[1]}` : null;
}

function optionalCopy(copy: Readonly<Record<string, string>>, id: string): string | null {
  return copy[id] || null;
}

function personalityCopyWithFallback(copy: Readonly<Record<string, string>>, id: string): string {
  const curatedSentence = optionalCopy(copy, id);
  if (curatedSentence) return curatedSentence;

  const genericId = genericPersonalityFallbackId(id);
  if (genericId) {
    const genericSentence = optionalCopy(copy, genericId);
    if (genericSentence) return genericSentence;
  }

  return requireCopy(copy, 'default_neutral', 'personality fallback');
}

function editorialCopyWithFallback(
  copy: Readonly<Record<string, string>>,
  story: ModelsDeepProjection['stories'][number],
  panel: ModelsDeepProjection['panel'],
): string {
  const exactId = modelStoryEditorialSentenceId(story.id, {
    entries: panel.entries.map((entry) => ({ model: entry.model, date: entry.date })),
  });
  if (story.editorial_sentence_id === exactId) {
    const curated = optionalCopy(copy, exactId);
    if (curated) return curated;
  }
  return requireCopy(copy, DEFAULT_MODEL_STORY_EDITORIAL_ID, 'editorial fallback');
}

function escapeInlineJson(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function flattenLaneCards(
  projection: ModelsDeepProjection,
): Array<{
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly covered_count: number;
  readonly personality_sentence_id: string;
}> {
  const cards: Array<{
    readonly model: string;
    readonly modelDisplay: string;
    readonly date: string;
    readonly covered_count: number;
    readonly personality_sentence_id: string;
  }> = [];
  for (const lane of projection.lanes) {
    cards.push({
      model: lane.latest.model,
      modelDisplay: lane.latest.modelDisplay,
      date: lane.latest.date,
      covered_count: lane.latest.covered_count,
      personality_sentence_id: lane.latest.personality_sentence_id,
    });
    for (const entry of lane.history) {
      cards.push({
        model: entry.model,
        modelDisplay: entry.modelDisplay,
        date: entry.date,
        covered_count: entry.covered_count,
        personality_sentence_id: 'default_neutral',
      });
    }
  }
  return cards;
}

function adapterLatestPair(projection: ModelsDeepProjection): ModelsFeatureLatestPair {
  const first = projection.panel.entries[0]!;
  const last = projection.panel.entries[projection.panel.entries.length - 1]!;
  return {
    baseline: { model: first.model, modelDisplay: formatModelDisplay(first.model), date: first.date },
    candidate: { model: last.model, modelDisplay: formatModelDisplay(last.model), date: last.date },
    compared_count: projection.panel.compared_count,
  };
}

export function formatJapaneseDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

export function formatProviderDisplay(provider: string): string {
  return formatVendorDisplay(provider);
}

export function formatEvaluationStandard(promptVersion: string): string {
  return /^AIOIS-10[-\s]?v?1\.0/i.test(promptVersion)
    ? 'AIOIS-10 v1.0'
    : promptVersion;
}

export function buildModelsFeaturePageModel(
  rawProjection: unknown,
  personalityCopy: ModelPersonalityCopy,
  storyCopy: ModelStoryCopy,
  panel: ScorePanel = SCORE_PANEL,
): ModelsFeaturePageModel {
  const projection = ModelsDeepProjectionSchema.parse(rawProjection);
  const modelCards = flattenLaneCards(projection).map((card) => {
    const slug = runSlug({ model: card.model, runDate: card.date });
    return {
      ...card,
      modelDisplay: formatModelDisplay(card.model),
      slug,
      href: `/models/${slug}`,
      personality_sentence: personalityCopyWithFallback(personalityCopy.sentences, card.personality_sentence_id),
    };
  });
  const modelRoster = [...modelCards].sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
  const currentModel = modelRoster[modelRoster.length - 1];
  if (!currentModel) {
    throw new Error('/models projection has no model cards');
  }
  const dates = modelRoster.map((card) => card.date);
  const coverages = modelRoster.map((card) => card.covered_count);
  const latestPair = adapterLatestPair(projection);

  return {
    projectionJson: escapeInlineJson(JSON.stringify(projection)),
    pageLastUpdated: currentModel.date,
    batchDatesText: dates.join(' / '),
    modelCount: modelRoster.length,
    latestPair,
    currentModel,
    consensusSummary: {
      label: MODELS_HUB_NOW_LABEL,
      headline: CONSENSUS_HEADLINE_LABEL,
      oneLiner: CONSENSUS_FAQ_SENTENCE,
      vendorCount: panel.vendorCount,
      latestRunDate: panel.latestRunDate,
      agingNote: panel.staleVendorCount > 0 ? CONSENSUS_AGING_NOTE : null,
      latestModelDisplay: currentModel.modelDisplay,
      latestModelHref: currentModel.href,
    },
    modelCards,
    modelRoster,
    dateRangeText: dates.length === 1 ? dates[0]! : `${dates[0]} から ${dates[dates.length - 1]}`,
    coverageRangeText: coverages.length === 1 || Math.min(...coverages) === Math.max(...coverages)
      ? `${currentModel.covered_count}職業`
      : `${Math.min(...coverages)}〜${Math.max(...coverages)}職業`,
    consensus: projection.consensus,
    stories: projection.stories.map((story) => {
      const first = story.scores[0]!;
      const last = story.scores[story.scores.length - 1]!;
      return {
        id: story.id,
        title_ja: story.title_ja,
        href: story.href,
        editorial_sentence_id: story.editorial_sentence_id,
        editorial_sentence: editorialCopyWithFallback(storyCopy.editorial_sentences, story, projection.panel),
        baseline_transformation: first.transformation,
        candidate_transformation: last.transformation,
        baseline_rationale_ja: first.rationale_ja,
        candidate_rationale_ja: last.rationale_ja,
      };
    }),
  };
}

export function formatModelScore(score: number): string {
  return score.toFixed(1);
}

export function scoreBarWidth(score: number): string {
  return `${Math.max(0, Math.min(100, Math.round(score * 10)))}%`;
}
