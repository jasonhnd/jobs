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
import { latestAioisPair, listOccupationRuns } from '../../site/occupation-runs.js';
import personalityCopy from '../../content/model-personality.ja.json';
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
    const runs = listOccupationRuns();
    const { baseline, candidate } = latestAioisPair(runs);

    assert.equal(payload.latest_pair.baseline.model, baseline.model);
    assert.equal(payload.latest_pair.candidate.model, candidate.model);
    assert.equal(payload.latest_pair.baseline.date, baseline.runDate);
    assert.equal(payload.latest_pair.candidate.date, candidate.runDate);
    assert.ok(payload.latest_pair.compared_count >= 1);
    assert.equal(payload.consensus.length, 3);
    assert.equal(new Set(payload.consensus.map((row) => row.id)).size, 3);
    assert.equal(payload.model_cards.length, runs.length);
    assert.ok(payload.stories.length >= 3 && payload.stories.length <= 5);
    assert.equal(new Set(payload.stories.map((story) => story.id)).size, payload.stories.length);
    const pairSuffix =
      `__${baseline.model}@${baseline.runDate}__${candidate.model}@${candidate.runDate}`;
    assert.ok(
      payload.stories.every((story) => story.editorial_sentence_id.endsWith(pairSuffix)),
      payload.stories.map((story) => story.editorial_sentence_id).join(', '),
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

  const OLD_PAIR = 'claude-opus-4-8@2026-05-30__claude-fable-5@2026-06-13';
  const NEW_PAIR = 'gpt-5.6-sol@2026-07-12__claude-opus-5@2026-07-26';
  const overridesFixture = (keys: string[], pins: number[] = [], replaces: number[] = []) => ({
    pinned_ids: pins,
    replace_ids: replaces,
    editorial_sentences: Object.fromEntries([
      ...keys.map((k) => [k, 'x']),
      [DEFAULT_MODEL_STORY_EDITORIAL_ID, 'fallback'],
    ]),
  });
  const personalityFixture = (keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, 'x'])) as Record<string, string>;

  test('flags every sentence scoped to a superseded pair', () => {
    const report = reportOrphanedCuration(
      payloadWith(pairOf('gpt-5.6-sol', '2026-07-12', 'claude-opus-5', '2026-07-26'), [], []),
      [],
      overridesFixture([`239__${OLD_PAIR}`, `74__${OLD_PAIR}`]),
      personalityFixture([]),
    );
    assert.equal(report.activeEditorialCount, 0);
    assert.deepEqual(report.editorialKeys, [`239__${OLD_PAIR}`, `74__${OLD_PAIR}`]);
    // The generic fallback lives in the same map and is never an orphan.
    assert.equal(report.editorialKeys.includes(DEFAULT_MODEL_STORY_EDITORIAL_ID), false);
  });

  test('reports nothing for the pair the copy was written for', () => {
    const report = reportOrphanedCuration(
      payloadWith(pairOf('gpt-5.6-sol', '2026-07-12', 'claude-opus-5', '2026-07-26'), [], []),
      [],
      overridesFixture([`111__${NEW_PAIR}`, `114__${NEW_PAIR}`]),
      personalityFixture([]),
    );
    assert.deepEqual(report.editorialKeys, []);
    assert.equal(report.activeEditorialCount, 2);
  });

  test('only model-specific personality keys can be orphans', () => {
    const report = reportOrphanedCuration(
      payloadWith(pairOf('a', '2026-01-01', 'b', '2026-02-01'), [], ['claude_x_neutral', 'default_d7_negative_strong']),
      [],
      overridesFixture([]),
      // `default_*` is a lookup table — most entries are unused by design, and
      // listing all ~40 would train everyone to ignore the warning.
      personalityFixture(['claude_x_neutral', 'claude_y_d9_positive_strong', 'default_d7_negative_strong', 'default_d1_positive_strong']),
    );
    assert.equal(report.personalityKeys.some((key) => key.startsWith('default_')), false);
    assert.deepEqual(report.personalityKeys, ['claude_y_d9_positive_strong']);
    // Keys that ARE selected are not orphans.
    assert.equal(report.personalityKeys.includes('claude_x_neutral'), false);
  });

  test('flags pins that displace the current pair biggest movers', () => {
    // Pinned ids shown, but the automatic shortlist wanted different ones.
    const report = reportOrphanedCuration(
      payloadWith(pairOf('a', '2026-01-01', 'b', '2026-02-01'), [239, 398, 74, 455, 357], []),
      [111, 114, 29, 106, 170, 338, 576, 74],
      overridesFixture([], [239, 398, 74], [455, 357]),
      personalityFixture([]),
    );
    // All five are shown; none is in the automatic top 5. 74 ranks 8th, which
    // is still outside the shortlist, so it counts too.
    assert.deepEqual(report.stalePins, [74, 239, 357, 398, 455]);
    assert.deepEqual(report.displacedIds, [111, 114, 29, 106, 170]);
  });

  test('does not flag pins that already are the biggest movers', () => {
    const report = reportOrphanedCuration(
      payloadWith(pairOf('a', '2026-01-01', 'b', '2026-02-01'), [239, 398, 74, 455, 357], []),
      [239, 398, 74, 455, 357, 111],
      overridesFixture([], [239, 398, 74], [455, 357]),
      personalityFixture([]),
    );
    assert.deepEqual(report.stalePins, []);
    assert.deepEqual(report.displacedIds, []);
  });
});

