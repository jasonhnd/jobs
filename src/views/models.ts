import { ModelsDeepProjectionSchema, type ModelsDeepProjectionShape } from '@/lib/projection-schemas';
import { formatModelDisplay, formatVendorDisplay, runSlug, SCORE_PANEL, type ScorePanel } from '@/site/score-attribution';
import {
  CONSENSUS_AGING_NOTE,
  CONSENSUS_FAQ_SENTENCE,
  CONSENSUS_HEADLINE_LABEL,
  MODELS_HUB_HISTORY_EMPTY,
  MODELS_HUB_NOW_LABEL,
  formatModelsHubContrastCopy,
  formatModelsHubDescription,
  formatModelsHubHistorySummary,
  formatModelsHubLead,
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

export interface ModelsPanelEntryView {
  readonly provider: string;
  readonly vendorDisplay: string;
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly covered_count: number;
  readonly personality_sentence_id: string;
  readonly href: string;
  readonly personality_sentence: string;
}

export interface ModelsHistoryEntryView {
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly covered_count: number;
  readonly href: string;
}

export interface ModelsVendorLane {
  readonly provider: string;
  readonly vendorDisplay: string;
  readonly latest: ModelsPanelEntryView;
  readonly history: ReadonlyArray<ModelsHistoryEntryView>;
  readonly historySummary: string;
}

export interface ModelsStoryScoreView {
  readonly provider: string;
  readonly model: string;
  readonly modelDisplay: string;
  readonly transformation: number;
  readonly rationale_ja: string;
  readonly href: string;
}

export interface ModelsStoryView {
  readonly id: number;
  readonly title_ja: string;
  readonly href: string;
  readonly scores: ReadonlyArray<ModelsStoryScoreView>;
  readonly spread: number;
  readonly editorial_sentence: string;
  /** 8.23 shim — first/last panel scores until the hub markup loops scores. */
  readonly editorial_sentence_id: string;
  readonly baseline_transformation: number;
  readonly candidate_transformation: number;
  readonly baseline_rationale_ja: string;
  readonly candidate_rationale_ja: string;
}

/** 8.23 shim for the current two-column hub markup. */
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
  readonly coverageRangeText: string;
  readonly lead: string;
  readonly description: string;
  readonly consensusSummary: ModelsConsensusSummary;
  readonly lanes: ReadonlyArray<ModelsVendorLane>;
  readonly panel: ReadonlyArray<ModelsPanelEntryView>;
  readonly comparedCount: number;
  readonly contrastCopy: string;
  readonly consensus: ModelsDeepProjection['consensus'];
  readonly stories: ReadonlyArray<ModelsStoryView>;
  /** 8.23 shims so models.astro keeps compiling until the hub rewrite. */
  readonly latestPair: ModelsFeatureLatestPair;
  readonly currentModel: ModelsPanelEntryView;
  readonly modelCards: ReadonlyArray<ModelsPanelEntryView>;
  readonly modelRoster: ReadonlyArray<ModelsPanelEntryView>;
  readonly dateRangeText: string;
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

function batchHref(model: string, date: string): string {
  return `/models/${runSlug({ model, runDate: date })}`;
}

function toPanelEntryView(
  entry: ModelsDeepProjection['panel']['entries'][number],
  personalityCopy: ModelPersonalityCopy,
): ModelsPanelEntryView {
  return {
    provider: entry.provider,
    vendorDisplay: formatVendorDisplay(entry.provider),
    model: entry.model,
    modelDisplay: formatModelDisplay(entry.model),
    date: entry.date,
    covered_count: entry.covered_count,
    personality_sentence_id: entry.personality_sentence_id,
    href: batchHref(entry.model, entry.date),
    personality_sentence: personalityCopyWithFallback(personalityCopy.sentences, entry.personality_sentence_id),
  };
}

function toHistoryEntryView(
  entry: ModelsDeepProjection['lanes'][number]['history'][number],
): ModelsHistoryEntryView {
  return {
    model: entry.model,
    modelDisplay: formatModelDisplay(entry.model),
    date: entry.date,
    covered_count: entry.covered_count,
    href: batchHref(entry.model, entry.date),
  };
}

function flattenBatches(lanes: ReadonlyArray<ModelsVendorLane>): ModelsPanelEntryView[] {
  const cards: ModelsPanelEntryView[] = [];
  for (const lane of lanes) {
    cards.push(lane.latest);
    for (const entry of lane.history) {
      cards.push({
        provider: lane.provider,
        vendorDisplay: lane.vendorDisplay,
        model: entry.model,
        modelDisplay: entry.modelDisplay,
        date: entry.date,
        covered_count: entry.covered_count,
        personality_sentence_id: 'default_neutral',
        href: entry.href,
        personality_sentence: '',
      });
    }
  }
  return cards.sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
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
  const panelEntries = projection.panel.entries.map((entry) => toPanelEntryView(entry, personalityCopy));
  const newestPanel = [...panelEntries].sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model)).at(-1);
  if (!newestPanel) {
    throw new Error('/models projection has no panel entries');
  }
  const lanes: ModelsVendorLane[] = projection.lanes.map((lane) => {
    const latest = toPanelEntryView(lane.latest, personalityCopy);
    const history = lane.history.map(toHistoryEntryView);
    return {
      provider: lane.provider,
      vendorDisplay: formatVendorDisplay(lane.provider),
      latest,
      history,
      historySummary: history.length === 0
        ? MODELS_HUB_HISTORY_EMPTY
        : formatModelsHubHistorySummary(history.length),
    };
  });
  const modelRoster = flattenBatches(lanes);
  const dates = modelRoster.map((card) => card.date);
  const coverages = modelRoster.map((card) => card.covered_count);
  const coverageRangeText = coverages.length === 1 || Math.min(...coverages) === Math.max(...coverages)
    ? `${newestPanel.covered_count}職業`
    : `${Math.min(...coverages)}〜${Math.max(...coverages)}職業`;
  const firstPanel = panelEntries[0]!;
  const lastPanel = panelEntries[panelEntries.length - 1]!;

  return {
    projectionJson: escapeInlineJson(JSON.stringify(projection)),
    pageLastUpdated: newestPanel.date,
    batchDatesText: dates.join(' / '),
    modelCount: modelRoster.length,
    coverageRangeText,
    lead: formatModelsHubLead(modelRoster.length, coverageRangeText),
    description: formatModelsHubDescription(coverageRangeText),
    consensusSummary: {
      label: MODELS_HUB_NOW_LABEL,
      headline: CONSENSUS_HEADLINE_LABEL,
      oneLiner: CONSENSUS_FAQ_SENTENCE,
      vendorCount: panel.vendorCount,
      latestRunDate: panel.latestRunDate,
      agingNote: panel.staleVendorCount > 0 ? CONSENSUS_AGING_NOTE : null,
      latestModelDisplay: newestPanel.modelDisplay,
      latestModelHref: newestPanel.href,
    },
    lanes,
    panel: panelEntries,
    comparedCount: projection.panel.compared_count,
    contrastCopy: formatModelsHubContrastCopy(projection.panel.compared_count),
    consensus: projection.consensus,
    stories: projection.stories.map((story) => {
      const first = story.scores[0]!;
      const last = story.scores[story.scores.length - 1]!;
      return {
        id: story.id,
        title_ja: story.title_ja,
        href: story.href,
        scores: story.scores.map((score, index) => ({
          provider: score.provider,
          model: score.model,
          modelDisplay: formatModelDisplay(score.model),
          transformation: score.transformation,
          rationale_ja: score.rationale_ja,
          href: panelEntries[index]?.href ?? batchHref(score.model, lastPanel.date),
        })),
        spread: story.spread,
        editorial_sentence: editorialCopyWithFallback(storyCopy.editorial_sentences, story, projection.panel),
        editorial_sentence_id: story.editorial_sentence_id,
        baseline_transformation: first.transformation,
        candidate_transformation: last.transformation,
        baseline_rationale_ja: first.rationale_ja,
        candidate_rationale_ja: last.rationale_ja,
      };
    }),
    latestPair: {
      baseline: { model: firstPanel.model, modelDisplay: firstPanel.modelDisplay, date: firstPanel.date },
      candidate: { model: lastPanel.model, modelDisplay: lastPanel.modelDisplay, date: lastPanel.date },
      compared_count: projection.panel.compared_count,
    },
    currentModel: newestPanel,
    modelCards: modelRoster,
    modelRoster,
    dateRangeText: dates.length === 1 ? dates[0]! : `${dates[0]} から ${dates[dates.length - 1]}`,
  };
}

export function formatModelScore(score: number): string {
  return score.toFixed(1);
}

export function scoreBarWidth(score: number): string {
  return `${Math.max(0, Math.min(100, Math.round(score * 10)))}%`;
}
