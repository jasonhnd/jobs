import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import type { ScoreHistEntry } from '../graph/score-strategy.js';
import { buildRankingMoversFromHistory, latestLandedBatch } from './ranking-movers.js';

const PROVIDER: Record<string, string> = {
  'claude-opus-5-5': 'anthropic',
  'grok-4.7': 'xai',
  'gpt-6-sol': 'openai',
  'gpt-6.1-sol': 'openai',
  'grok-4.5': 'xai',
};

function vote(model: string, date: string, t: number, d = t, opts: { backfill?: boolean } = {}): ScoreHistEntry {
  return {
    model,
    provider: PROVIDER[model] ?? 'fixture',
    date,
    ...(opts.backfill ? { backfill: true } : {}),
    ai_risk: t,
    rationale_ja: `${model}@${date}`,
    confidence: 0.8,
    aiois: {
      d1: t, d2: t, d3: 5, d4: 5, d5: 5, d6: 5, d7: 5, d8: 5, d9: 5, d10: 5,
      transformation: t,
      displacement: d,
    },
  };
}

/** Opus + Grok on 09-23, GPT 6 SOL on 09-23, then GPT 6.1 SOL lands on 10-01. */
function panel(opus: number, grok: number, sol6: number, sol61: number, disp: [number, number, number, number] = [opus, grok, sol6, sol61]) {
  return [
    vote('claude-opus-5-5', '2026-09-23', opus, disp[0]),
    vote('grok-4.7', '2026-09-23', grok, disp[1]),
    vote('gpt-6-sol', '2026-09-23', sol6, disp[2]),
    vote('gpt-6.1-sol', '2026-10-01', sol61, disp[3]),
  ];
}

const titles = new Map<number, string>([[1, 'Alpha'], [2, 'Beta'], [3, 'Gamma'], [4, 'Delta'], [5, 'Eps']]);

describe('latestLandedBatch', () => {
  test('is the newest non-backfill comparable date and the models scored on it', () => {
    const history = new Map<number, ScoreHistEntry[]>([
      [1, [...panel(4, 4, 4, 4), vote('grok-4.5', '2099-12-31', 9, 9, { backfill: true })]],
      [2, [vote('claude-opus-5-5', '2026-10-01', 3), vote('gpt-6.1-sol', '2026-10-01', 3)]],
    ]);
    assert.deepEqual(latestLandedBatch(history), { date: '2026-10-01', models: ['claude-opus-5-5', 'gpt-6.1-sol'] });
  });

  test('throws when there is no comparable batch', () => {
    assert.throws(() => latestLandedBatch(new Map()), /no comparable/);
  });
});

describe('buildRankingMoversFromHistory (owner option A, #863)', () => {
  test('delta is the change of the published mean, not of one model (id 213 shape)', () => {
    // Before: mean(4.4, 4.5, 4.5) = 4.4667 → 4.5. After: mean(4.4, 4.5, 6.2) = 5.0333 → 5.0.
    // The single-model diff would have shown 4.5 → 6.2 (+1.7).
    const movers = buildRankingMoversFromHistory(new Map([[1, panel(4.4, 4.5, 4.5, 6.2)]]), titles);
    assert.deepEqual(movers.transformation.up, [
      { id: 1, name: 'Alpha', base: 4.5, current: 5.0, delta: 0.5, familyCode: null },
    ]);
    assert.deepEqual(movers.transformation.down, []);
    assert.deepEqual(movers.meta.landed, { date: '2026-10-01', models: ['gpt-6.1-sol'] });
    assert.equal(movers.meta.comparedCount, 1);
  });

  test('base, current and delta are the displayed values (delta = current − base as printed)', () => {
    // Before 4.4667 → 4.5; after mean(4.4, 4.5, 4.6) = 4.5 → 4.5: no displayed change → not a mover.
    // id 2: before mean(2.0, 2.1, 2.1) = 2.0667 → 2.1; after mean(2.0, 2.1, 1.4) = 1.8333 → 1.8 (−0.3).
    const movers = buildRankingMoversFromHistory(new Map([
      [1, panel(4.4, 4.5, 4.5, 4.6)],
      [2, panel(2.0, 2.1, 2.1, 1.4)],
    ]), titles);
    assert.deepEqual(movers.transformation.up, []);
    assert.deepEqual(movers.transformation.down, [
      { id: 2, name: 'Beta', base: 2.1, current: 1.8, delta: -0.3, familyCode: null },
    ]);
  });

  test('displacement movers use the published displacement mean', () => {
    const movers = buildRankingMoversFromHistory(new Map([
      [3, panel(5, 5, 5, 5, [3.0, 3.0, 3.0, 6.0])], // 3.0 → 4.0
    ]), titles);
    assert.deepEqual(movers.displacement.up, [
      { id: 3, name: 'Gamma', base: 3.0, current: 4.0, delta: 1.0, familyCode: null },
    ]);
    assert.deepEqual(movers.transformation.up, []);
  });

  test('equal displayed deltas are ordered by id; topN applies', () => {
    const movers = buildRankingMoversFromHistory(new Map([
      [4, panel(4.4, 4.4, 4.4, 5.3)], // 4.4 → 4.7
      [2, panel(1.1, 1.1, 1.1, 2.0)], // 1.1 → 1.4
      [3, panel(7.0, 7.0, 7.0, 7.9)], // 7.0 → 7.3
      [1, panel(3.0, 3.0, 3.0, 5.4)], // 3.0 → 3.8
    ]), titles, { topN: 3, familyById: new Map([[2, 'office']]) });
    assert.deepEqual(movers.transformation.up.map((row) => [row.id, row.delta]), [[1, 0.8], [2, 0.3], [3, 0.3]]);
    assert.equal(movers.transformation.up[1]!.familyCode, 'office');
  });

  test('occupations without a published score before the latest batch are not compared', () => {
    const movers = buildRankingMoversFromHistory(new Map([
      [1, panel(4.4, 4.5, 4.5, 6.2)],
      [5, [vote('gpt-6.1-sol', '2026-10-01', 9.0)]],
    ]), titles);
    assert.equal(movers.meta.comparedCount, 1);
    assert.deepEqual(movers.transformation.up.map((row) => row.id), [1]);
  });

  test('a backfill batch is neither the landed batch nor part of either side (mms-9)', () => {
    const base = panel(4.4, 4.5, 4.5, 6.2);
    const withBackfill = [...base, vote('grok-4.5', '2099-12-31', 9.9, 9.9, { backfill: true })];
    const a = buildRankingMoversFromHistory(new Map([[1, base]]), titles);
    const b = buildRankingMoversFromHistory(new Map([[1, withBackfill]]), titles);
    assert.deepEqual(b, a);
  });

  test('throws when no occupation has a published score before the latest batch', () => {
    assert.throws(
      () => buildRankingMoversFromHistory(new Map([[5, [vote('gpt-6.1-sol', '2026-10-01', 9.0)]]]), titles),
      /before the latest batch/,
    );
  });
});
