import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
import {
  buildModelsDeepPayload,
  modelsDeepPayloadBytes,
  reportOrphanedCuration,
  resolveStoryIdsForTest,
  selectAutomaticStoryIdsForTest,
  selectConsensusRowsForTest,
  selectEditorialSentenceIdForTest,
  selectPersonalitySentenceIdForTest,
  selectStoryIdsForTest,
} from './models-deep.js';
import { DEFAULT_MODEL_STORY_EDITORIAL_ID } from '../../site/model-editorial.js';
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
  test('selects reviewed editorial copy only for the exact model and date pair', () => {
    const reviewedPair = {
      baseline: { model: 'claude-opus-4-8', date: '2026-05-30' },
      candidate: { model: 'claude-fable-5', date: '2026-06-13' },
    };
    const exactId = '239__claude-opus-4-8@2026-05-30__claude-fable-5@2026-06-13';
    const available = new Set([exactId, 'default_latest_pair_split']);

    assert.equal(selectEditorialSentenceIdForTest(239, reviewedPair, available), exactId);
    assert.equal(
      selectEditorialSentenceIdForTest(239, {
        baseline: reviewedPair.candidate,
        candidate: { model: 'gpt-5.6-sol', date: '2026-07-12' },
      }, available),
      'default_latest_pair_split',
    );
    assert.equal(
      selectEditorialSentenceIdForTest(239, {
        ...reviewedPair,
        candidate: { ...reviewedPair.candidate, date: '2026-06-14' },
      }, available),
      'default_latest_pair_split',
      'a re-run of the same model must not reuse prose from another batch date',
    );
  });

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

    assert.equal(payload.latest_pair.baseline.model, 'gpt-5.6-sol');
    assert.equal(payload.latest_pair.candidate.model, 'claude-opus-5');
    assert.equal(payload.latest_pair.compared_count, 556);
    assert.deepEqual(payload.consensus.map((row) => row.id), [10, 19, 55]);
    assert.equal(payload.model_cards.length, 5);
    assert.equal(payload.stories.length, 5);
    assert.deepEqual(payload.stories.slice(0, 3).map((story) => story.id), [239, 398, 74]);
    assert.ok(
      payload.stories.every((story) => story.editorial_sentence_id === 'default_latest_pair_split'),
      'the current GPT 5.6 → Opus 5 pair has no reviewed occupation-specific prose',
    );
    assert.ok(payload.stories.every((story) => story.baseline_rationale_ja.length > 0));
    assert.ok(payload.stories.every((story) => story.candidate_rationale_ja.length > 0));
    assert.ok(modelsDeepPayloadBytes(payload) <= 30 * 1024);
  });
});

// Issue #219: curated /models copy is scoped to an exact batch pair on purpose
// (#162), and the generic fallback is load-bearing. The defect was that the
// handover is silent — every reviewed sentence goes dark the day a batch lands
// and nothing says so.
describe('orphaned curation reporting', () => {
  const pairOf = (baseModel: string, baseDate: string, candModel: string, candDate: string) => ({
    baseline: { model: baseModel, modelDisplay: baseModel, date: baseDate },
    candidate: { model: candModel, modelDisplay: candModel, date: candDate },
    compared_count: 100,
  });

  const payloadWith = (
    latest: ReturnType<typeof pairOf>,
    storyIds: number[],
    personalityIds: string[],
  ) => ({
    generated_at: '2026-01-01T00:00:00.000Z',
    latest_pair: latest,
    model_cards: personalityIds.map((id, i) => ({
      model: `m${i}`, modelDisplay: `M${i}`, date: '2026-01-01',
      covered_count: 1, personality_sentence_id: id,
    })),
    consensus: [],
    stories: storyIds.map((id) => ({
      id, title_ja: `t${id}`, href: `/${id}`,
      baseline_transformation: 1, candidate_transformation: 2,
      baseline_rationale_ja: 'a', candidate_rationale_ja: 'b',
      editorial_sentence_id: 'x',
    })),
  }) as unknown as Parameters<typeof reportOrphanedCuration>[0];

  test('flags every sentence scoped to a superseded pair', () => {
    // The committed overrides are all keyed to opus-4-8 → fable-5.
    const report = reportOrphanedCuration(
      payloadWith(pairOf('gpt-5.6-sol', '2026-07-12', 'claude-opus-5', '2026-07-26'), [], []),
      [],
    );
    assert.equal(report.activeEditorialCount, 0);
    assert.ok(report.editorialKeys.length > 0);
    assert.ok(report.editorialKeys.every((key) => key.includes('claude-opus-4-8@2026-05-30')));
    // The generic fallback lives in the same map and is never an orphan.
    assert.equal(report.editorialKeys.includes(DEFAULT_MODEL_STORY_EDITORIAL_ID), false);
  });

  test('reports nothing for the pair the copy was written for', () => {
    const report = reportOrphanedCuration(
      payloadWith(pairOf('claude-opus-4-8', '2026-05-30', 'claude-fable-5', '2026-06-13'), [], []),
      [],
    );
    assert.deepEqual(report.editorialKeys, []);
    assert.ok(report.activeEditorialCount > 0);
  });

  test('only model-specific personality keys can be orphans', () => {
    const report = reportOrphanedCuration(
      payloadWith(
        pairOf('a', '2026-01-01', 'b', '2026-02-01'),
        [],
        ['claude_opus_4_7_neutral', 'claude_opus_4_8_d9_positive_strong', 'default_d7_negative_strong'],
      ),
      [],
    );
    // `default_*` is a lookup table — most entries are unused by design, and
    // listing all ~40 would train everyone to ignore the warning.
    assert.equal(report.personalityKeys.some((key) => key.startsWith('default_')), false);
    assert.ok(report.personalityKeys.includes('claude_fable_5_d9_negative_strong'));
    // Keys that ARE selected are not orphans.
    assert.equal(report.personalityKeys.includes('claude_opus_4_7_neutral'), false);
  });

  test('flags pins that displace the current pair biggest movers', () => {
    // Pinned ids shown, but the automatic shortlist wanted different ones.
    const report = reportOrphanedCuration(
      payloadWith(pairOf('a', '2026-01-01', 'b', '2026-02-01'), [239, 398, 74, 455, 357], []),
      [111, 114, 29, 106, 170, 338, 576, 74],
    );
    // All five are shown; none is in the automatic top 5. 74 ranks 8th, which
    // is still outside the shortlist, so it counts too.
    assert.deepEqual(report.stalePins, [74, 239, 357, 398, 455]);
    assert.deepEqual(report.displacedIds, [111, 114, 29, 106, 170]);
  });

  test('no pin warning when the pins are the biggest movers', () => {
    const report = reportOrphanedCuration(
      payloadWith(pairOf('a', '2026-01-01', 'b', '2026-02-01'), [239, 398, 74, 455, 357], []),
      [239, 398, 74, 455, 357, 111],
    );
    assert.deepEqual(report.stalePins, []);
    assert.deepEqual(report.displacedIds, []);
  });
});
