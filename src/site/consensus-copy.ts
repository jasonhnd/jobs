/**
 * Locked C-facing consensus copy and the latest-observation threshold.
 * Strings are verbatim from docs/CONSENSUS_SCORE.md 「確定文案（mms-8）」 (#409).
 * Only `{X.X}` / dates / counts are filled at runtime.
 */
import { displayScore } from '../data/lib/banker-round.js';

/** |latest − consensus| at or above this shows the 最新観測 row. */
export const LATEST_OBSERVATION_THRESHOLD = 1.0;

export const CONSENSUS_HEADLINE_LABEL = '複数のAIによる総合';

export const CONSENSUS_AGING_NOTE =
  'この総合値には、採点日から6ヶ月を超えた採点が含まれています。';

export const CONSENSUS_DIM_NOTE = '各次元は複数のAIによる採点の平均です。';

export const CONSENSUS_FAQ_SENTENCE =
  '本サイトの AI 影響度は複数のAIモデルによる採点の総合値（独自分析・非公式）です。';

export const CONSENSUS_FAQ_DETAIL =
  '現在は、3社のAIそれぞれの最新モデルによる採点の平均を公開値としています。';

export const CONSENSUS_STANDARD_FORMAL =
  '本サイトの公開値は、各次元および変化の大きさ・仕事が減るリスクを、現在は3社のAIそれぞれの最新モデルによる採点の平均として出します。総合の変化の大きさを mean(D1, D2) から再計算しません。';

/** /models hub card label (mms-6e). */
export const MODELS_HUB_NOW_LABEL = '現行の総合';

export const MODELS_HUB_VENDOR_COUNT_LABEL = '採点した会社';

export const MODELS_HUB_VENDORS_HEADING = '各社の最新モデル';

export const MODELS_HUB_VENDORS_INTRO =
  '公開値は、3社それぞれの最新モデルによる採点の平均です。各社の以前のモデルは、カードの下で開けます。';

export const MODELS_HUB_HISTORY_EMPTY = '以前のモデルはありません';

export function formatModelsHubHistorySummary(count: number): string {
  return `以前のモデル（${count}件）`;
}

export function formatModelsHubContrastCopy(comparedCount: number): string {
  return `3社の最新モデルが共通する ${comparedCount} 職業を比べると、いくつかの職業をまったく違う角度から見ています。次のカードでは、差が大きかった職業を、3つのモデルの理由文そのままと一緒に読みます。`;
}

export function formatModelsHubLead(modelCount: number, coverageText: string): string {
  return `3社のAIそれぞれの最新モデルによる採点を平均しています。これまで${modelCount}つのAIモデルの採点を公開し、各回の対象は${coverageText}です。AIの判断にはそれぞれの見方があり、同じ職業でも、現場性を重く見るか、手順化や自動化の進みやすさを重く見るかで、仕事の未来は違って見えます。`;
}

export function formatModelsHubDescription(coverageText: string): string {
  return `3社のAIそれぞれの最新モデルによる採点を平均した、各回${coverageText}の結果から、判断が一致した職業・大きく分かれた職業を読むモデル比較ページです。`;
}

export const MODELS_RUN_IN_PANEL_NOTE =
  'このモデルの採点は、現在の公開値（3社の最新モデルの平均）に含まれています。';

export const MODELS_RUN_HISTORY_NOTE =
  'このモデルの採点は履歴として公開しています。現在の公開値には含まれていません。';

export const ANSWERS_HUB_PUBLIC_VALUE =
  '公開値: 複数のAIによる総合（3社の最新モデルの平均）';

/** Switch-release on-site note (mms-6g). Two paragraphs, verbatim. */
export const CONSENSUS_SWITCH_NOTE_HEADING = 'スコアの算出方法を変更しました';

export const CONSENSUS_SWITCH_NOTE_LEAD =
  'AI 影響度の算出方法を変更しました。これまでは、最新の1件の採点をサイト全体の公開値として採用していました。これからは、複数のAIによる採点の中央値を公開値とします。最新の採点が公開値から大きく外れる職業に限り、「最新のAIは…」という行でその見解を示します。';

