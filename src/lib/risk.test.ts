/**
 * risk.test.ts — pin the riskClass contract that 5 legacy copies all
 * implemented identically (null→'mid', ≤3→'low', ≤6→'mid', else→'high').
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { riskClass } from './risk.js';

describe('riskClass', () => {
  test('null defaults to mid (template-safe)', () => {
    assert.equal(riskClass(null), 'mid');
  });

  test('0..3 maps to low', () => {
    for (const v of [0, 1, 2, 3]) {
      assert.equal(riskClass(v), 'low', `riskClass(${v})`);
    }
  });

  test('4..6 maps to mid', () => {
    for (const v of [4, 5, 6]) {
      assert.equal(riskClass(v), 'mid', `riskClass(${v})`);
    }
  });

  test('7..10 maps to high', () => {
    for (const v of [7, 8, 9, 10]) {
      assert.equal(riskClass(v), 'high', `riskClass(${v})`);
    }
  });

  test('boundary check: 3.5 is mid (≤3 threshold, not ≤3.9)', () => {
    // ai_risk is integer in practice; this pins the documented
    // contract that the UI threshold is integer-strict.
    assert.equal(riskClass(3.5), 'mid');
  });

  test('boundary check: 6.5 is high', () => {
    assert.equal(riskClass(6.5), 'high');
  });
});
