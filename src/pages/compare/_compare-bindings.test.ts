import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { asOccupationId, type KnowledgeGraph, type OccupationNode } from '@/graph';
import type { CompareResult, CompareSide } from '@/views/compare-hub.js';
import { COMPARE_META } from '@/views/compare-meta';
import { computeGeoFacts } from '@/site/geo-facts';
import {
  buildComparePairBindings,
  buildCompareMetricRows,
  renderCompareMetricRows,
} from './_compare-bindings.ts';

function side(overrides: Partial<CompareSide> & Pick<CompareSide, 'id'>): CompareSide {
  return {
    name_ja: `job-${overrides.id}`,
    ai_risk: 3,
    risk_band: 'low',
    rationale_ja: null,
    summary_ja: null,
    salary: 400,
    workers: 10000,
    monthly_hours: 160,
    average_age: 40,
    recruit_ratio: 1.2,
    sector_id: 'iryo',
    sector_ja: '医療',
    related_certs_ja: ['資格A'],
    top_skills: [],
    ...overrides,
  };
}

function graphWithDisplacement(pairs: ReadonlyArray<readonly [number, number | null]>): KnowledgeGraph {
  const occupations = new Map();
  for (const [id, displacement] of pairs) {
    occupations.set(asOccupationId(id), {
      titleJa: `job-${id}`,
      aliasesJa: [],
      aiRisk: displacement === null
        ? { aiois: null }
        : { aiois: { displacement } },
    } as unknown as OccupationNode);
  }
  return { occupations } as unknown as KnowledgeGraph;
}

describe('buildCompareMetricRows', () => {
  test('accents higher salary, shorter hours, higher recruit ratio; leaves the rest neutral', () => {
    const rows = buildCompareMetricRows(
      side({ id: 1, salary: 520, monthly_hours: 155, recruit_ratio: 2.2, workers: 690000 }),
      side({ id: 2, salary: 381, monthly_hours: 163, recruit_ratio: 15, workers: 280000 }),
      graphWithDisplacement([[1, 0.6], [2, 0.5]]),
    );
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    assert.equal(byLabel['年収 (平均)']?.win, 'a');
    assert.equal(byLabel['年収 (平均)']?.a, '520万円');
    assert.equal(byLabel['仕事が減るリスク']?.win, null);
    assert.equal(byLabel['仕事が減るリスク']?.a, '0.6/10');
    assert.equal(byLabel['仕事が減るリスク']?.b, '0.5/10');
    assert.equal(byLabel['就業者数']?.win, null);
    assert.equal(byLabel['就業者数']?.a, '69万人');
    assert.equal(byLabel['就業者数']?.b, '28万人');
    assert.equal(byLabel['月労働時間']?.win, 'a');
    assert.equal(byLabel['月労働時間']?.a, '155h');
    assert.equal(byLabel['関連資格']?.win, null);
    assert.equal(byLabel['求人倍率']?.win, 'b');
    assert.equal(byLabel['求人倍率']?.b, '15.0倍');
  });

  test('skips a row when either side lacks the value', () => {
    const rows = buildCompareMetricRows(
      side({ id: 1, salary: null, monthly_hours: 150, recruit_ratio: null, workers: null }),
      side({ id: 2, salary: 400, monthly_hours: null, recruit_ratio: 1.1, workers: 10 }),
      graphWithDisplacement([[1, 0.6], [2, null]]),
    );
    const labels = rows.map((r) => r.label);
    assert.equal(labels.includes('年収 (平均)'), false);
    assert.equal(labels.includes('仕事が減るリスク'), false);
    assert.equal(labels.includes('就業者数'), false);
    assert.equal(labels.includes('月労働時間'), false);
    assert.equal(labels.includes('求人倍率'), false);
    assert.equal(labels.includes('関連資格'), true);
  });

  test('kango-vs-helper displacements are the live vendor-flagship means', async () => {
    const { loadGraph } = await import('@/graph');
    const { buildIndexes } = await import('@/data/lib/indexes.js');
    const graph = await loadGraph();
    const { indexes } = await buildIndexes();
    const a = graph.occupations.get(asOccupationId(156))?.aiRisk?.aiois?.displacement ?? null;
    const b = graph.occupations.get(asOccupationId(133))?.aiRisk?.aiois?.displacement ?? null;
    assert.equal(a, indexes.flagshipByOcc.get(156)?.displacement);
    assert.equal(b, indexes.flagshipByOcc.get(133)?.displacement);
  });
});