export const CONSENSUS_SWITCH_NOTE_IMPACT =
  '今回の変更では、全職業の平均は 5.23 から 4.68 になります。公開値が 1.0 以上変わる職業は 100、リスク帯が変わる職業は 133 です。新しいAIを1件追加しても、公開値全体が、その1件の採点で入れ替わらないようにするための変更です。';

/** Fifth-vote landing note (mms-7c / #387). No model names. */
export const CONSENSUS_FIFTH_VOTE_NOTE_HEADING = '総合の票を1件増やしました';

export const CONSENSUS_FIFTH_VOTE_NOTE_LEAD =
  '複数のAIによる総合に、採点を1件追加しました。公開値はこれまでどおり、複数の採点の中央値です。';

export const CONSENSUS_FIFTH_VOTE_NOTE_IMPACT =
  '今回の追加では、全職業の平均は 4.68 から 4.73 になります。公開値が 0.5 以上変わる職業は 32、リスク帯が変わる職業は 40 です。公開値が 1.0 以上変わる職業はありません。';

/** Vendor-flagship switch + Fable 5.1 landing note (mms-8.28). No model names. */
export const CONSENSUS_FLAGSHIP_SWITCH_NOTE_HEADING =
  'スコアの算出方法を変更し、採点を1件追加しました';

export const CONSENSUS_FLAGSHIP_SWITCH_NOTE_LEAD =
  'AI 影響度の算出方法を変更しました。これまでは、複数のAIによる採点の中央値を公開値としていました。これからは、3社のAIそれぞれの最新モデルによる採点の平均を公開値とします。あわせて、採点を1件追加しました。以前のモデルの採点は、モデル比較と各職業の履歴に残します。';

export const CONSENSUS_FLAGSHIP_SWITCH_NOTE_IMPACT =
  '今回の変更では、全職業の平均は 4.73 から 4.67 になります。公開値が 0.5 以上変わる職業は 32、リスク帯が変わる職業は 33 です。公開値が 1.0 以上変わる職業は 1 です。';

/** Vendor flagship swap (mms-8.35). No model names. */
export const CONSENSUS_VENDOR_UPDATE_NOTE_HEADING = '総合の採点を1件更新しました';

export const CONSENSUS_VENDOR_UPDATE_NOTE_LEAD =
  '3社のAIの最新モデルのうち、1社の採点を新しいモデルの採点に更新しました。公開値はこれまでどおり、3社の最新モデルによる採点の平均です。';

export const CONSENSUS_VENDOR_UPDATE_NOTE_IMPACT =
  '今回の変更では、全職業の平均は 4.67 から 4.69 になります。公開値が 0.5 以上変わる職業は 8、リスク帯が変わる職業は 17 です。公開値が 1.0 以上変わる職業はありません。';

export function formatRunDateJa(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate;
  return `${year}年${month}月${day}日`;
}

export function formatConsensusFooterLine(latestRunDate: string): string {
  return `AI 影響度：複数のAIモデルによる総合（AIOIS-10・最新採点 ${latestRunDate}）`;
}

export function formatConsensusCitation(latestRunDate: string): string {
  return `（出典：厚生労働省 jobtag ＋ AIOIS-10、複数のAIによる総合・3社の最新モデルの平均、最新採点 ${formatRunDateJa(latestRunDate)}。モデル別の内訳は /models）`;
}

export function formatHomeFaqCurrentValue(latestRunDate: string): string {
  return `現在の公開値は複数のAIによる総合（AIOIS-10、3社の最新モデルの平均、最新採点 ${latestRunDate}）です。モデル別の内訳は /models。`;
}

export function formatScoreHistorySummary(count: number): string {
  return `モデル別の採点を表示（${count}件）`;
}

export function formatScoreHistoryCurrentLine(latestRunDate: string): string {
  return `3社の最新モデルの平均 · 最新採点 ${formatRunDateJa(latestRunDate)}`;
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
