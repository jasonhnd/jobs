import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildGenreItems, buildGenreResult, buildGenreIndexSpotlight,
  type DetailFileMin, type DimensionField, type GenreHubConfig,
} from './genre-hub.js';
import { CONSENSUS_FAQ_SENTENCE } from '../site/consensus-copy.js';

const config: GenreHubConfig = {
  slug: 'fixture', short_ja: 'Axis', title_ja: 'Fixture title', description_ja: 'Fixture description',
  og_eyebrow: 'Fixture', dimension_field: 'abilities_top5', dimension_key: 'axis',
};

function detail(id: number, score: number, overrides: Partial<DetailFileMin> = {}): DetailFileMin {
  return { id, title: { ja: `Occupation ${id}` }, abilities_top5: [{ key: 'axis', label_ja: 'Axis', score }], ...overrides };
}

for (const field of [
  'abilities_top5', 'knowledge_top5', 'skills_top10', 'work_values_top5',
  'work_characteristics_top5', 'training_pre_top5', 'training_post_top5', 'experience_top5',
] satisfies DimensionField[]) {
  test(`genre dimension ${field} selects matching keys and skips missing/nonmatching entries`, () => {
    const items = buildGenreItems([
      { id: 1 }, { id: 2, [field]: null }, { id: 3, [field]: [] },
      { id: 4, [field]: [{ key: 'other', label_ja: 'Other', score: 99 }] },
      { id: 5, [field]: [{ key: 'other', label_ja: 'Other', score: 99 }, { key: 'axis', label_ja: 'Axis', score: 0 }] },
    ], { ...config, dimension_field: field });
    assert.deepEqual(items, [{
      id: 5, name_ja: '#5', primary_score: 0, ai_risk: null, risk_band: null,
      workers: null, salary: null, monthly_hours: null, average_age: null, sector_id: '', sector_ja: '',
    }]);
  });
}

test('genre dimensions take precedence over a custom filter and incomplete configs return no items', () => {
  const neverCalled = () => { throw new Error('Dimension must take precedence'); };
  assert.equal(buildGenreItems([detail(1, 3)], { ...config, custom_filter: neverCalled }).length, 1);
  assert.deepEqual(buildGenreItems([detail(1, 3)], { ...config, dimension_key: undefined }), []);
  assert.deepEqual(buildGenreItems([detail(1, 3)], { ...config, dimension_field: undefined }), []);
  assert.equal(buildGenreItems([{ id: 1 }], {
    ...config, dimension_key: undefined, custom_filter: () => 2,
  })[0]!.primary_score, 2);
});

test('genre ranking sorts scores descending, ties by id, and caps at TOP30 without mutating details', () => {
  const details = Array.from({ length: 35 }, (_, i) => detail(35 - i, i < 2 ? 100 : i));
  const before = structuredClone(details);
  const items = buildGenreItems(details, config);
  assert.deepEqual(items.map((item) => item.id), [34, 35, ...Array.from({ length: 28 }, (_, i) => i + 1)]);
  assert.deepEqual(details, before);
});

test('genre custom filters exclude only null and retain zero and negative scores', () => {
  const items = buildGenreItems([
    { id: 3, stats: { workers: -5 } }, { id: 2, stats: { workers: 0 } }, { id: 1 },
    { id: 4, stats: { workers: 10 } },
  ], { ...config, dimension_field: undefined, custom_filter: (d) => d.stats?.workers ?? null });
  assert.deepEqual(items.map((item) => [item.id, item.primary_score]), [[4, 10], [2, 0], [3, -5]]);
});

test('genre results aggregate nullable values, adapt fields, and include development hints', () => {
  const details = [
    detail(1, 5, { ai_risk: { score: 2 }, risk_band: 'low', stats: { salary_man_yen: 500.9, workers: 1200, monthly_hours: 160, average_age: 40 }, sector: { id: 's1', ja: 'Sector 1' } }),
    detail(2, 3, { ai_risk: { score: 4 }, stats: { salary_man_yen: 300.1, workers: 800 }, sector: { id: 's1', ja: 'Sector 1' } }),
    detail(3, 1, { ai_risk: null, stats: null, sector: null }),
  ];
  const withHints = { ...config, characteristics_ja: ['Characteristic'], how_to_develop_ja: ['First', 'Second', 'Third'] };
  const result = buildGenreResult(details, withHints);
  assert.strictEqual(result.config, withHints);
  assert.deepEqual(result.items[0], {
    id: 1, name_ja: 'Occupation 1', primary_score: 5, ai_risk: 2, risk_band: 'low', workers: 1200,
    salary: 500.9, monthly_hours: 160, average_age: 40, sector_id: 's1', sector_ja: 'Sector 1',
  });
  assert.deepEqual(result.stats, [
    ['平均 Axisスコア', '3.00'], ['平均 AI 影響', '3.0 / 10'],
    ['平均年収', '400 万円'], ['TOP3 合計就業者数', '2,000 人'],
  ]);
  assert.deepEqual(result.sectorBreakdown, [['Sector 1', 2]]);
  assert.deepEqual(result.highlights, [
    '1 位は「Occupation 1」（Axisスコア 5.00）', 'TOP 3 は Occupation 1、Occupation 2、Occupation 3',
    'セクターは「Sector 1」が 2 件と最多', 'TOP3 の平均 AI 影響は 3.0/10', '特徴: Characteristic',
  ]);
  assert.equal(result.faqItems.length, 4);
  assert.deepEqual(result.faqItems[0], ['Axisが中心となるのはどんな職業？', config.description_ja]);
  assert.ok(result.faqItems[1]![1].includes('TOP 3 職業'));
  assert.equal(result.faqItems[2]![1], `本 hub の TOP 3 の平均 AI 影響度は 3.0/10 で 低め の水準です。${CONSENSUS_FAQ_SENTENCE}`);
  assert.ok(result.faqItems[3]![1].includes('First。Second'));
  assert.ok(!result.faqItems[3]![1].includes('Third'));
});

