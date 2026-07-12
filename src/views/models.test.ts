import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildModelsPageModel, type ModelsPageInput } from './models.js';
import type { ScoreHistoryEntry } from '@/graph';

const dims = (base: number) => ({
  d1: base,
  d2: base,
  d3: base,
  d4: base,
  d5: base,
  d6: base,
  d7: base,
  d8: base,
  d9: base,
  d10: base,
  transformation: base,
  displacement: base / 2,
});

function entry(
  model: string,
  date: string,
  transformation: number,
  displacement: number | null,
): ScoreHistoryEntry {
  return {
    model,
    date,
    transformation,
    rationaleJa: '',
    displacement,
    dims: displacement == null ? null : dims(transformation),
    confidence: 0.8,
  };
}

function fixture(withFourthBatch = false): ModelsPageInput {
  const occ1 = [
    entry('claude-opus-4-7', '2026-04-25', 5.0, null),
    entry('claude-opus-4-8', '2026-05-30', 6.0, 2.0),
    entry('claude-fable-5', '2026-06-13', 7.0, 3.0),
  ];
  const occ2 = [
    entry('claude-opus-4-7', '2026-04-25', 4.0, null),
    entry('claude-opus-4-8', '2026-05-30', 3.0, 1.0),
    entry('claude-fable-5', '2026-06-13', 2.0, 0.5),
  ];
  if (withFourthBatch) {
    occ1.push(entry('gpt-5.6-sol', '2026-07-01', 8.0, 4.0));
    occ2.push(entry('gpt-5.6-sol', '2026-07-01', 1.0, 0.2));
  }
  return {
    historyByOcc: new Map([
      [1, occ1],
      [2, occ2],
    ]),
    titlesByOcc: new Map([
      [1, '職業A'],
      [2, '職業B'],
    ]),
    totalOccupations: 2,
  };
}

describe('buildModelsPageModel', () => {
  test('groups batches, marks latest run date as canonical, and excludes legacy from drift pairs', () => {
    const model = buildModelsPageModel(fixture());
    assert.deepEqual(model.batches.map((b) => b.model), [
      'claude-opus-4-7',
      'claude-opus-4-8',
      'claude-fable-5',
    ]);
    assert.equal(model.canonical.model, 'claude-fable-5');
    assert.equal(model.batches[0]!.meanDisplacement, null);
    assert.equal(model.driftPairs.length, 1);
    assert.equal(model.driftPairs[0]!.report.comparedCount, 2);
    assert.equal(model.driftPairs[0]!.report.meanDriftT, 0);
  });

  test('a fourth AIOIS batch extends summaries and drift pairs without code changes', () => {
    const model = buildModelsPageModel(fixture(true));
    assert.equal(model.batches.length, 4);
    assert.equal(model.canonical.model, 'gpt-5.6-sol');
    assert.equal(model.driftPairs.length, 2);
    assert.equal(model.latestPair?.candidate.model, 'gpt-5.6-sol');
    assert.deepEqual(model.largestDivergences.map((row) => row.id), [1, 2]);
  });
});
