// computeDrift threshold counts on one-decimal displayed values.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { computeDrift, driftMean } from './drift-core.js';
import type { ScoreHistEntry } from '../../src/graph/score-strategy.js';

interface Pair {
  readonly beforeUnrounded: number;
  readonly afterUnrounded: number;
  readonly latestT: number;
}

const run = (pairs: readonly (readonly [number, number])[]) => {
  const history = new Map<number, readonly ScoreHistEntry[]>(
    pairs.map((_, i) => [i + 1, [{ model: 'old-model' } as unknown as ScoreHistEntry]]),
  );
  let i = 0;
  return computeDrift<Pair>(history, 'incoming-model', new Map(), {
    comparableOf: (h) => [...h],
    selectScores: () => {
      const [beforeUnrounded, afterUnrounded] = pairs[i]!;
      i += 1;
      return { beforeUnrounded, afterUnrounded, latestT: afterUnrounded };
    },
  }).summary;
};

describe('drift means', () => {
  test('rounds genuine halfway means to an even hundredth', () => {
    assert.equal(driftMean([4.5, 4.75]), 4.62); // 4.625: even retained digit
    assert.equal(driftMean([4.75, 5]), 4.88); // 4.875: odd retained digit
    assert.equal(driftMean([-4.5, -4.75]), -4.62);
    assert.equal(driftMean([-4.75, -5]), -4.88);
  });

  test('averages raw scores before rounding the aggregate display', () => {
    const summary = run([[4.5, 4.75], [4.75, 5]]);
    assert.equal(summary.meanBefore, 4.62);
    assert.equal(summary.meanAfter, 4.88);
    assert.deepEqual(summary.movers.map((m) => [m.before, m.after]), [[4.5, 4.8], [4.8, 5]]);
  });
});

describe('computeDrift thresholds', () => {
  test('4.1 → 3.6 and its reverse count as exactly half a point', () => {
    const summary = run([[4.1, 3.6], [3.6, 4.1]]);
    assert.equal(summary.absDeltaGe05, 2);
    assert.equal(summary.absDeltaGe10, 0);
    assert.deepEqual(summary.movers.map((m) => m.delta), [-0.5, 0.5]);
  });

  test('0.45/0.55 boundaries use displayed endpoints, in both directions', () => {
    // The canonical banker helper rounds the exact stored double: 0.45 and
    // 0.55 are just above their decimal halves, displaying 0.5 and 0.6.
    for (const [raw, displayed, counted] of [
      [0.449, 0.4, 0], [0.45, 0.5, 2], [0.451, 0.5, 2],
      [0.549, 0.5, 2], [0.55, 0.6, 2], [0.551, 0.6, 2],
    ] as const) {
      const summary = run([[0, raw], [raw, 0]]);
      assert.equal(summary.absDeltaGe05, counted, `raw ${raw}`);
      assert.equal(summary.absDeltaGe10, 0);
      assert.deepEqual(summary.movers.map((m) => m.delta), [displayed, -displayed]);
    }
  });

  test('a displayed change of exactly 0.5 or 1.0 counts, whatever the float residue', () => {
    // In floating point these differences are 0.49999999999999994 / 0.9999999999999999.
    const summary = run([
      [0.2, 0.7],
      [0.9, 1.4],
      [0.4, 1.4],
      [1.3, 2.3],
      [0.7, 0.2],
    ]);
    assert.equal(summary.absDeltaGe05, 5);
    assert.equal(summary.absDeltaGe10, 2);
    assert.deepEqual(
      summary.movers.map((m) => m.delta),
      [1, 1, 0.5, 0.5, -0.5],
    );
  });

  test('every one-decimal pair agrees with the integer-tenths rule', () => {
    const pairs: [number, number][] = [];
    for (let a = 0; a <= 100; a += 1) for (let b = 0; b <= 100; b += 1) pairs.push([a / 10, b / 10]);
    const summary = run(pairs);
    const ge05 = pairs.filter(([a, b]) => Math.abs(Math.round(b * 10) - Math.round(a * 10)) >= 5).length;
    const ge10 = pairs.filter(([a, b]) => Math.abs(Math.round(b * 10) - Math.round(a * 10)) >= 10).length;
    assert.equal(summary.absDeltaGe05, ge05);
    assert.equal(summary.absDeltaGe10, ge10);
  });

  test('a change one tenth under a threshold does not count for it', () => {
    const summary = run([
      [4.0, 4.4],
      [4.0, 4.9],
    ]);
    assert.equal(summary.absDeltaGe05, 1);
    assert.equal(summary.absDeltaGe10, 0);
  });
});
