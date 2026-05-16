/**
 * transfer-paths.cosine: tests the cosine similarity used to rank
 * "related occupation" candidates on every detail page.
 *
 * Phase E follow-up (2026-05-17): moved here from
 * src/data/projections/transfer_paths.test.ts when the algorithm
 * itself relocated to the graph layer. `src/data/projections/
 * transfer_paths.ts` now imports cosine from here — there's only
 * one implementation to test.
 *
 * Highest algorithmic complexity in the codebase. A bug here is
 * invisible until a user notices a bad recommendation.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cosine, computeTransferCandidatesMap, type TransferComputeInput } from './transfer-paths.js';

test('cosine: identical vectors → 1.0', () => {
  const u = { a: 3, b: 4 };
  const v = { a: 3, b: 4 };
  assert.equal(cosine(u, v), 1);
});

test('cosine: orthogonal vectors over disjoint keys → 0', () => {
  // No shared keys at all → similarity 0 (function returns early).
  const u = { a: 1, b: 2 };
  const v = { c: 3, d: 4 };
  assert.equal(cosine(u, v), 0);
});

test('cosine: classic 3-4 vs 4-3 → 24/25 = 0.96', () => {
  const u = { a: 3, b: 4 };
  const v = { a: 4, b: 3 };
  // cos = (3*4 + 4*3) / (sqrt(25) * sqrt(25)) = 24 / 25 = 0.96
  assert.ok(Math.abs(cosine(u, v) - 0.96) < 1e-12);
});

test('cosine: only sums over INTERSECTION of keys (silently drops keys present in only one)', () => {
  // u has {a, b, x}; v has {a, b, y}. Cosine should only consider {a, b}.
  const u = { a: 3, b: 4, x: 999 };
  const v = { a: 3, b: 4, y: 999 };
  // Over intersection: identical → 1.0
  assert.equal(cosine(u, v), 1);
});

test('cosine: zero-magnitude vector returns 0 (no NaN division)', () => {
  const u = { a: 0, b: 0 };
  const v = { a: 1, b: 2 };
  // u has zero magnitude → similarity defined as 0 (function must guard div-by-zero)
  const result = cosine(u, v);
  assert.ok(Number.isFinite(result), `expected finite, got ${result}`);
});

test('cosine: empty objects → 0 (no NaN)', () => {
  assert.equal(cosine({}, {}), 0);
});

test('cosine: order-independent (symmetric)', () => {
  const u = { x: 1.5, y: 2.5, z: 3.5 };
  const v = { x: 0.5, y: 1.5, z: 2.5 };
  assert.equal(cosine(u, v), cosine(v, u));
});

test('computeTransferCandidatesMap: identical occupations → similarity 1.0, picks safer ones', () => {
  // 3 occs, same skills, but ai_risk = 8 / 5 / 2. From occ 1's perspective,
  // both 2 and 3 are strictly safer (risk drop ≥ 1.0) → both should appear,
  // sorted by similarity desc (here they tie at 1.0, so stable id order).
  const input: TransferComputeInput = {
    sortedOccIds: [1, 2, 3],
    skillsByOcc: new Map([
      [1, { a: 3, b: 4 }],
      [2, { a: 3, b: 4 }],
      [3, { a: 3, b: 4 }],
    ]),
    riskByOcc: new Map([[1, 8], [2, 5], [3, 2]]),
    sectorByOcc: new Map([[1, 'iryo'], [2, 'iryo'], [3, 'iryo']]),
    titleByOcc: new Map([[1, 'A'], [2, 'B'], [3, 'C']]),
  };
  const result = computeTransferCandidatesMap(input);
  const entry = result.get(1)!;
  assert.equal(entry.source_id, 1);
  assert.equal(entry.fallback, null, 'safer candidates exist → primary path, no fallback');
  assert.equal(entry.candidates.length, 2);
  assert.deepEqual(
    entry.candidates.map((c) => c.id).sort(),
    [2, 3],
  );
});

test('computeTransferCandidatesMap: no safer in sector → fallback label set', () => {
  // Single sector, single occupation with risk 5. No candidates safer.
  const input: TransferComputeInput = {
    sortedOccIds: [1, 2],
    skillsByOcc: new Map([
      [1, { a: 3, b: 4 }],
      [2, { a: 3, b: 4 }],
    ]),
    riskByOcc: new Map([[1, 5], [2, 5]]), // tie — not strictly safer
    sectorByOcc: new Map([[1, 'iryo'], [2, 'iryo']]),
    titleByOcc: new Map([[1, 'A'], [2, 'B']]),
  };
  const result = computeTransferCandidatesMap(input);
  const entry = result.get(1)!;
  assert.equal(entry.fallback, 'no_safer_in_sector');
  assert.equal(entry.candidates.length, 1);
  assert.equal(entry.candidates[0]!.id, 2);
});

test('computeTransferCandidatesMap: occupation with no skills → no_skills fallback', () => {
  const input: TransferComputeInput = {
    sortedOccIds: [1, 2],
    skillsByOcc: new Map([
      [1, null], // no skills block
      [2, { a: 3, b: 4 }],
    ]),
    riskByOcc: new Map([[1, 5], [2, 3]]),
    sectorByOcc: new Map([[1, 'iryo'], [2, 'iryo']]),
    titleByOcc: new Map([[1, 'A'], [2, 'B']]),
  };
  const result = computeTransferCandidatesMap(input);
  const entry = result.get(1)!;
  assert.equal(entry.fallback, 'no_skills');
  assert.equal(entry.candidates.length, 0);
});

test('computeTransferCandidatesMap: different sectors do NOT cross over', () => {
  const input: TransferComputeInput = {
    sortedOccIds: [1, 2],
    skillsByOcc: new Map([
      [1, { a: 3, b: 4 }],
      [2, { a: 3, b: 4 }], // identical skills
    ]),
    riskByOcc: new Map([[1, 8], [2, 2]]), // 2 is much safer
    sectorByOcc: new Map([[1, 'iryo'], [2, 'IT']]), // different sectors
    titleByOcc: new Map([[1, 'A'], [2, 'B']]),
  };
  const result = computeTransferCandidatesMap(input);
  const entry = result.get(1)!;
  // No same-sector candidates → no_safer_in_sector fallback, empty pool
  assert.equal(entry.fallback, 'no_safer_in_sector');
  assert.equal(entry.candidates.length, 0);
});
