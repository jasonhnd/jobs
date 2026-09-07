import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { bankerRound, displayScore } from './banker-round.js';

test('bankerRound: FP near-halfway from real computation', () => {
  // (3.236 + 3.127 + 3.073 + 2.934) / 4 / 5 * 100
  // → 61.85000000000001 (slightly above true 61.85)
  // Banker's halfway-to-even applies only to genuine halves; this isn't one,
  // so it rounds toward the higher representable.
  const fpValue = (3.236 + 3.127 + 3.073 + 2.934) / 4 / 5 * 100;
  assert.equal(bankerRound(fpValue, 1), 61.9);
});

test('bankerRound: 1 decimal place — FP-aware half rounding', () => {
  // 0.15 stored as 0.1499... → rounds to 0.1
  assert.equal(bankerRound(0.15, 1), 0.1);
  // 0.05 stored as 0.0500...278 → rounds to 0.1
  assert.equal(bankerRound(0.05, 1), 0.1);
});

test('bankerRound: exact halfway → round to even', () => {
  // 52.25 is exactly representable in FP (no fractional precision lost).
  // V8 toFixed: '52.3' (round away from zero). bankerRound: '52.2' (522 even).
  assert.equal(bankerRound(52.25, 1), 52.2);
  assert.equal(bankerRound(58.25, 1), 58.2);
  assert.equal(bankerRound(2.5, 0), 2);
  assert.equal(bankerRound(3.5, 0), 4);
});

test('bankerRound: 2 decimal places — FP-aware half rounding', () => {
  // 1.005 stored as 1.0049... → rounds to 1.0
  assert.equal(bankerRound(1.005, 2), 1.0);
  assert.equal(bankerRound(1.234, 2), 1.23);
  assert.equal(bankerRound(1.236, 2), 1.24);
});

test('bankerRound: integers pass through', () => {
  assert.equal(bankerRound(5, 0), 5);
  assert.equal(bankerRound(5, 1), 5);
});

test('bankerRound: zero', () => {
  assert.equal(bankerRound(0, 1), 0);
  assert.equal(bankerRound(0, 2), 0);
});

test('bankerRound: clean decimals', () => {
  assert.equal(bankerRound(2.5, 1), 2.5);
  assert.equal(bankerRound(3.14, 2), 3.14);
});

test('bankerRound: ndigits=0 with negative halfway → round to even', () => {
  // -2.5 halfway → -2 (even); -3.5 halfway → -4 (even).
  assert.equal(bankerRound(-2.5, 0), -2);
  assert.equal(bankerRound(-3.5, 0), -4);
});

test('bankerRound: ndigits=0 with positive halfway → round to even', () => {
  // Already covered earlier but pin explicit ndigits=0 contract.
  assert.equal(bankerRound(0.5, 0), 0);
  assert.equal(bankerRound(1.5, 0), 2);
  assert.equal(bankerRound(4.5, 0), 4);
});

test('bankerRound: NaN / Infinity pass through unchanged', () => {
  assert.ok(Number.isNaN(bankerRound(NaN, 2)));
  assert.equal(bankerRound(Infinity, 2), Infinity);
  assert.equal(bankerRound(-Infinity, 2), -Infinity);
});

test('bankerRound: negative ndigits clamps to 0', () => {
  // ndigits = -3 should be treated as 0.
  assert.equal(bankerRound(2.5, -3), 2);
  assert.equal(bankerRound(3.5, -3), 4);
});

test('displayScore: even-count median 4.25 → 4.2 (half to even)', () => {
  assert.equal(displayScore(4.25), 4.2);
  assert.equal(displayScore(6.8), 6.8);
  assert.equal(displayScore(5.05), 5.0);
});