test('genre summaries and sector counts use only the retained TOP30 and cap sectors at five', () => {
  const details = Array.from({ length: 36 }, (_, i) => detail(i + 1, 36 - i, {
    ai_risk: { score: i < 30 ? 2 : 10 },
    stats: { salary_man_yen: i < 30 ? 400 : 9999, workers: i < 30 ? 10 : 99999 },
    sector: { ja: `Sector ${i % 7}` },
  }));
  const result = buildGenreResult(details, config);
  assert.deepEqual(result.stats.map(([, value]) => value), ['21.50', '2.0 / 10', '400 万円', '300 人']);
  assert.deepEqual(result.sectorBreakdown, [['Sector 0', 5], ['Sector 1', 5], ['Sector 2', 4], ['Sector 3', 4], ['Sector 4', 4]]);
});

test('empty genre results keep placeholders and omit conditional highlights and FAQs', () => {
  const result = buildGenreResult([], { ...config, characteristics_ja: [], how_to_develop_ja: [] });
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.sectorBreakdown, []);
  assert.deepEqual(result.stats.map(([, value]) => value), ['0.00', '—', '—', '0 人']);
  assert.deepEqual(result.highlights, ['1 位は「—」（Axisスコア —）']);
  assert.deepEqual(result.faqItems, [['Axisが中心となるのはどんな職業？', config.description_ja]]);
});

test('genre zero risk/salary do not generate a risk tier FAQ and missing sector is omitted', () => {
  const result = buildGenreResult([detail(1, 0, { ai_risk: { score: 0 }, stats: { salary_man_yen: 0, workers: 0 } })], config);
  assert.deepEqual(result.stats.map(([, value]) => value), ['0.00', '—', '—', '0 人']);
  assert.deepEqual(result.sectorBreakdown, []);
  assert.equal(result.highlights.length, 2);
  assert.equal(result.faqItems.length, 2);
});

for (const [raw, shown, tier] of [
  [3.54, '3.5', '低め'], [3.56, '3.6', '中程度'],
  [5.54, '5.5', '中程度'], [5.56, '5.6', 'やや高め'],
] as const) {
  test(`genre FAQ classifies the displayed mean ${shown}, from unrounded ${raw}`, () => {
    const result = buildGenreResult([
      detail(1, 2, { ai_risk: { score: raw - 0.02 } }),
      detail(2, 1, { ai_risk: { score: raw + 0.02 } }),
    ], config);
    assert.equal(result.faqItems[2]![1], `本 hub の TOP 2 の平均 AI 影響度は ${shown}/10 で ${tier} の水準です。${CONSENSUS_FAQ_SENTENCE}`);
  });
}

test('genre spotlight skips empty axes, deduplicates winners, preserves config order and obeys limits', () => {
  const details = [detail(3, 9), detail(1, 8), detail(2, 7)];
  const pick = (id: number): GenreHubConfig => ({
    ...config, dimension_field: undefined, custom_filter: (d) => d.id === id ? id : null,
  });
  const configs = [pick(99), pick(3), pick(3), pick(1), pick(2)];
  assert.deepEqual(buildGenreIndexSpotlight(details, configs).map((o) => o.id), [3, 1, 2]);
  assert.deepEqual(buildGenreIndexSpotlight(details, configs, 2).map((o) => o.id), [3, 1]);
  assert.deepEqual(buildGenreIndexSpotlight(details, configs, 1).map((o) => o.id), [3]);
  assert.deepEqual(buildGenreIndexSpotlight([], configs), []);
  assert.deepEqual(buildGenreIndexSpotlight(details, []), []);
  const many = Array.from({ length: 15 }, (_, i) => detail(i + 1, i));
  assert.deepEqual(buildGenreIndexSpotlight(many, many.map((d) => pick(d.id))).map((o) => o.id), Array.from({ length: 12 }, (_, i) => i + 1));
});

test('genre hubs with fewer than 30 rows say TOP<n>, a full hub keeps TOP30 (#884)', () => {
  const few = buildGenreResult([detail(1, 5, { ai_risk: { score: 2 } }), detail(2, 4, { ai_risk: { score: 3 } })], config);
  assert.equal(few.stats[3]![0], 'TOP2 合計就業者数');
  assert.ok(few.highlights.includes('TOP2 の平均 AI 影響は 2.5/10'));
  const full = buildGenreResult(Array.from({ length: 36 }, (_, i) => detail(i + 1, 36 - i)), config);
  assert.equal(full.stats[3]![0], 'TOP30 合計就業者数');
});

test('hide_score hubs do not print their internal sort key as a スコア (#884)', () => {
  const sortKeyConfig: GenreHubConfig = {
    slug: 'sort-key', short_ja: '育児両立', title_ja: 't', description_ja: 'd', og_eyebrow: 'e',
    custom_filter: (d) => -(d.stats?.monthly_hours ?? 0), hide_score: true,
  };
  const details = [
    detail(1, 0, { stats: { monthly_hours: 141 }, ai_risk: { score: 2 } }),
    detail(2, 0, { stats: { monthly_hours: 150 }, ai_risk: { score: 3 } }),
  ];
  const result = buildGenreResult(details, sortKeyConfig);
  assert.deepEqual(result.stats.map(([label]) => label), ['平均 AI 影響', '平均年収', 'TOP2 合計就業者数']);
  assert.equal(result.highlights[0], '1 位は「Occupation 1」');
  assert.ok(!result.highlights.join('').includes('-141'));
});
