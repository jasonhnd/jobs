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
    latestPair: projection.latest_pair,
    modelCards: projection.model_cards.map((card) => ({
      ...card,
      personality_sentence: requireCopy(personalityCopy.sentences, card.personality_sentence_id, 'personality'),
    })),
    consensus: projection.consensus,
    stories: projection.stories.map((story) => ({
      ...story,
      editorial_sentence: requireCopy(storyCopy.editorial_sentences, story.editorial_sentence_id, 'editorial'),
    })),
  };
}

export function formatModelScore(score: number): string {
  return score.toFixed(1);
}

export function scoreBarWidth(score: number): string {
  return `${Math.max(0, Math.min(100, Math.round(score * 10)))}%`;
}
