/**
 * Locked C-facing consensus copy and the latest-observation threshold.
 * Strings are verbatim from docs/CONSENSUS_SCORE.md (mms-6-doc / #364).
 * Only `{X.X}` is filled at runtime.
 */
import { displayScore } from '../data/lib/banker-round.js';

/** |latest − consensus| at or above this shows the 最新観測 row. */
export const LATEST_OBSERVATION_THRESHOLD = 1.0;

export const CONSENSUS_HEADLINE_LABEL = '複数のAIによる総合';

export const CONSENSUS_AGING_NOTE =
  'この総合値には、採点日から6ヶ月を超えた票が含まれています。';

export const CONSENSUS_DIM_NOTE = '各次元は複数のAIによる採点の中央値です。';

export const SCORE_HISTORY_DETAILS_ID = 'score-history-details';

export function formatConsensusScore(value: number): string {
  return String(displayScore(value));
}

export function formatConsensusScoreFixed1(value: number): string {
  return displayScore(value).toFixed(1);
}

export function formatLatestObservationLine(
  latestTransformation: number,
  latestDelta: number,
): string | null {
  if (Math.abs(latestDelta) < LATEST_OBSERVATION_THRESHOLD) return null;
  const shown = formatConsensusScore(latestTransformation);
  if (latestDelta > 0) {
    return `最新のAIは、この仕事の変化をより大きく見ています（${shown}）`;
  }
  return `最新のAIは、この仕事の変化をより小さく見ています（${shown}）`;
}
