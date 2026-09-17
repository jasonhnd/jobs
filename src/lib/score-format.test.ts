/**
 * score-format.test.ts — pin the display contract for AI-impact scores.
 *
 * The regression this guards: a consensus mean is a float, and interpolating
 * it raw produced `6.233333333333334/10` on 793 of 839 built pages, in visible
 * copy and in JSON-LD.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { EMDASH, formatRiskScore, formatRiskValue } from './score-format.js';
import { displayScore } from '../data/lib/banker-round.js';

describe('formatRiskScore', () => {
  test('rounds a consensus mean to one decimal', () => {
    assert.equal(formatRiskScore(6.233333333333334), '6.2/10');
    assert.equal(formatRiskScore(5.8999999999999995), '5.9/10');
    assert.equal(formatRiskScore(4.6000000000000005), '4.6/10');
    assert.equal(formatRiskScore(3.3000000000000003), '3.3/10');
  });

  test('a whole number keeps no trailing zero, as the occupation page does', () => {
    assert.equal(formatRiskScore(6), '6/10');
    assert.equal(formatRiskScore(6.0), '6/10');
  });

  test('missing and non-finite scores render as an em dash', () => {
    assert.equal(formatRiskScore(null), EMDASH);
    assert.equal(formatRiskScore(undefined), EMDASH);
    assert.equal(formatRiskScore(Number.NaN), EMDASH);
    assert.equal(formatRiskScore(Number.POSITIVE_INFINITY), EMDASH);
  });

  test('0 is a score, not a missing value', () => {
    assert.equal(formatRiskScore(0), '0/10');
  });

  test('agrees with displayScore — one rounding rule site-wide', () => {
    for (const v of [0, 1.25, 2.35, 4.45, 6.55, 9.433333333333334]) {
      assert.equal(formatRiskScore(v), `${displayScore(v)}/10`);
    }
  });

  test('banker rounding, not round-half-up', () => {
    // 2.25 -> 2.2 (round half to even), where toFixed(1) would give 2.3.
    assert.equal(formatRiskValue(2.25), String(displayScore(2.25)));
  });
});

describe('formatRiskValue', () => {
  test('returns the rounded number without a denominator', () => {
    assert.equal(formatRiskValue(6.233333333333334), '6.2');
    assert.equal(formatRiskValue(null), EMDASH);
  });
});
