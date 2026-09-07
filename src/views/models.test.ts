import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildModelsFeaturePageModel,
  formatEvaluationStandard,
  formatJapaneseDate,
  formatModelScore,
  formatProviderDisplay,
  scoreBarWidth,
  type ModelsDeepProjection,
} from './models.js';
import { modelStoryEditorialSentenceId } from '../site/model-editorial.js';

const REVIEWED_PAIR = {
  baseline: { model: 'claude-opus-4-8', date: '2026-05-30' },
  candidate: { model: 'claude-fable-5', date: '2026-06-13' },
};
const editorialId = (id: number): string => modelStoryEditorialSentenceId(id, REVIEWED_PAIR);

const projection: ModelsDeepProjection = {
  generated_at: '2026-07-12T00:00:00.000Z',
  latest_pair: {
    baseline: { model: 'claude-opus-4-8', modelDisplay: 'Opus 4.8', date: '2026-05-30' },
    candidate: { model: 'claude-fable-5', modelDisplay: 'Fable 5', date: '2026-06-13' },
    compared_count: 2,
  },
  model_cards: [
    {
      model: 'claude-opus-4-8',
      modelDisplay: 'Opus 4.8',
      date: '2026-05-30',
      covered_count: 2,
      personality_sentence_id: 'opus',
    },
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
      editorial_sentence_id: editorialId(4),
    },
    {
      id: 5,
      title_ja: '職業E',
      href: '/5',
      baseline_transformation: 2,
      candidate_transformation: 6,
      baseline_rationale_ja: '前回の理由',
      candidate_rationale_ja: '今回の理由',
      editorial_sentence_id: editorialId(5),
    },
    {
      id: 6,
      title_ja: '職業F',
      href: '/6',
      baseline_transformation: 3,
      candidate_transformation: 8,
      baseline_rationale_ja: '前回の理由',
      candidate_rationale_ja: '今回の理由',
      editorial_sentence_id: editorialId(6),
    },
  ],
};

