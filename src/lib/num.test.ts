/**
 * num.test.ts — pin fmtInt + safeMean contracts that 6 + 3 legacy copies
 * implemented identically.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fmtInt, safeMean } from './num.js';

describe('fmtInt', () => {
  test('null and undefined render as em-dash', () => {
    assert.equal(fmtInt(null), '—');
    assert.equal(fmtInt(undefined), '—');
  });

  test('integer values group with en-US thousands separators', () => {
    assert.equal(fmtInt(0), '0');
    assert.equal(fmtInt(1234), '1,234');
    assert.equal(fmtInt(1_234_567), '1,234,567');
  });

  test('truncates fractional part (does not round)', () => {
    assert.equal(fmtInt(12.7), '12');
    assert.equal(fmtInt(99.99), '99');
  });

  test('handles negative integers', () => {
    assert.equal(fmtInt(-1234), '-1,234');
  });
});

describe('safeMean', () => {
  test('empty array returns 0', () => {
    assert.equal(safeMean([]), 0);
  });

  test('all-null array returns 0', () => {
    assert.equal(safeMean([null, undefined, null]), 0);
  });

  test('plain numeric array returns mean', () => {
    assert.equal(safeMean([1, 2, 3, 4]), 2.5);
  });

  test('null/undefined entries are filtered out', () => {
    // (1 + 3 + 5) / 3 = 3
    assert.equal(safeMean([1, null, 3, undefined, 5]), 3);
  });

  test('returns 0, not NaN, for boundary cases', () => {
    assert.equal(safeMean([null]), 0);
    assert.equal(safeMean([undefined, null]), 0);
  });
});
