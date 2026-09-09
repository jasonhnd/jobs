import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ANSWERS_HUB_PUBLIC_VALUE,
  CONSENSUS_AGING_NOTE,
  CONSENSUS_DIM_NOTE,
  CONSENSUS_FAQ_DETAIL,
  CONSENSUS_FAQ_SENTENCE,
  CONSENSUS_HEADLINE_LABEL,
  CONSENSUS_STANDARD_FORMAL,
  LATEST_OBSERVATION_THRESHOLD,
  MODELS_HUB_NOW_LABEL,
  MODELS_HUB_VENDOR_COUNT_LABEL,
  MODELS_RUN_HISTORY_NOTE,
  MODELS_RUN_IN_PANEL_NOTE,
  CONSENSUS_SWITCH_NOTE_HEADING,
  CONSENSUS_SWITCH_NOTE_LEAD,
  CONSENSUS_SWITCH_NOTE_IMPACT,
  CONSENSUS_FIFTH_VOTE_NOTE_HEADING,
  CONSENSUS_FIFTH_VOTE_NOTE_LEAD,
  CONSENSUS_FIFTH_VOTE_NOTE_IMPACT,
  formatConsensusCitation,
  formatConsensusFooterLine,
  formatHomeFaqCurrentValue,
  formatLatestObservationLine,
  formatScoreHistoryCurrentLine,
  formatScoreHistorySummary,
} from './consensus-copy.js';
import * as copy from './consensus-copy.js';

describe('formatLatestObservationLine', () => {
  test('omits the row when |Δ| is below the locked threshold', () => {
    assert.equal(formatLatestObservationLine(5.0, 0.9), null);
    assert.equal(formatLatestObservationLine(5.0, -0.99), null);
  });

  test('shows 大きく when latest is above consensus by the threshold', () => {
    assert.equal(
      formatLatestObservationLine(6.8, 2.55),
      '最新のAIは、この仕事の変化をより大きく見ています（6.8）',
    );
    assert.equal(LATEST_OBSERVATION_THRESHOLD, 1.0);
  });

  test('shows 小さく when latest is below consensus by the threshold', () => {
    assert.equal(
      formatLatestObservationLine(3.4, -1.0),
      '最新のAIは、この仕事の変化をより小さく見ています（3.4）',
    );
  });

  test('locked headline and aging strings are verbatim', () => {
    assert.equal(CONSENSUS_HEADLINE_LABEL, '複数のAIによる総合');
    assert.equal(
      CONSENSUS_AGING_NOTE,
      'この総合値には、採点日から6ヶ月を超えた採点が含まれています。',
    );
  });

  test('footer, FAQ, and citation strings match the locked copy', () => {
    assert.equal(
      CONSENSUS_FAQ_SENTENCE,
      '本サイトの AI 影響度は複数のAIモデルによる採点の総合値（独自分析・非公式）です。',
    );
    assert.equal(
      CONSENSUS_FAQ_DETAIL,
      '現在は、3社のAIそれぞれの最新モデルによる採点の平均を公開値としています。',
    );
    assert.equal(
      formatConsensusFooterLine('2026-07-26'),
      'AI 影響度：複数のAIモデルによる総合（AIOIS-10・最新採点 2026-07-26）',
    );
    assert.equal(
      formatConsensusCitation('2026-07-26'),
      '（出典：厚生労働省 jobtag ＋ AIOIS-10、複数のAIによる総合・3社の最新モデルの平均、最新採点 2026年7月26日。モデル別の内訳は /models）',
    );
    assert.equal(
      formatHomeFaqCurrentValue('2026-09-07'),
      '現在の公開値は複数のAIによる総合（AIOIS-10、3社の最新モデルの平均、最新採点 2026-09-07）です。モデル別の内訳は /models。',
    );
    assert.equal(formatScoreHistorySummary(3), 'モデル別の採点を表示（3件）');
    assert.equal(
      formatScoreHistoryCurrentLine('2026-07-26'),
      '3社の最新モデルの平均 · 最新採点 2026年7月26日',
    );
    assert.equal(
      CONSENSUS_STANDARD_FORMAL,
      '本サイトの公開値は、各次元および変化の大きさ・仕事が減るリスクを、現在は3社のAIそれぞれの最新モデルによる採点の平均として出します。総合の変化の大きさを mean(D1, D2) から再計算しません。',
    );
    assert.equal(CONSENSUS_DIM_NOTE, '各次元は複数のAIによる採点の平均です。');
    assert.equal(MODELS_HUB_NOW_LABEL, '現行の総合');
    assert.equal(MODELS_HUB_VENDOR_COUNT_LABEL, '採点した会社');
    assert.equal(
      MODELS_RUN_IN_PANEL_NOTE,
      'このモデルの採点は、現在の公開値（3社の最新モデルの平均）に含まれています。',
    );
    assert.equal(
      MODELS_RUN_HISTORY_NOTE,
      'このモデルの採点は履歴として公開しています。現在の公開値には含まれていません。',
    );
    assert.equal(
      ANSWERS_HUB_PUBLIC_VALUE,
      '公開値: 複数のAIによる総合（3社の最新モデルの平均）',
    );
    assert.equal('MODELS_RUN_VOTE_NOTE' in copy, false);
    assert.equal(CONSENSUS_SWITCH_NOTE_HEADING, 'スコアの算出方法を変更しました');
    assert.equal(
      CONSENSUS_SWITCH_NOTE_LEAD,
      'AI 影響度の算出方法を変更しました。これまでは、最新の1件の採点をサイト全体の公開値として採用していました。これからは、複数のAIによる採点の中央値を公開値とします。最新の採点が公開値から大きく外れる職業に限り、「最新のAIは…」という行でその見解を示します。',
    );
    assert.equal(
      CONSENSUS_SWITCH_NOTE_IMPACT,
      '今回の変更では、全職業の平均は 5.23 から 4.68 になります。公開値が 1.0 以上変わる職業は 100、リスク帯が変わる職業は 133 です。新しいAIを1件追加しても、公開値全体が、その1件の採点で入れ替わらないようにするための変更です。',
    );
    assert.equal(CONSENSUS_FIFTH_VOTE_NOTE_HEADING, '総合の票を1件増やしました');
    assert.equal(
      CONSENSUS_FIFTH_VOTE_NOTE_LEAD,
      '複数のAIによる総合に、採点を1件追加しました。公開値はこれまでどおり、複数の採点の中央値です。',
    );
    assert.equal(
      CONSENSUS_FIFTH_VOTE_NOTE_IMPACT,
      '今回の追加では、全職業の平均は 4.68 から 4.73 になります。公開値が 0.5 以上変わる職業は 32、リスク帯が変わる職業は 40 です。公開値が 1.0 以上変わる職業はありません。',
    );
  });
});
