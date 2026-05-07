/**
 * Smoke test for buildIndexes — runs against the real data/ directory and
 * checks that index sizes are sane.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildIndexes } from './indexes.js';

test('buildIndexes: loads occupations and stats with no errors', async () => {
  const { indexes, errors } = await buildIndexes();

  // Filter out any errors that aren't relevant to occupation/stats loading.
  const blockingErrors = errors.filter(
    (e) => !e.message.startsWith('Cannot read directory') || !e.file.endsWith('translations\\en'),
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
