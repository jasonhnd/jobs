import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { computeDriftReport, riskBand, type AioisScore } from './aiois-drift.js';

const sc = (aiRisk: number, displacement = aiRisk): AioisScore => ({
  aiRisk,
  displacement,
  dims: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  confidence: null,
});
const OPTS = { rankThreshold: 50, lowConfidence: 0.7 };

describe('aiois-drift riskBand', () => {
  test('uses the shared displayed-value bands (3.96 prints 4.0 → mid)', () => {
    assert.equal(riskBand(3.96), 'mid');
    assert.equal(riskBand(6.96), 'high');
    assert.equal(riskBand(3.94), 'low');
  });
});

describe('computeDriftReport tie order', () => {
  // Every row moves by exactly 0.3; the doubles differ (−0.29999999999999993,
  // −0.3000000000000007, …). Ties must fall back to id, not FP noise.
  const baseline = new Map<number, AioisScore>([
    [1, sc(0.7)], [2, sc(4.4)], [3, sc(1.3)], [4, sc(3.3)],
    [11, sc(0.4)], [12, sc(4.1)], [13, sc(1.0)], [14, sc(0.2)],
  ]);
  const candidate = new Map<number, AioisScore>([
    [1, sc(0.4)], [2, sc(4.1)], [3, sc(1.0)], [4, sc(3.0)],
    [11, sc(0.7)], [12, sc(4.4)], [13, sc(1.3)], [14, sc(0.5)],
  ]);
  const rep = computeDriftReport(baseline, candidate, new Map(), OPTS);

  test('equal decimal drops are ordered by id', () => {
    assert.deepEqual(rep.topDownT.map((r) => r.id), [1, 2, 3, 4]);
    assert.deepEqual(rep.topDownD.map((r) => r.id), [1, 2, 3, 4]);
  });

  test('equal decimal rises are ordered by id', () => {
    assert.deepEqual(rep.topUpT.map((r) => r.id), [11, 12, 13, 14]);
    assert.deepEqual(rep.topUpD.map((r) => r.id), [11, 12, 13, 14]);
  });

  test('manual review orders equal |dT| by id', () => {
    const flagged = computeDriftReport(baseline, candidate, new Map(), { rankThreshold: 0, lowConfidence: 0.7 });
    assert.deepEqual(flagged.manualReview.map((r) => r.id), [1, 2, 3, 4, 11, 12, 13, 14]);
  });
});
