import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { asOccupationId, type KnowledgeGraph, type OccupationNode } from '@/graph';
import type { CompareSide } from '@/views/compare-hub.js';
import {
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
      aiRisk: displacement === null
        ? { aiois: null }
        : { aiois: { displacement } },
    } as OccupationNode);
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

  test('kango-vs-helper displacements are the live consensus medians', async () => {
    const { loadGraph } = await import('@/graph');
    const graph = await loadGraph();
    const a = graph.occupations.get(asOccupationId(156))?.aiRisk?.aiois?.displacement ?? null;
    const b = graph.occupations.get(asOccupationId(133))?.aiRisk?.aiois?.displacement ?? null;
    assert.equal(a, 0.55);
    assert.equal(b, 0.6);
  });
});

describe('renderCompareMetricRows', () => {
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
