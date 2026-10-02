// Tests for scripts/aiois-drift-report.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { computeDriftReport, renderDriftMarkdown, riskBand, type AioisScore } from './aiois-drift-report.js';

const sc = (aiRisk: number, displacement: number, d1 = 5, confidence: number | null = 0.8): AioisScore => ({
  aiRisk,
  displacement,
  dims: [d1, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  confidence,
});

// 4 common ids; id 8 baseline-only and id 9 candidate-only must be excluded.
const BASELINE = new Map<number, AioisScore>([
  [1, sc(8.0, 6.0, 8)],
  [2, sc(3.0, 1.0)],
  [3, sc(5.0, 2.0)],
  [4, sc(6.0, 2.5)],
  [8, sc(4.0, 1.0)],
]);
const CANDIDATE = new Map<number, AioisScore>([
  [1, sc(6.0, 3.0, 6)],
  [2, sc(3.5, 1.2)],
  [3, sc(5.0, 2.0, 5, 0.5)],
  [4, sc(7.5, 3.0)],
  [9, sc(2.0, 0.5)],
]);
const TITLES = new Map<number, string>([
  [1, '甲'],
  [2, '乙'],
  [3, '丙'],
  [4, '丁'],
]);

const OPTS = { rankThreshold: 10, lowConfidence: 0.7 };
const rep = computeDriftReport(BASELINE, CANDIDATE, TITLES, OPTS);

describe('computeDriftReport', () => {
  test('compares only the common id set', () => {
    assert.equal(rep.comparedCount, 4);
    assert.deepEqual(rep.rows.map((r) => r.id), [1, 2, 3, 4]);
  });

  test('mean transformation / displacement drift', () => {
    // dT: −2.0, +0.5, 0, +1.5 → mean 0, mean abs 1.0
    assert.ok(Math.abs(rep.meanDriftT) < 1e-9);
    assert.ok(Math.abs(rep.meanAbsDriftT - 1.0) < 1e-9);
    // dD: −3.0, +0.2, 0, +0.5 → mean −0.575
    assert.ok(Math.abs(rep.meanDriftD - -0.575) < 1e-9);
  });

  test('per-dimension drift (only d1 differs, on id 1)', () => {
    assert.ok(Math.abs(rep.dimDrift[0]! - -0.5) < 1e-9);
    assert.ok(Math.abs(rep.dimAbsDrift[0]! - 0.5) < 1e-9);
    assert.ok(Math.abs(rep.dimDrift[1]!) < 1e-9);
  });

  test('band matrix and crossings', () => {
    assert.equal(rep.bandMatrix.high.mid, 1); // id 1: 8.0 → 6.0
    assert.equal(rep.bandMatrix.mid.high, 1); // id 4: 6.0 → 7.5
    assert.equal(rep.bandMatrix.low.low, 1); // id 2
    assert.equal(rep.bandMatrix.mid.mid, 1); // id 3
    assert.equal(rep.bandCrossCount, 2);
  });

  test('ranks within the common set (1 = highest T)', () => {
    const r1 = rep.rows.find((r) => r.id === 1)!;
    assert.equal(r1.baseRank, 1);
    assert.equal(r1.candRank, 2);
    assert.equal(r1.rankShift, 1);
  });

  test('runbook flags: drift ≥1.5, band crossing, low confidence', () => {
    const f = (id: number): readonly string[] => rep.rows.find((r) => r.id === id)!.flags;
    assert.ok(f(1).includes('T-drift≥1.5'));
    assert.ok(f(1).includes('D-drift≥1.5'));
    assert.ok(f(1).includes('band:high→mid'));
    assert.ok(f(4).includes('T-drift≥1.5')); // exactly 1.5 counts
    assert.ok(f(4).includes('band:mid→high'));
    assert.ok(f(3).includes('low-confidence<0.7'));
    assert.equal(f(2).length, 0);
  });

  test('manual review list: flagged rows, sorted by |dT| desc', () => {
    assert.deepEqual(rep.manualReview.map((r) => r.id), [1, 4, 3]);
  });

  test('top movers ordered correctly', () => {
    assert.deepEqual(rep.topUpT.map((r) => r.id), [4, 2]);
    assert.deepEqual(rep.topDownT.map((r) => r.id), [1]);
    assert.deepEqual(rep.topDownD.map((r) => r.id), [1]);
  });

  test('rank-shift flag honors threshold', () => {
    const tight = computeDriftReport(BASELINE, CANDIDATE, TITLES, { ...OPTS, rankThreshold: 1 });
    assert.ok(tight.rows.find((r) => r.id === 1)!.flags.includes('rank-shift≥1'));
  });
});

describe('riskBand / renderDriftMarkdown', () => {
  test('band boundaries', () => {
    assert.equal(riskBand(3.9), 'low');
    assert.equal(riskBand(7.0), 'high');
  });

  test('markdown contains the runbook sections and the row data', () => {
    const md = renderDriftMarkdown(rep, {
      baseModel: 'claude-opus-4-8',
      baseDate: '2026-05-30',
      candModel: 'claude-fable-5',
      candDate: '2026-06-13',
      rankThreshold: 10,
      baseMethodId: 'aiois-vector-semantic-hybrid',
      candMethodId: 'aiois-semantic-judgment',
    });
    assert.ok(md.includes('## Summary'));
    assert.ok(md.includes('## D1–D10 平均 drift'));
    assert.ok(md.includes('## Band movement'));
    assert.ok(md.includes('Manual review list'));
    assert.ok(md.includes('| 1 | 甲 |'));
    assert.ok(md.includes('D2–D10 vector engine'));
    assert.ok(md.includes('評価方式の変更'));
  });

  test('same-method Fable 5 → GPT 5.6 report has no historical vector caveat', () => {
    const md = renderDriftMarkdown(rep, {
      baseModel: 'claude-fable-5',
      baseDate: '2026-06-13',
      candModel: 'gpt-5.6-sol',
      candDate: '2026-07-12',
      rankThreshold: 10,
      baseMethodId: 'aiois-semantic-judgment',
      candMethodId: 'aiois-semantic-judgment',
    });

    assert.ok(md.includes('両バッチとも AIOIS semantic judgment'));
    assert.ok(md.includes('評価方式の変更は含まれません'));
    assert.equal(/vector engine/i.test(md), false);
  });
});

describe('drift report edge cases', () => {
  const meta = {
    baseModel: 'baseline', baseDate: '2026-01-01',
    candModel: 'candidate', candDate: '2026-01-02', rankThreshold: 10,
    baseMethodId: 'legacy-single-axis' as const,
    candMethodId: 'legacy-single-axis' as const,
  };

  test('disjoint batches render zero summaries and every empty section', () => {
    const empty = computeDriftReport(new Map([[1, sc(5, 2)]]), new Map([[2, sc(8, 4)]]), TITLES, OPTS);
    assert.equal(empty.comparedCount, 0);
    assert.deepEqual(empty.rows, []);
    assert.equal(empty.meanDriftT, 0);
    assert.equal(empty.meanAbsDriftT, 0);
    assert.equal(empty.meanDriftD, 0);
    assert.equal(empty.meanAbsDriftD, 0);
    assert.deepEqual(empty.dimDrift, Array(10).fill(0));
    assert.deepEqual(empty.dimAbsDrift, Array(10).fill(0));
    assert.deepEqual(empty.bandMatrix, {
      low: { low: 0, mid: 0, high: 0 },
      mid: { low: 0, mid: 0, high: 0 },
      high: { low: 0, mid: 0, high: 0 },
    });
    const md = renderDriftMarkdown(empty, meta);
    assert.ok(md.startsWith('# AIOIS-10 drift report — baseline (2026-01-01) vs candidate (2026-01-02)\n'));
    assert.equal((md.match(/\(該当なし\)/g) ?? []).length, 6);
    assert.ok(md.includes('legacy single-axis judgment'));
    assert.ok(md.includes('Band crossings: **0 / 0**'));
    for (let k = 1; k <= 10; k += 1) assert.ok(md.includes(`| D${k} | +0.00 | 0.00 |`));
    assert.ok(md.endsWith('|---|---|---|---|---|---|---|---|\n\n'));
  });

  test('renders missing title/confidence and empty flags without losing zero values', () => {
    const baseline = new Map([[900001, sc(4, 0)]]);
    const candidate = new Map([[900001, sc(4, 0, 5, null)]]);
    const unchanged = computeDriftReport(baseline, candidate, new Map(), OPTS);
    assert.deepEqual(unchanged.rows[0]!.flags, []);
    const row = '| 900001 | (id 900001) | 4.0 → 4.0 (+0.00) | 0.0 → 0.0 (+0.00) | mid→mid | 1→1 | – | – |';
    assert.ok(renderDriftMarkdown(unchanged, meta).includes(row));
    const zeroConfidence = computeDriftReport(baseline, new Map([[900001, sc(4, 0, 5, 0)]]), new Map(), OPTS);
    assert.ok(renderDriftMarkdown(zeroConfidence, meta).includes('| 1→1 | 0 | low-confidence<0.7 |'));
  });

  test('renders signed changes, dimension means, band counts and flags exactly', () => {
    const md = renderDriftMarkdown(rep, meta);
    assert.ok(md.includes('Mean transformation drift: **+0.00** (mean |drift| 1.00)'));
    assert.ok(md.includes('Mean displacement drift: **-0.57** (mean |drift| 0.93)'));
    assert.ok(md.includes('| D1 | -0.50 | 0.50 |'));
    assert.ok(md.includes('| low | 1 | 0 | 0 |'));
    assert.ok(md.includes('| mid | 0 | 1 | 1 |'));
    assert.ok(md.includes('| high | 0 | 1 | 0 |'));
    assert.ok(md.includes('| 1 | 甲 | 8.0 → 6.0 (-2.00) | 6.0 → 3.0 (-3.00) | high→mid | 1→2 | 0.8 | T-drift≥1.5, D-drift≥1.5, band:high→mid |'));
    assert.ok(md.includes('| 2 | 乙 | 3.0 → 3.5 (+0.50) | 1.0 → 1.2 (+0.20) | low→low | 4→4 | 0.8 | – |'));
  });

  test('ties rank by numeric id and confidence at the threshold is accepted', () => {
    const tied = new Map([[10, sc(5, 2, 5, 0.7)], [2, sc(5, 2, 5, 0.7)]]);
    const report = computeDriftReport(tied, tied, new Map(), OPTS);
    assert.deepEqual(report.rows.map((r) => [r.id, r.baseRank, r.candRank, r.flags]), [[2, 1, 1, []], [10, 2, 2, []]]);
    assert.deepEqual(report.manualReview, []);
    assert.equal(riskBand(4), 'mid');
    assert.equal(riskBand(6.9), 'mid');
  });
});