describe('models feature view model', () => {
  test('hydrates copy IDs and keeps compact escaped projection JSON', () => {
    const page = buildModelsFeaturePageModel(
      projection,
      { sentences: { opus: '前回文です。', fable: '固定文です。' } },
      {
        editorial_sentences: {
          [editorialId(4)]: '編集文です。',
          default_latest_pair_split: '汎用の編集文です。',
        },
      },
      {
        voteCount: 2,
        latestRunDate: '2026-06-13',
        windowMonths: 6,
        floorVotes: 5,
        usedExpiredVotes: false,
      },
    );

    assert.equal(page.pageLastUpdated, '2026-06-13');
    assert.equal(page.batchDatesText, '2026-05-30 / 2026-06-13');
    assert.equal(page.modelCount, 2);
    assert.equal(page.currentModel.model, 'claude-fable-5');
    assert.equal(page.currentModel.modelDisplay, 'Claude Fable 5');
    assert.equal(page.currentModel.href, '/models/fable-5@2026-06-13');
    assert.equal(page.consensusSummary.label, '現行の総合');
    assert.equal(page.consensusSummary.headline, '複数のAIによる総合');
    assert.equal(page.consensusSummary.voteCount, 2);
    assert.equal(page.consensusSummary.latestRunDate, '2026-06-13');
    assert.equal(page.consensusSummary.latestModelHref, '/models/fable-5@2026-06-13');
    assert.equal(page.consensusSummary.agingNote, null);
    assert.equal(page.latestPair.baseline.modelDisplay, 'Claude Opus 4.8');
    assert.equal(page.latestPair.candidate.modelDisplay, 'Claude Fable 5');
    assert.equal(page.dateRangeText, '2026-05-30 から 2026-06-13');
    assert.equal(page.coverageRangeText, '2職業');
    assert.equal(page.modelCards[1]!.personality_sentence, '固定文です。');
    assert.equal(page.stories[0]!.editorial_sentence, '編集文です。');
    assert.equal(page.projectionJson.includes('\n'), false);
    assert.equal(page.projectionJson.includes('<'), false);
  });

  test('falls back when curated copy IDs are missing', () => {
    const missingCopyProjection: ModelsDeepProjection = {
      ...projection,
      model_cards: [
        {
          ...projection.model_cards[0]!,
          personality_sentence_id: 'future_model_d9_positive_strong',
        },
      ],
      stories: projection.stories,
    };

    const page = buildModelsFeaturePageModel(
      missingCopyProjection,
      {
        sentences: {
          default_neutral: '中庸な既定文です。',
          default_d9_positive_strong: '汎用の強い既定文です。',
        },
      },
      {
        editorial_sentences: {
          default_latest_pair_split: '汎用の編集文です。',
        },
      },
    );

    assert.equal(page.modelCards[0]!.personality_sentence, '汎用の強い既定文です。');
    assert.equal(page.stories[0]!.editorial_sentence, '汎用の編集文です。');
  });

  test('falls back when a later pair carries a stale older-pair editorial id', () => {
    const nextPairProjection: ModelsDeepProjection = {
      ...projection,
      latest_pair: {
        baseline: { model: 'claude-fable-5', modelDisplay: 'Fable 5', date: '2026-06-13' },
        candidate: { model: 'gpt-5.6-sol', modelDisplay: 'GPT 5.6 SOL', date: '2026-07-12' },
        compared_count: 2,
      },
    };
    const page = buildModelsFeaturePageModel(
      nextPairProjection,
      { sentences: { opus: '前回文です。', fable: '固定文です。' } },
      {
        editorial_sentences: {
          [editorialId(4)]: '古い比較専用の編集文です。',
          default_latest_pair_split: '現在の比較に安全な汎用文です。',
        },
      },
    );

    assert.equal(page.stories[0]!.editorial_sentence, '現在の比較に安全な汎用文です。');
  });

  test('derives model count and roster links from projection cards', () => {
    const twoCardProjection: ModelsDeepProjection = {
      ...projection,
      model_cards: [
        ...projection.model_cards,
        {
          model: 'gpt-5.6-sol',
          modelDisplay: 'GPT 5.6 SOL',
          date: '2026-07-20',
          covered_count: 2,
          personality_sentence_id: 'gpt_5_6_sol_neutral',
        },
      ],
    };

    const page = buildModelsFeaturePageModel(
      twoCardProjection,
      {
        sentences: {
          opus: '前回文です。',
          fable: '固定文です。',
          default_neutral: '中庸な既定文です。',
        },
      },
      { editorial_sentences: { default_latest_pair_split: '汎用の編集文です。' } },
    );

    assert.equal(page.modelCount, twoCardProjection.model_cards.length);
    assert.deepEqual(
      page.modelRoster.map((card) => [card.model, card.href]),
      [
        ['claude-opus-4-8', '/models/opus-4-8@2026-05-30'],
        ['claude-fable-5', '/models/fable-5@2026-06-13'],
        ['gpt-5.6-sol', '/models/gpt-5.6-sol@2026-07-20'],
      ],
    );
    assert.equal(page.currentModel.href, '/models/gpt-5.6-sol@2026-07-20');
  });

  test('derives the current four model page links from model ids', () => {
    const fourModelProjection: ModelsDeepProjection = {
      ...projection,
      model_cards: [
        {
          model: 'claude-opus-4-7',
          modelDisplay: 'Opus 4.7',
          date: '2026-04-25',
          covered_count: 552,
          personality_sentence_id: 'default_neutral',
        },
        {
          model: 'claude-opus-4-8',
          modelDisplay: 'Opus 4.8',
          date: '2026-05-30',
          covered_count: 556,
          personality_sentence_id: 'default_neutral',
        },
        {
          model: 'claude-fable-5',
          modelDisplay: 'Fable 5',
          date: '2026-06-13',
          covered_count: 556,
          personality_sentence_id: 'default_neutral',
        },
        {
          model: 'gpt-5.6-sol',
          modelDisplay: 'GPT 5.6 SOL',
          date: '2026-07-12',
          covered_count: 556,
          personality_sentence_id: 'default_neutral',
        },
      ],
    };
    const page = buildModelsFeaturePageModel(
      fourModelProjection,
      { sentences: { default_neutral: '中庸な既定文です。' } },
      { editorial_sentences: { default_latest_pair_split: '汎用の編集文です。' } },
    );

    assert.deepEqual(
      page.modelRoster.map((card) => [card.modelDisplay, card.href]),
      [
        ['Claude Opus 4.7', '/models/opus-4-7@2026-04-25'],
        ['Claude Opus 4.8', '/models/opus-4-8@2026-05-30'],
        ['Claude Fable 5', '/models/fable-5@2026-06-13'],
        ['GPT 5.6 SOL', '/models/gpt-5.6-sol@2026-07-12'],
      ],
    );
    assert.deepEqual(page.modelRoster.map((card) => card.covered_count), [552, 556, 556, 556]);
    assert.equal(page.coverageRangeText, '552〜556職業');
  });

  test('formats public model metadata for visitor pages', () => {
    assert.equal(formatProviderDisplay('openai'), 'OpenAI');
    assert.equal(formatProviderDisplay('anthropic'), 'Anthropic');
    assert.equal(formatJapaneseDate('2026-07-12'), '2026年7月12日');
    assert.equal(formatEvaluationStandard('AIOIS-10-v1.0-gpt-5.6-sol'), 'AIOIS-10 v1.0');
  });

  test('formats static score bars', () => {
    assert.equal(formatModelScore(4), '4.0');
    assert.equal(scoreBarWidth(7.52), '75%');
    assert.equal(scoreBarWidth(11), '100%');
    assert.equal(scoreBarWidth(-1), '0%');
  });
});
