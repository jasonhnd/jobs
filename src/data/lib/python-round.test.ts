import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pythonRound } from './python-round.js';

// Behavior verified against actual Python 3.12 output.

test('pythonRound: FP near-halfway from real computation', () => {
  // (3.236 + 3.127 + 3.073 + 2.934) / 4 / 5 * 100
  // → 61.85000000000001 (slightly above true 61.85)
  // → Python rounds to 61.9 (the bug that motivated this lib)
  const fpValue = (3.236 + 3.127 + 3.073 + 2.934) / 4 / 5 * 100;
  assert.equal(pythonRound(fpValue, 1), 61.9);
});

test('pythonRound: 1 decimal place — FP-aware half rounding', () => {
  // 0.15 stored as 0.1499... → rounds to 0.1
  assert.equal(pythonRound(0.15, 1), 0.1);
  // 0.05 stored as 0.0500...278 → rounds to 0.1
  assert.equal(pythonRound(0.05, 1), 0.1);
});

test('pythonRound: exact halfway → banker rounding', () => {
  // 52.25 is exactly representable in FP (no fractional precision lost).
  // Python: round(52.25, 1) → 52.2 (522 is even).
  // V8 toFixed: '52.3' (round away from zero).
  // pythonRound: must match Python.
  assert.equal(pythonRound(52.25, 1), 52.2);
  assert.equal(pythonRound(58.25, 1), 58.2);
  assert.equal(pythonRound(2.5, 0), 2);
  assert.equal(pythonRound(3.5, 0), 4);
});

test('pythonRound: 2 decimal places — FP-aware half rounding', () => {
  // 1.005 stored as 1.0049... → rounds to 1.0
  assert.equal(pythonRound(1.005, 2), 1.0);
  assert.equal(pythonRound(1.234, 2), 1.23);
  assert.equal(pythonRound(1.236, 2), 1.24);
});

test('pythonRound: integers pass through', () => {
  assert.equal(pythonRound(5, 0), 5);
  assert.equal(pythonRound(5, 1), 5);
});

test('pythonRound: zero', () => {
  assert.equal(pythonRound(0, 1), 0);
  assert.equal(pythonRound(0, 2), 0);
});

test('pythonRound: clean decimals', () => {
  assert.equal(pythonRound(2.5, 1), 2.5);
  assert.equal(pythonRound(3.14, 2), 3.14);
});
