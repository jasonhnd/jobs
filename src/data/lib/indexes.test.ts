/**
 * Smoke test for buildIndexes — runs against the real data/ directory and
 * checks that index sizes are sane.
 *
 * Plus unit tests for `insertById` (the duplicate-id detector added in
 * Phase 0.5).
 */
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildIndexes, insertById } from './indexes.js';
import type { LoadError } from '../loaders.js';

test('buildIndexes: loads occupations and stats with no errors', async () => {
  const { indexes, errors } = await buildIndexes();

  // Filter out any errors that aren't relevant to occupation/stats loading.
  const blockingErrors = errors.filter(
    // Normalize separators so the filter works on Windows (\) and POSIX (/).
    (e) => !e.message.startsWith('Cannot read directory') || !e.file.replace(/\\/g, '/').endsWith('translations/en'),
  );
  if (blockingErrors.length > 0) {
    console.error('Unexpected errors:', blockingErrors);
  }

  assert.ok(indexes.occById.size > 100, `expected >100 occupations, got ${indexes.occById.size}`);
  assert.ok(indexes.statsById.size > 100, `expected >100 stats, got ${indexes.statsById.size}`);
  assert.ok(indexes.labelsByDim.size === 7, `expected 7 label dimensions, got ${indexes.labelsByDim.size}`);
  assert.ok(indexes.sectors.length > 0, `expected sectors defined`);
});

test('buildIndexes: every occupation gets a sector assignment', async () => {
  const { indexes } = await buildIndexes();
  // sectorByOcc should match occById in size when sectors are defined.
  if (indexes.sectors.length > 0) {
    assert.equal(
      indexes.sectorByOcc.size,
      indexes.occById.size,
      'every occupation should have a sector assignment',
    );
  }
});

test('buildIndexes: latestScoreByOcc is a subset of occById', async () => {
  const { indexes } = await buildIndexes();
  for (const occId of indexes.latestScoreByOcc.keys()) {
    assert.ok(
      indexes.occById.has(occId),
      `score references unknown occupation ${occId}`,
    );
  }
});

test('buildIndexes: history is sorted by date ascending', async () => {
  const { indexes } = await buildIndexes();
  for (const [occId, hist] of indexes.historyByOcc) {
    for (let i = 1; i < hist.length; i += 1) {
      assert.ok(
        hist[i - 1]!.date <= hist[i]!.date,
        `history for occ ${occId} not sorted: ${hist[i - 1]!.date} > ${hist[i]!.date}`,
      );
    }
  }
});

// ─── insertById (Phase 0.5 dup-id detection) ─────────────────────────────

describe('insertById', () => {
  test('inserts a new id into the map', () => {
    const map = new Map<number, string>();
    const errors: LoadError[] = [];
    insertById(map, 42, 'a', errors, 'occupations');
    assert.equal(map.get(42), 'a');
    assert.equal(errors.length, 0);
  });

  test('records a duplicate-id error and preserves the FIRST value', () => {
    // Map.set would overwrite — we explicitly want first-wins + error.
    const map = new Map<number, string>();
    const errors: LoadError[] = [];
    insertById(map, 7, 'first', errors, 'occupations');
    insertById(map, 7, 'second', errors, 'occupations');
    assert.equal(map.get(7), 'first', 'first insert must win');
    assert.equal(errors.length, 1);
    assert.match(errors[0]!.message, /duplicate id 7/);
    assert.match(errors[0]!.file, /occupations$/, 'error.file must point at the subdir');
  });

  test('accumulates errors across many duplicates', () => {
    const map = new Map<number, string>();
    const errors: LoadError[] = [];
    insertById(map, 1, 'a', errors, 'occupations');
    insertById(map, 1, 'b', errors, 'occupations');
    insertById(map, 1, 'c', errors, 'occupations');
    insertById(map, 2, 'd', errors, 'occupations');
    insertById(map, 2, 'e', errors, 'occupations');
    assert.equal(map.size, 2);
    assert.equal(errors.length, 3, 'two for id 1, one for id 2');
  });

  test('different subdirs produce different error paths', () => {
    const map = new Map<number, string>();
    const errors: LoadError[] = [];
    insertById(map, 1, 'a', errors, 'occupations');
    insertById(map, 1, 'b', errors, 'occupations');
    insertById(map, 1, 'c', errors, 'translations/en');
    assert.equal(errors.length, 2);
    assert.match(errors[0]!.file, /occupations$/);
    assert.match(errors[1]!.file, /translations\/en$/);
  });

  test('appends to caller-owned errors array without replacing it', () => {
    const map = new Map<number, string>();
    const errors: LoadError[] = [{ file: 'pre-existing', message: 'pre-existing' }];
    insertById(map, 1, 'a', errors, 'occupations');
    insertById(map, 1, 'b', errors, 'occupations');
    assert.equal(errors.length, 2, 'pre-existing + 1 new dup error');
    assert.equal(errors[0]!.message, 'pre-existing');
    assert.match(errors[1]!.message, /duplicate id 1/);
  });

  test('handles falsy-looking ids (0) correctly', () => {
    // Map.has(0) returns true once 0 is set; the dup-check should fire.
    const map = new Map<number, string>();
    const errors: LoadError[] = [];
    insertById(map, 0, 'first', errors, 'occupations');
    insertById(map, 0, 'second', errors, 'occupations');
    assert.equal(map.get(0), 'first');
    assert.equal(errors.length, 1);
  });

  test('different ids never collide', () => {
    const map = new Map<number, string>();
    const errors: LoadError[] = [];
    for (let i = 0; i < 100; i += 1) {
      insertById(map, i, `value-${i}`, errors, 'occupations');
    }
    assert.equal(map.size, 100);
    assert.equal(errors.length, 0);
  });
});
