import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import type { ScoreHistEntry } from '../../graph/score-strategy.js';
import type { Indexes } from '../lib/indexes.js';
import { buildModelsDeepPayload } from './models-deep.js';

function aiois(score: number) {
  return {
    d1: score,
    d2: score,
    d3: score,
    d4: score,
    d5: score,
    d6: score,
    d7: score,
    d8: score,
    d9: score,
    d10: score,
    transformation: score,
    displacement: score / 2,
  };
}

function score(model: string, date: string, aiRisk: number, rationale: string): ScoreHistEntry {
  return {
    model,
    date,
    ai_risk: aiRisk,
    rationale_ja: rationale,
    confidence: 0.9,
    aiois: aiois(aiRisk),
  };
}

function indexes(historyByOcc: Map<number, ScoreHistEntry[]>): Indexes {
  return {
    occById: new Map(
      [...historyByOcc.keys()].map((id) => [id, { id, title_ja: `職業${id}` }]),
    ),
    historyByOcc,
    latestScoreByOcc: new Map(),
    transById: new Map(),
    statsById: new Map(),
    runsByModel: new Map(),
    labelsByDim: new Map(),
    sectors: [],
    sectorOverrides: new Map(),
    sectorByOcc: new Map(),
  } as unknown as Indexes;
}

describe('models-deep projection', () => {
  test('uses the latest AIOIS pair, sorts by |dT| then id, and skips missing rationale', () => {
    const payload = buildModelsDeepPayload(indexes(new Map([
      [1, [
        score('older', '2026-01-01', 1, 'old 1'),
        score('base', '2026-02-01', 4, 'base 1'),
        score('cand', '2026-03-01', 8, 'cand 1'),
      ]],
      [2, [
        score('older', '2026-01-01', 1, 'old 2'),
        score('base', '2026-02-01', 2, 'base 2'),
        score('cand', '2026-03-01', 8, ''),
      ]],
      [3, [
        score('older', '2026-01-01', 1, 'old 3'),
        score('base', '2026-02-01', 5, 'base 3'),
        score('cand', '2026-03-01', 9, 'cand 3'),
      ]],
      [4, [
        score('older', '2026-01-01', 1, 'old 4'),
        score('base', '2026-02-01', 5, 'base 4'),
        score('cand', '2026-03-01', 5.5, 'cand 4'),
      ]],
    ])));

    assert.equal(payload.latest_pair?.baseline.model, 'base');
    assert.equal(payload.latest_pair?.candidate.model, 'cand');
    assert.deepEqual(payload.rationale_pairs.map((pair) => pair.id), [1, 3, 4]);
    assert.equal(payload.rationale_pairs[0]!.title_ja, '職業1');
    assert.equal(payload.rationale_pairs[0]!.href, '/1');
    assert.equal(payload.rationale_pairs[0]!.drift, 4);
    assert.equal(payload.rationale_pairs.some((pair) => pair.id === 2), false);
  });

  test('caps rationale fields at 500 UTF-8 bytes', () => {
    const long = '理由'.repeat(400);
    const payload = buildModelsDeepPayload(indexes(new Map([
      [1, [
        score('base', '2026-02-01', 2, long),
        score('cand', '2026-03-01', 8, long),
      ]],
    ])));

    const pair = payload.rationale_pairs[0]!;
    assert.ok(new TextEncoder().encode(pair.baseline_rationale_ja).length <= 500);
    assert.ok(new TextEncoder().encode(pair.candidate_rationale_ja).length <= 500);
  });
});
