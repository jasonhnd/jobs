/** Exact score-batch identity used to scope reviewed /models story copy. */
export interface ModelEditorialBatchIdentity {
  readonly model: string;
  readonly date: string;
}

export interface ModelEditorialPairIdentity {
  readonly baseline: ModelEditorialBatchIdentity;
  readonly candidate: ModelEditorialBatchIdentity;
}

export const DEFAULT_MODEL_STORY_EDITORIAL_ID = 'default_latest_pair_split';

/**
 * Curated interpretation is evidence for one reviewed comparison, not for an
 * occupation in every future model pair. Keep both model and batch date in the
 * key so a model re-run cannot accidentally inherit prose from another run.
 */
export function modelStoryEditorialSentenceId(
  occupationId: number,
  pair: ModelEditorialPairIdentity,
): string {
  return (
    `${occupationId}__${pair.baseline.model}@${pair.baseline.date}` +
    `__${pair.candidate.model}@${pair.candidate.date}`
  );
}
