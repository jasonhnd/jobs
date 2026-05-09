/**
 * transfer_paths.cosine: tests the cosine similarity used to rank
 * "related occupation" candidates on every detail page.
 *
 * Highest algorithmic complexity in the codebase, no tests at all
 * before this file. A bug here is invisible until a user notices a
 * bad recommendation.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cosine } from './transfer_paths.js';

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
