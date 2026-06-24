import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assertRankingUniverseMatches } from './me-positions.js';

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
