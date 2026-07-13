import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
import {
  buildModelsDeepPayload,
  modelsDeepPayloadBytes,
  resolveStoryIdsForTest,
  selectAutomaticStoryIdsForTest,
  selectConsensusRowsForTest,
  selectPersonalitySentenceIdForTest,
  selectStoryIdsForTest,
} from './models-deep.js';
import type { DriftRow } from '../../graph/aiois-drift.js';

let indexesPromise: Promise<Indexes> | null = null;

async function indexesFixture(): Promise<Indexes> {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const { indexes, errors } = await buildIndexes();
      assert.deepEqual(errors, []);
      return indexes;
    })();
  }
  return indexesPromise;
}

function row(id: number, dT: number): DriftRow {
  return {
    id,
    title: `職業${id}`,
    baseT: 5,
    candT: 5 + dT,
    dT,
    baseD: 5,
    candD: 5,
    dD: 0,
    baseBand: 'mid',
    candBand: 'mid',
    baseRank: id,
    candRank: id,
    rankShift: 0,
    confidence: 0.8,
    flags: [],
  };
}

describe('models-deep projection', () => {
  test('selects personality sentence IDs by thresholds, sign, fallback, and dimension tie order', () => {
    const ids = new Set([
      'default_neutral',
      'default_d1_positive_moderate',
      'default_d2_positive_strong',
      'default_d3_negative_strong',
    ]);

    assert.equal(
      selectPersonalitySentenceIdForTest('new-model', [0.49, 0, 0], 'candidate', ids),
      'default_neutral',
    );
    assert.equal(
      selectPersonalitySentenceIdForTest('new-model', [0.5, 0, 0], 'candidate', ids),
      'default_d1_positive_moderate',
    );
    assert.equal(
      selectPersonalitySentenceIdForTest('new-model', [0.75, 0.75, 0], 'candidate', ids),
      'default_neutral',
      'falls back when the tied driver id is unavailable',
    );
    assert.equal(
      selectPersonalitySentenceIdForTest('new-model', [0, 0.8, 0], 'candidate', ids),
      'default_d2_positive_strong',
    );
    assert.equal(
      selectPersonalitySentenceIdForTest('new-model', [0, 0, 0.9], 'baseline', ids),
      'default_d3_negative_strong',
    );
  });

  test('orders consensus ascending by absolute delta and stories descending with id ties', () => {
    const rows = [row(5, 1), row(3, -0.1), row(2, 0.1), row(1, 0), row(4, -2)];

    assert.deepEqual(selectConsensusRowsForTest(rows), [1, 2, 3]);
    assert.deepEqual(selectAutomaticStoryIdsForTest(rows), [4, 5, 2, 3, 1]);
  });

  test('applies curated story override precedence and de-dupes first occurrence', () => {
    assert.deepEqual(
      selectStoryIdsForTest(
        { pinned_ids: [9, 4], replace_ids: [4, 7] },
        [1, 7, 2, 3, 4],
      ),
      [9, 4, 7, 1, 2],
    );
  });

  test('falls back when curated stories are unavailable and fails below three stories', () => {
    assert.deepEqual(
      resolveStoryIdsForTest(
        { pinned_ids: [99], replace_ids: [98] },
        [1, 2, 3, 4],
        new Set([1, 2, 3, 4]),
      ),
      [1, 2, 3, 4],
    );

    assert.throws(
      () => resolveStoryIdsForTest(
        { pinned_ids: [99], replace_ids: [] },
        [1, 2],
        new Set([1, 2]),
      ),
      /at least 3/,
    );
  });

  test('builds the current payload shape under 30 KB with selected rationale only', async () => {
    const payload = buildModelsDeepPayload(await indexesFixture(), '2026-07-12T00:00:00.000Z');

    assert.equal(payload.latest_pair.baseline.model, 'claude-fable-5');
    assert.equal(payload.latest_pair.candidate.model, 'gpt-5.6-sol');
    assert.equal(payload.latest_pair.compared_count, 556);
    assert.deepEqual(payload.consensus.map((row) => row.id), [24, 69, 94]);
    assert.equal(payload.model_cards.length, 4);
    assert.equal(payload.stories.length, 5);
    assert.deepEqual(payload.stories.slice(0, 3).map((story) => story.id), [239, 398, 74]);
    assert.ok(payload.stories.every((story) => story.baseline_rationale_ja.length > 0));
    assert.ok(payload.stories.every((story) => story.candidate_rationale_ja.length > 0));
    assert.ok(modelsDeepPayloadBytes(payload) <= 30 * 1024);
  });
});
