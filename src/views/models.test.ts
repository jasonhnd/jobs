import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildModelsFeaturePageModel,
  formatModelScore,
  scoreBarWidth,
  type ModelsDeepProjection,
} from './models.js';

const projection: ModelsDeepProjection = {
  generated_at: '2026-07-12T00:00:00.000Z',
  latest_pair: {
    baseline: { model: 'claude-opus-4-8', modelDisplay: 'Opus 4.8', date: '2026-05-30' },
    candidate: { model: 'claude-fable-5', modelDisplay: 'Fable 5', date: '2026-06-13' },
    compared_count: 2,
  },
  model_cards: [
    {
      model: 'claude-fable-5',
      modelDisplay: 'Fable 5',
      date: '2026-06-13',
      covered_count: 2,
      personality_sentence_id: 'fable',
    },
  ],
  consensus: [
    { id: 1, title_ja: '職業A', href: '/1' },
    { id: 2, title_ja: '職業B', href: '/2' },
    { id: 3, title_ja: '職業C', href: '/3' },
  ],
  stories: [
    {
      id: 4,
      title_ja: '職業D',
      href: '/4',
      baseline_transformation: 4.2,
      candidate_transformation: 7.5,
      baseline_rationale_ja: '前回の理由',
      candidate_rationale_ja: '今回の理由',
      editorial_sentence_id: 'story',
    },
    {
      id: 5,
      title_ja: '職業E',
      href: '/5',
      baseline_transformation: 2,
      candidate_transformation: 6,
      baseline_rationale_ja: '前回の理由',
      candidate_rationale_ja: '今回の理由',
      editorial_sentence_id: 'story',
    },
    {
      id: 6,
      title_ja: '職業F',
      href: '/6',
      baseline_transformation: 3,
      candidate_transformation: 8,
      baseline_rationale_ja: '前回の理由',
      candidate_rationale_ja: '今回の理由',
      editorial_sentence_id: 'story',
    },
  ],
};

describe('models feature view model', () => {
  test('hydrates copy IDs and keeps compact escaped projection JSON', () => {
    const page = buildModelsFeaturePageModel(
      projection,
      { sentences: { fable: '固定文です。' } },
      { editorial_sentences: { story: '編集文です。' } },
    );

    assert.equal(page.pageLastUpdated, '2026-06-13');
    assert.equal(page.batchDatesText, '2026-06-13');
    assert.equal(page.modelCards[0]!.personality_sentence, '固定文です。');
    assert.equal(page.stories[0]!.editorial_sentence, '編集文です。');
    assert.equal(page.projectionJson.includes('\n'), false);
    assert.equal(page.projectionJson.includes('<'), false);
  });

  test('fails when checked-in copy is missing', () => {
    assert.throws(
      () => buildModelsFeaturePageModel(projection, { sentences: {} }, { editorial_sentences: { story: '編集文です。' } }),
      /personality copy missing/,
    );
  });

  test('formats static score bars', () => {
    assert.equal(formatModelScore(4), '4.0');
    assert.equal(scoreBarWidth(7.52), '75%');
    assert.equal(scoreBarWidth(11), '100%');
    assert.equal(scoreBarWidth(-1), '0%');
  });
});
