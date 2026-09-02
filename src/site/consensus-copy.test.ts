import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  CONSENSUS_AGING_NOTE,
  CONSENSUS_FAQ_SENTENCE,
  CONSENSUS_HEADLINE_LABEL,
  CONSENSUS_STANDARD_FORMAL,
  LATEST_OBSERVATION_THRESHOLD,
  formatConsensusCitation,
  formatConsensusFooterLine,
  formatLatestObservationLine,
} from './consensus-copy.js';

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
      'この総合値には、採点日から6ヶ月を超えた票が含まれています。',
    );
  });

  test('footer, FAQ, and citation strings match the locked copy', () => {
    assert.equal(
      CONSENSUS_FAQ_SENTENCE,
      '本サイトの AI 影響度は複数のAIモデルによる採点の総合値（独自分析・非公式）です。',
    );
    assert.equal(
      formatConsensusFooterLine('2026-07-26'),
      'AI 影響度：複数のAIモデルによる総合（AIOIS-10・最新採点 2026-07-26）',
    );
    assert.equal(
      formatConsensusCitation(4, '2026-07-26'),
      '（出典：厚生労働省 jobtag ＋ AIOIS-10、複数のAIによる総合・4票、最新採点 2026年7月26日。モデル別の内訳は /models）',
    );
    assert.equal(
      CONSENSUS_STANDARD_FORMAL,
      '本サイトの公開値は、各次元および変化の大きさ・仕事が減るリスクを、複数のAIによる採点の中央値として出します。総合の変化の大きさを mean(D1, D2) から再計算しません。',
    );
  });
});
