import { ModelsDeepProjectionSchema, type ModelsDeepProjectionShape } from '@/lib/projection-schemas';

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
  readonly modelCards: ReadonlyArray<ModelsDeepProjection['model_cards'][number] & {
    readonly personality_sentence: string;
  }>;
  readonly consensus: ModelsDeepProjection['consensus'];
  readonly stories: ReadonlyArray<ModelsDeepProjection['stories'][number] & {
    readonly editorial_sentence: string;
  }>;
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

function editorialCopyWithFallback(copy: Readonly<Record<string, string>>, id: string): string {
  return optionalCopy(copy, id) ?? requireCopy(copy, 'default_latest_pair_split', 'editorial fallback');
}

function escapeInlineJson(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildModelsFeaturePageModel(
  rawProjection: unknown,
  personalityCopy: ModelPersonalityCopy,
  storyCopy: ModelStoryCopy,
): ModelsFeaturePageModel {
  const projection = ModelsDeepProjectionSchema.parse(rawProjection);
  const dates = projection.model_cards.map((card) => card.date);

  return {
    projectionJson: escapeInlineJson(JSON.stringify(projection)),
    pageLastUpdated: projection.latest_pair.candidate.date,
    batchDatesText: dates.join(' / '),
    modelCount: projection.model_cards.length,
    latestPair: projection.latest_pair,
    modelCards: projection.model_cards.map((card) => ({
      ...card,
      personality_sentence: personalityCopyWithFallback(personalityCopy.sentences, card.personality_sentence_id),
    })),
    consensus: projection.consensus,
    stories: projection.stories.map((story) => ({
      ...story,
      editorial_sentence: editorialCopyWithFallback(storyCopy.editorial_sentences, story.editorial_sentence_id),
    })),
  };
}

export function formatModelScore(score: number): string {
  return score.toFixed(1);
}

export function scoreBarWidth(score: number): string {
  return `${Math.max(0, Math.min(100, Math.round(score * 10)))}%`;
}
