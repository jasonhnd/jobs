// computeDrift threshold counts on one-decimal displayed values.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { computeDrift } from './drift-core.js';
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
    meanBasis: 'displayed',
  }).summary;
};

describe('computeDrift thresholds', () => {
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