/**
 * `choosePersonalityId` derives `positive` from `signed drift >= 0`, i.e. "this
 * model scores the dimension HIGHER than its comparison". The copy must describe
 * what a higher score on that dimension means — and for a moat dimension
 * (d3-d7) a higher score is a STRONGER barrier.
 *
 * All twenty moat entries had positive and negative swapped, so three of the
 * five live /models cards asserted the opposite of what the data said: Fable 5
 * scores d7 lower than GPT yet was described as treating the regulatory wall as
 * a strong moat. The up/friction dimensions (d1, d2, d8, d9, d10) were correct
 * throughout, which is why this survived — it only shows on moat drivers.
 */
describe('personality copy polarity', () => {
  const sentences = personalityCopy.sentences as Record<string, string>;
  const MOAT_DIMS = ['d3', 'd4', 'd5', 'd6', 'd7'] as const;
  const OPEN_DIMS = ['d1', 'd2', 'd8', 'd9', 'd10'] as const;

  test('a higher moat score reads as a stronger barrier', () => {
    for (const dim of MOAT_DIMS) {
      for (const strength of ['strong', 'moderate'] as const) {
        const positive = sentences[`default_${dim}_positive_${strength}`]!;
        const negative = sentences[`default_${dim}_negative_${strength}`]!;
        assert.ok(
          positive.includes('防壁'),
          `default_${dim}_positive_${strength} should describe a barrier, got: ${positive}`,
        );
        assert.equal(
          negative.includes('防壁'), false,
          `default_${dim}_negative_${strength} should NOT describe a barrier, got: ${negative}`,
        );
      }
    }
  });

  test('open dimensions read as weighing the dimension, not as a barrier', () => {
    for (const dim of OPEN_DIMS) {
      for (const strength of ['strong', 'moderate'] as const) {
        for (const direction of ['positive', 'negative'] as const) {
          const copy = sentences[`default_${dim}_${direction}_${strength}`]!;
          assert.equal(
            copy.includes('防壁'), false,
            `default_${dim}_${direction}_${strength} is not a moat dimension: ${copy}`,
          );
        }
      }
    }
  });

  test('every dimension has all four variants', () => {
    for (const dim of [...MOAT_DIMS, ...OPEN_DIMS]) {
      for (const strength of ['strong', 'moderate'] as const) {
        for (const direction of ['positive', 'negative'] as const) {
          assert.ok(sentences[`default_${dim}_${direction}_${strength}`], `missing default_${dim}_${direction}_${strength}`);
        }
      }
    }
  });
});
