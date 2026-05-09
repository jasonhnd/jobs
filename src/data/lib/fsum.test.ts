import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fsum, fmean } from './fsum.js';

test('fsum: canonical Neumaier example sums to the closer-representable double', () => {
  const xs = [2.898, 2.673, 2.878, 3.021];
  // Naive reduce gives 11.469999999999999; Neumaier compensation lifts the
  // result to 11.47 (the next representable double, true sum + 1 ULP).
  assert.equal(fsum(xs), 11.47);
});

test('fsum: empty array → 0', () => {
  assert.equal(fsum([]), 0);
});

test('fsum: single element', () => {
  assert.equal(fsum([3.14]), 3.14);
});

test('fsum: integer-valued inputs sum exactly', () => {
  assert.equal(fsum([1, 2, 3, 4]), 10);
});

test('fsum: handles classic 0.1 + 0.2 case better than naive', () => {
  // Naive: 0.1 + 0.2 = 0.30000000000000004
  // Neumaier: same (this case has only 2 terms, comp not enough)
  assert.equal(fsum([0.1, 0.2]), 0.30000000000000004);
});

test('fsum: handles many-term cancellation', () => {
  // Stress test: 1000 terms close to canceling.
  const xs: number[] = [];
  for (let i = 0; i < 500; i += 1) xs.push(0.1, -0.1);
  // Mathematically 0; FP noise should be small.
  assert.ok(Math.abs(fsum(xs)) < 1e-15);
});

test('fmean: canonical Neumaier example produces 2.8675 exactly', () => {
  const xs = [2.898, 2.673, 2.878, 3.021];
  // sum(xs) = 11.47, /4 = 2.8675 — both representable doubles, no FP loss.
  assert.equal(fmean(xs), 2.8675);
});

test('fmean: empty → NaN', () => {
  assert.ok(Number.isNaN(fmean([])));
});