describe('buildComparePairBindings', () => {
  const graph = graphWithDisplacement([[1, 1], [404, 2], [3, null]]);
  const facts = computeGeoFacts([
    { id: 1, name_ja: 'job-1', ai_risk: 3, workers: 100, sector_id: null, sector_ja: null },
    { id: 404, name_ja: 'job-404', ai_risk: 7, workers: 200, sector_id: null, sector_ja: null },
  ], [{ scope: 'occupations', scorer: { model: 'grok-4.6', model_provider: 'xai' },
    run: { run_date: '2026-09-01' }, scores: {
      '1': { ai_risk: 3, aiois: { displacement: 1 } },
      '404': { ai_risk: 7, aiois: { displacement: 2 } },
    } }]);
  const result: CompareResult = {
    meta: { ...COMPARE_META.find(meta => meta.slug === 'kango-vs-helper')!,
      occ_a_id: 1, occ_b_id: 404, title_ja: 'Compare & <title>',
      description_ja: 'job-1 job-404 job-3 & <intro>',
      comparison_points_ja: ['Point & <x>'], decision_hints_ja: ['Hint & <x>'] },
    a: side({ id: 1, salary: 520, workers: 100, top_skills: [{ key: 's', label_ja: 'Skill & <x>', score: 4.5 }] }),
    b: side({ id: 404, ai_risk: 7, salary: 400, workers: 200 }),
    rows: [{ label: 'Metric <x>', a_val: 'A & x', b_val: 'B <x>', note: 'Note & x' }],
    faqItems: [['Question <x>?', 'Answer & x']],
  };

  test('assembles escaped sections, GEO data, related links, metadata and JSON-LD', () => {
    const before = structuredClone(result);
    const bindings = buildComparePairBindings(result, graph, facts);
    assert.equal(bindings.canonical, 'https://mirai-shigoto.com/compare/kango-vs-helper');
    assert.equal(bindings.ogImage, 'https://mirai-shigoto.com/api/og?compare=kango-vs-helper');
    assert.ok(bindings.title.startsWith(result.meta.title_ja));
    assert.ok(bindings.seoDesc.startsWith(`${result.a.name_ja} と ${result.b.name_ja}`));
    assert.ok(bindings.seoDesc.endsWith(result.meta.description_ja + '…'));
    assert.match(bindings.heroHtml, /href="\/1"/);
    assert.match(bindings.heroHtml, /href="\/occupations\/404"/);
    assert.match(bindings.duelBarHtml, /class="duel-bar"/);
    assert.match(bindings.metricRowsHtml, /class="cm-a win num"/);
    assert.match(bindings.tableHtml, /Metric &lt;x&gt;/);
    assert.match(bindings.tableHtml, /A &amp; x/);
    assert.match(bindings.tableHtml, /B &lt;x&gt;/);
    assert.match(bindings.skillsHtml, /Skill &amp; &lt;x&gt;/);
    assert.match(bindings.faqHtml, /Question &lt;x&gt;\?/);
    assert.match(bindings.faqHtml, /Answer &amp; x/);
    assert.equal(bindings.pointsHtml, '<ul class="compare-points"><li>Point &amp; &lt;x&gt;</li></ul>');
    assert.equal(bindings.hintsHtml, '<ul class="decision-hints"><li>Hint &amp; &lt;x&gt;</li></ul>');
    assert.match(bindings.introHtml, /href="\/3"/);
    assert.ok(!bindings.introHtml.includes('href="/1"'));
    assert.ok(!bindings.introHtml.includes('href="/occupations/404"'));
    assert.match(bindings.introHtml, /&amp; &lt;intro&gt;/);
    assert.match(bindings.aiFactHtml, /2職業の平均AI影響度は5\.0\/10 変化 中くらい/);
    assert.doesNotMatch(bindings.aiFactHtml, /5\.00\/10/);
    assert.match(bindings.aiFactHtml, /300人/);
    assert.match(bindings.crossHubHtml, /href="\//);
    assert.ok(!bindings.relatedHtml.includes('href="/compare/kango-vs-helper"'));
    assert.equal([...bindings.relatedHtml.matchAll(/class="rc-title"/g)].length, 6);
    const nodes = JSON.parse(bindings.jsonLd)['@graph'];
    const [web, article, breadcrumb, faq] = nodes;
    assert.equal(web.url, bindings.canonical);
    assert.equal(web.description, bindings.seoDesc);
    assert.equal(web.breadcrumb['@id'], breadcrumb['@id']);
    assert.equal(article.headline, result.meta.title_ja);
    assert.equal(article.image, bindings.ogImage);
    assert.deepEqual(article.about.map((item: { url: string }) => item.url),
      ['https://mirai-shigoto.com/1', 'https://mirai-shigoto.com/occupations/404']);
    assert.equal(faq['@type'], 'FAQPage');
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, result.faqItems[0]![1]);
    assert.deepEqual(result, before);
  });

  test('empty optional lists omit FAQ JSON-LD and keep a valid table and text lists', () => {
    const bindings = buildComparePairBindings({ ...result, rows: [], faqItems: [],
      meta: { ...result.meta, comparison_points_ja: [], decision_hints_ja: [], description_ja: 'x'.repeat(120) },
    }, graph, facts);
    assert.equal(bindings.pointsHtml, '<ul class="compare-points"></ul>');
    assert.equal(bindings.hintsHtml, '<ul class="decision-hints"></ul>');
    assert.equal(bindings.faqHtml, '');
    assert.match(bindings.tableHtml, /<tbody><\/tbody>/);
    assert.ok(bindings.seoDesc.endsWith('x'.repeat(100) + '…'));
    assert.deepEqual(JSON.parse(bindings.jsonLd)['@graph'].map((node: { '@type': string }) => node['@type']),
      ['WebPage', 'Article', 'BreadcrumbList']);
  });

  test('rejects an incomplete GEO comparison rather than emitting mismatched facts', () => {
    assert.throws(() => buildComparePairBindings({ ...result, b: side({ id: 3 }) }, graph, facts),
      /expected 2 GEO occupations/);
  });
});

describe('renderCompareMetricRows', () => {
  test('empty rows and numeric text without a recognized unit', () => {
    assert.equal(renderCompareMetricRows([]), '');
    assert.match(renderCompareMetricRows([{ label: 'Metric', a: '<1>', b: '2', win: 'b', kind: 'num' }]),
      /class="cm-a num">&lt;1&gt;<\/span>/);
  });
  test('marks the winning cell, splits units, and escapes labels', () => {
    const html = renderCompareMetricRows([
      { label: '年収 (平均)', a: '520万円', b: '381万円', win: 'a', kind: 'num' },
      { label: '仕事が減るリスク', a: '0.6/10', b: '0.5/10', win: null, kind: 'num' },
      { label: '<x>', a: '1', b: '2', win: null, kind: 'text' },
    ]);
    assert.match(html, /class="cm-a win num"><span class="cm-val">520<\/span><small>万円<\/small>/);
    assert.match(html, /class="cm-b num"><span class="cm-val">381<\/span><small>万円<\/small>/);
    assert.match(html, /仕事が減る<wbr>リスク/);
    assert.match(html, /<small>\/10<\/small>/);
    assert.match(html, /&lt;x&gt;/);
  });
});
