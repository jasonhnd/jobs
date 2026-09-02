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

export const CONSENSUS_FAQ_SENTENCE =
  '本サイトの AI 影響度は複数のAIモデルによる採点の総合値（独自分析・非公式）です。';

export const CONSENSUS_STANDARD_FORMAL =
  '本サイトの公開値は、各次元および変化の大きさ・仕事が減るリスクを、複数のAIによる採点の中央値として出します。総合の変化の大きさを mean(D1, D2) から再計算しません。';

export function formatRunDateJa(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate;
  return `${year}年${month}月${day}日`;
}

export function formatConsensusFooterLine(latestRunDate: string): string {
  return `AI 影響度：複数のAIモデルによる総合（AIOIS-10・最新採点 ${latestRunDate}）`;
}

export function formatConsensusCitation(voteCount: number, latestRunDate: string): string {
  return `（出典：厚生労働省 jobtag ＋ AIOIS-10、複数のAIによる総合・${voteCount}票、最新採点 ${formatRunDateJa(latestRunDate)}。モデル別の内訳は /models）`;
}

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
