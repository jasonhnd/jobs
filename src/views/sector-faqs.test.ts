/**
 * sector-faqs.test.ts — pin the sector hub FAQ Q/A pairs.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSectorFaqs, type SectorFaqsInput } from './sector-faqs.js';

const baseInput: SectorFaqsInput = {
  nameJa: '医療',
  occupationCount: 25,
  workforceTotal: 5_000_000,
  meanRisk: null,
  topWorkers: [],
  topHigh: [],
  topLow: [],
};

describe('buildSectorFaqs', () => {
  test('Q1 always emits (the "what kinds of jobs" question)', () => {
    const out = buildSectorFaqs(baseInput);
    assert.equal(out.length, 1);
    assert.ok(out[0][0].includes('どんな職業がありますか'));
  });

  test('Q1 includes occupation count + workforce total formatted with commas', () => {
    const out = buildSectorFaqs({ ...baseInput, occupationCount: 25, workforceTotal: 5_000_000 });
    assert.ok(out[0][1].includes('25の職業に分類'));
    assert.ok(out[0][1].includes('約5,000,000人'));
  });

  test('Q1 sample list: up to 3 topWorker titles joined by 「、」', () => {
    const out = buildSectorFaqs({
      ...baseInput,
      topWorkers: [
        { titleJa: '看護師', aiRisk: 4 },
        { titleJa: '医師', aiRisk: 3 },
        { titleJa: '薬剤師', aiRisk: 5 },
        { titleJa: '助産師', aiRisk: 2 },
      ],
    });
    assert.ok(out[0][1].includes('看護師、医師、薬剤師'));
    assert.ok(!out[0][1].includes('助産師'));
  });

  test('Q1 sample falls back to em-dash when topWorkers is empty', () => {
    const out = buildSectorFaqs({ ...baseInput, topWorkers: [] });
    assert.ok(out[0][1].includes('代表的な職業は—'));
  });

  test('Q2 (highest AI impact) skipped when topHigh is empty', () => {
    const out = buildSectorFaqs(baseInput);
    assert.ok(!out.some(([q]) => q.includes('最も高い')));
  });

  test('Q2 lists top 3 topHigh entries with N/10 inline scores', () => {
    const out = buildSectorFaqs({
      ...baseInput,
      topHigh: [
        { titleJa: 'A', aiRisk: 9 },
        { titleJa: 'B', aiRisk: 8 },
        { titleJa: 'C', aiRisk: 7 },
      ],
    });
    const q2 = out.find(([q]) => q.includes('最も高い'))!;
    assert.ok(q2[1].includes('A（AI影響 9/10）、B（AI影響 8/10）、C（AI影響 7/10）'));
  });

  test('Q3 (lowest AI impact) skipped when topLow is empty', () => {
    const out = buildSectorFaqs(baseInput);
    assert.ok(!out.some(([q]) => q.includes('最も低い')));
  });

  test('Q4 (mean risk tier) skipped when meanRisk is null', () => {
    const out = buildSectorFaqs(baseInput);
    assert.ok(!out.some(([q]) => q.includes('平均 AI 影響度は')));
  });

  test('Q4 tier labels: <=3.5 低め / <=5.5 中程度 / <=7.0 やや高め / >7.0 高め', () => {
    const tiers: Array<[number, string]> = [
      [2.0, '低め'],
      [4.5, '中程度'],
      [6.5, 'やや高め'],
      [8.0, '高め'],
    ];
    for (const [risk, expected] of tiers) {
      const out = buildSectorFaqs({ ...baseInput, meanRisk: risk });
      const q4 = out.find(([q]) => q.includes('平均 AI 影響度は'))!;
      assert.ok(q4[1].includes(`${expected}の水準`), `meanRisk=${risk} expected ${expected}`);
    }
  });

  test('Q5 (outlook) gated on meanRisk AND topLow both present', () => {
    // Has meanRisk, no topLow → Q5 skipped.
    const out1 = buildSectorFaqs({ ...baseInput, meanRisk: 3 });
    assert.ok(!out1.some(([q]) => q.includes('将来性は')));
    // Has topLow, no meanRisk → Q5 skipped.
    const out2 = buildSectorFaqs({
      ...baseInput,
      topLow: [{ titleJa: 'x', aiRisk: 1 }],
    });
    assert.ok(!out2.some(([q]) => q.includes('将来性は')));
  });

  test('Q5 outlook copy: meanRisk <= 4.0 → 比較的高い', () => {
    const out = buildSectorFaqs({
      ...baseInput,
      meanRisk: 3.5,
      topLow: [{ titleJa: 'safe1', aiRisk: 1 }],
    });
    const q5 = out.find(([q]) => q.includes('将来性は'))!;
    assert.ok(q5[1].includes('代替されにくい職業が多く、将来性が比較的高い'));
  });

  test('Q5 outlook copy: meanRisk >= 6.0 → 業界全体で', () => {
    const out = buildSectorFaqs({
      ...baseInput,
      meanRisk: 7.0,
      topLow: [{ titleJa: 'safe1', aiRisk: 1 }],
    });
    const q5 = out.find(([q]) => q.includes('将来性は'))!;
    assert.ok(q5[1].includes('業界全体で AI による業務変化'));
  });

  test('Q5 outlook copy: 4 < meanRisk < 6 → 個別に検討', () => {
    const out = buildSectorFaqs({
      ...baseInput,
      meanRisk: 5.0,
      topLow: [{ titleJa: 'safe1', aiRisk: 1 }],
    });
    const q5 = out.find(([q]) => q.includes('将来性は'))!;
    assert.ok(q5[1].includes('個別に検討'));
  });

  test('full input emits all 5 questions in order Q1→Q5', () => {
    const out = buildSectorFaqs({
      nameJa: '医療',
      occupationCount: 25,
      workforceTotal: 5_000_000,
      meanRisk: 4.5,
      topWorkers: [{ titleJa: '看護師', aiRisk: 4 }],
      topHigh: [{ titleJa: 'A', aiRisk: 9 }],
      topLow: [{ titleJa: 'B', aiRisk: 1 }],
    });
    assert.equal(out.length, 5);
    assert.ok(out[0][0].includes('どんな職業'));
    assert.ok(out[1][0].includes('最も高い'));
    assert.ok(out[2][0].includes('最も低い'));
    assert.ok(out[3][0].includes('平均 AI 影響度は'));
    assert.ok(out[4][0].includes('将来性は'));
  });
});
