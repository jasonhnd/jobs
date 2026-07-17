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
