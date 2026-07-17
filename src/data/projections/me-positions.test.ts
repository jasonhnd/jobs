import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  assertRankingUniverseMatches,
  computeJobRankingPosition,
  rankingUniverseScope,
} from './me-positions.js';

test('me-positions labels whole-catalogue and eligible-subset universes explicitly', () => {
  assert.equal(rankingUniverseScope('ai-risk-high'), 'all');
  assert.equal(rankingUniverseScope('ai-risk-low'), 'all');
  assert.equal(rankingUniverseScope('salary-safe'), 'eligible');
  assert.equal(rankingUniverseScope('license-required'), 'eligible');
  assert.equal(rankingUniverseScope('public-sector'), 'eligible');
});

test('me-positions computes percentile against the filtered per-slug universe', () => {
  // Arrange
  const fullUniverse = [10, 20, 30, 40];

  // Act
  const position = computeJobRankingPosition(30, null, 2, fullUniverse);

  // Assert
  assert.deepEqual(position, {
    rank: null,
    total: 2,
    outOfUniverse: 3,
    universeSize: 4,
    percentile: 75,
  });
});

test('me-positions keeps unfiltered rankings on the full 556 occupation denominator', () => {
  // Arrange
  const fullUniverse = Array.from({ length: 556 }, (_value, i) => i + 1);

  // Act
  const position = computeJobRankingPosition(278, 2, 30, fullUniverse);

  // Assert
  assert.deepEqual(position, {
    rank: 2,
    total: 30,
    outOfUniverse: 278,
    universeSize: 556,
    percentile: 50,
  });
});

test('me-positions reports jobs outside a filtered universe without percentile', () => {
  // Arrange
  const fullUniverse = [10, 20];

  // Act
  const position = computeJobRankingPosition(30, null, 2, fullUniverse);

  // Assert
  assert.deepEqual(position, {
    rank: null,
    total: 2,
    outOfUniverse: null,
    universeSize: 2,
    percentile: null,
  });
});

test('me-positions drift guard catches order drift beyond TOP_N', () => {
  const canonical = Array.from({ length: 35 }, (_value, i) => i + 1);
  const local = [...canonical];
  [local[32], local[33]] = [local[33]!, local[32]!];

  assert.throws(
    () => assertRankingUniverseMatches('test-ranking', canonical, local),
    /RANKER universe order drift.*position 33/,
  );
});

test('me-positions drift guard catches membership drift beyond TOP_N', () => {
  const canonical = Array.from({ length: 35 }, (_value, i) => i + 1);
  const local = [...canonical];
  local[34] = 999;

  assert.throws(
    () => assertRankingUniverseMatches('test-ranking', canonical, local),
    /RANKER universe membership drift.*35 is missing locally/,
  );
});

test('me-positions drift guard catches size drift beyond TOP_N', () => {
  const canonical = Array.from({ length: 35 }, (_value, i) => i + 1);
  const local = canonical.slice(0, 34);

  assert.throws(
    () => assertRankingUniverseMatches('test-ranking', canonical, local),
    /RANKER universe size drift.*canonical=35 local=34/,
  );
});
