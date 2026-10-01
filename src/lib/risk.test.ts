/**
 * risk.test.ts — pin the riskClass contract: null→'mid'; otherwise the band
 * of the DISPLAYED value (displayScore, one-decimal banker rounding) with
 * low < 4.0 <= mid < 7.0 <= high (#631).
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

  test('boundary: a value displayed below 4.0 is low; displayed 4.0 is mid', () => {
    assert.equal(riskClass(3.5), 'low');
    assert.equal(riskClass(3.94), 'low'); // displays 3.9
    assert.equal(riskClass(3.9333333333333336), 'low'); // displays 3.9
    assert.equal(riskClass(3.95), 'mid'); // displays 4.0
    assert.equal(riskClass(3.9666666666666663), 'mid'); // three-vendor mean, displays 4.0
    assert.equal(riskClass(4.0), 'mid');
  });

  test('boundary: a value displayed below 7.0 is mid; displayed 7.0 is high', () => {
    assert.equal(riskClass(6.5), 'mid');
    assert.equal(riskClass(6.94), 'mid'); // displays 6.9
    assert.equal(riskClass(6.95), 'high'); // displays 7.0
    assert.equal(riskClass(6.966666666666667), 'high'); // displays 7.0
    assert.equal(riskClass(7.0), 'high');
  });
});
