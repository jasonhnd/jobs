/**
 * Signed band words (2026-10-08) follow the displayed one-decimal value.
 *
 * 3.9666… prints 4.0, so it is 「変化 中くらい」, not 「変化 小さい」.
 * docs/DATA_ARCHITECTURE.md and riskBand() are the rule. The brief's
 * "3.9667→小さい" disagrees with that display rule; this test follows
 * the display rule.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { displayScore } from '../data/lib/banker-round.js';
import { riskBand } from '../data/lib/bands.js';
import { RISK_BAND_WORD, riskBandWord, riskClass } from './risk.js';
import { EMDASH, formatRiskScoreLabel, formatShownMeanLabel } from './score-format.js';

describe('signed band words follow the displayed value', () => {
  test('named boundaries', () => {
    assert.equal(displayScore(3.9666666666666663), 4);
    assert.equal(riskBandWord(3.9666666666666663), '変化 中くらい');
    assert.equal(displayScore(3.95), 4);
    assert.equal(riskBandWord(3.95), '変化 中くらい');
    assert.equal(riskBandWord(4.0), '変化 中くらい');
    assert.equal(displayScore(3.9333333333333336), 3.9);
    assert.equal(riskBandWord(3.9333333333333336), '変化 小さい');
    assert.equal(displayScore(6.966666666666667), 7);
    assert.equal(riskBandWord(6.966666666666667), '変化 大きい');
    assert.equal(riskBandWord(7.0), '変化 大きい');
    assert.equal(riskBandWord(6.9), '変化 中くらい');
    assert.equal(displayScore(4.966666666666667), 5);
    assert.equal(riskBandWord(4.966666666666667), '変化 中くらい');
    assert.equal(riskBandWord(0.3), '変化 小さい');
    assert.equal(riskBandWord(null), null);
    assert.equal(riskBandWord(undefined), null);
    assert.equal(riskBandWord(Number.NaN), null);
  });

  test('the word matches riskBand and riskClass for every k/30', () => {
    for (let k = 0; k <= 300; k += 1) {
      const x = k / 30;
      const band = riskBand(x);
      assert.equal(riskClass(x), band, `riskClass(${x})`);
      assert.ok(band);
      assert.equal(riskBandWord(x), RISK_BAND_WORD[band], `word(${x})`);
    }
  });

  test('a score label is the printed number plus the signed word', () => {
    assert.equal(formatRiskScoreLabel(8.1), '8.1/10 変化 大きい');
    assert.equal(formatRiskScoreLabel(4.266666666666667), '4.3/10 変化 中くらい');
    assert.equal(formatRiskScoreLabel(3.9666666666666663), '4/10 変化 中くらい');
    assert.equal(formatRiskScoreLabel(0.3), '0.3/10 変化 小さい');
    assert.equal(formatRiskScoreLabel(null), EMDASH);
    assert.equal(formatShownMeanLabel(3.5), '3.5/10 変化 小さい');
    assert.equal(formatShownMeanLabel(4), '4.0/10 変化 中くらい');
    assert.equal(formatShownMeanLabel(7), '7.0/10 変化 大きい');
  });
});
