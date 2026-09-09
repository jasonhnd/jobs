/** Exact score-batch identity used to scope reviewed /models story copy. */
export interface ModelEditorialBatchIdentity {
  readonly model: string;
  readonly date: string;
}

/** Vendor-flagship panel identity (mms-8.21). Entries are panel order (date asc). */
export interface ModelEditorialPanelIdentity {
  readonly entries: readonly ModelEditorialBatchIdentity[];
}

export const DEFAULT_MODEL_STORY_EDITORIAL_ID = 'default_latest_pair_split';

/**
 * Curated interpretation is evidence for one reviewed panel, not for an
 * occupation in every future model set. Keep model and batch date for every
 * panel entry so a re-run cannot inherit prose from another run.
 */
export function modelStoryEditorialSentenceId(
  occupationId: number,
  panel: ModelEditorialPanelIdentity,
): string {
  return `${occupationId}__${panel.entries.map((entry) => `${entry.model}@${entry.date}`).join('__')}`;
}
