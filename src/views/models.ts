import { ModelsDeepProjectionSchema, type ModelsDeepProjectionShape } from '@/lib/projection-schemas';
import { formatModelDisplay, runSlug, SCORE_PANEL, type ScorePanel } from '@/site/score-attribution';
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

export interface ModelsFeaturePageModel {
  readonly projectionJson: string;
  readonly pageLastUpdated: string;
  readonly batchDatesText: string;
  readonly modelCount: number;
  readonly latestPair: ModelsDeepProjection['latest_pair'];
  readonly currentModel: ModelsFeatureModelCard;
  readonly consensusSummary: ModelsConsensusSummary;
  readonly modelCards: ReadonlyArray<ModelsFeatureModelCard>;
  readonly modelRoster: ReadonlyArray<ModelsFeatureModelCard>;
  readonly dateRangeText: string;
  readonly coverageRangeText: string;
  readonly consensus: ModelsDeepProjection['consensus'];
  readonly stories: ReadonlyArray<ModelsDeepProjection['stories'][number] & {
    readonly editorial_sentence: string;
  }>;
}

export type ModelsFeatureModelCard = ModelsDeepProjection['model_cards'][number] & {
  readonly slug: string;
  readonly href: string;
  readonly personality_sentence: string;
};

export interface ModelsConsensusSummary {
  readonly label: string;
  readonly headline: string;
  readonly oneLiner: string;
  readonly voteCount: number;
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
  pair: ModelsDeepProjection['latest_pair'],
): string {
  const exactPairId = modelStoryEditorialSentenceId(story.id, pair);
  if (story.editorial_sentence_id === exactPairId) {
    const curated = optionalCopy(copy, exactPairId);
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

function canonicalPairBatch(
  batch: ModelsDeepProjection['latest_pair']['baseline'],
): ModelsDeepProjection['latest_pair']['baseline'] {
  return {
    ...batch,
    modelDisplay: formatModelDisplay(batch.model),
  };
}

export function formatJapaneseDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

export function formatProviderDisplay(provider: string): string {
  const trimmed = provider.trim();
  const providers: Readonly<Record<string, string>> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
  };
  return providers[trimmed.toLowerCase()] ?? trimmed;
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
  const modelCards = projection.model_cards.map((card) => {
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

  return {
    projectionJson: escapeInlineJson(JSON.stringify(projection)),
    pageLastUpdated: currentModel.date,
    batchDatesText: dates.join(' / '),
    modelCount: modelRoster.length,
    latestPair: {
      ...projection.latest_pair,
      baseline: canonicalPairBatch(projection.latest_pair.baseline),
      candidate: canonicalPairBatch(projection.latest_pair.candidate),
    },
    currentModel,
    consensusSummary: {
      label: MODELS_HUB_NOW_LABEL,
      headline: CONSENSUS_HEADLINE_LABEL,
      oneLiner: CONSENSUS_FAQ_SENTENCE,
      voteCount: panel.voteCount,
      latestRunDate: panel.latestRunDate,
      agingNote: panel.usedExpiredVotes ? CONSENSUS_AGING_NOTE : null,
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
    stories: projection.stories.map((story) => ({
      ...story,
      editorial_sentence: editorialCopyWithFallback(storyCopy.editorial_sentences, story, projection.latest_pair),
    })),
  };
}

export function formatModelScore(score: number): string {
  return score.toFixed(1);
}

export function scoreBarWidth(score: number): string {
  return `${Math.max(0, Math.min(100, Math.round(score * 10)))}%`;
}
