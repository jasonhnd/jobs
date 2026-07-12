import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildModelsPageModel,
  buildTendencyNotes,
  renderTransformationHistogram,
  transformationHistogramBins,
  type ModelsPageInput,
} from './models.js';
import type { ScoreHistoryEntry } from '@/graph';
import { AIOIS10_DIMENSIONS } from '@/templates/Aiois10Profile';

const dimsFromValues = (values: readonly number[]) => ({
  d1: values[0]!,
  d2: values[1]!,
  d3: values[2]!,
  d4: values[3]!,
  d5: values[4]!,
  d6: values[5]!,
  d7: values[6]!,
  d8: values[7]!,
  d9: values[8]!,
  d10: values[9]!,
  transformation: values[0]!,
  displacement: values[0]! / 2,
});

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

function entryWithDims(
  model: string,
  date: string,
  transformation: number,
  values: readonly number[] | null,
): ScoreHistoryEntry {
  return {
    model,
    date,
    transformation,
    rationaleJa: '',
    displacement: values == null ? null : transformation / 2,
    dims: values == null ? null : dimsFromValues(values),
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
    aioisDimensions: AIOIS10_DIMENSIONS,
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

  test('derives per-dimension drift rows from comparable AIOIS entries and sorts by absolute drift', () => {
    const model = buildModelsPageModel({
      historyByOcc: new Map([
        [1, [
          entryWithDims('base', '2026-01-01', 5, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
          entryWithDims('cand', '2026-02-01', 6, [2, 1.6, 0.2, 1, 1, 1, 1, 1, 1, 1]),
        ]],
        [2, [
          entryWithDims('base', '2026-01-01', 5, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
          entryWithDims('cand', '2026-02-01', 4, [4, 3.4, 2.2, 3, 3, 3, 3, 3, 3, 3]),
        ]],
        [3, [
          entryWithDims('base', '2026-01-01', 5, null),
          entryWithDims('cand', '2026-02-01', 7, [9, 9, 9, 9, 9, 9, 9, 9, 9, 9]),
        ]],
      ]),
      titlesByOcc: new Map([[1, 'A'], [2, 'B'], [3, 'C']]),
      totalOccupations: 3,
      aioisDimensions: AIOIS10_DIMENSIONS,
    });

    const rows = model.driftPairs[0]!.dimensionRows;
    assert.equal(model.driftPairs[0]!.report.comparedCount, 2);
    assert.equal(rows[0]!.dimension, 'D1');
    assert.equal(rows[0]!.dimensionJa, '頭脳・情報の仕事');
    assert.equal(rows[0]!.baselineMean, 2);
    assert.equal(rows[0]!.candidateMean, 3);
    assert.equal(rows[0]!.drift, 1);
    assert.equal(rows[1]!.dimension, 'D3');
    assert.ok(Math.abs(rows[1]!.drift + 0.8) < 1e-9);
    assert.equal(rows[2]!.dimension, 'D2');
    assert.ok(Math.abs(rows[2]!.drift - 0.5) < 1e-9);
  });

  test('selects fixed tendency-note templates by threshold, degree, tie-break, and fallback', () => {
    const notes = buildTendencyNotes([
      { dimension: 'D3', dimensionJa: '体・現場の仕事', drift: -0.75 },
      { dimension: 'D1', dimensionJa: '頭脳・情報の仕事', drift: 0.75 },
      { dimension: 'D2', dimensionJa: '決まった手順のくり返し', drift: 0.5 },
      { dimension: 'D4', dimensionJa: '判断と責任', drift: -0.49 },
    ], 'Base', 'Candidate');

    assert.deepEqual(notes, [
      'Candidate は Base より「頭脳・情報の仕事（D1）」を大きく重く見ています（+0.75）。',
      'Candidate は Base より「体・現場の仕事（D3）」を大きく軽く見ています（-0.75）。',
      'Candidate は Base より「決まった手順のくり返し（D2）」をやや重く見ています（+0.50）。',
    ]);
    assert.deepEqual(
      buildTendencyNotes([{ dimension: 'D1', dimensionJa: '頭脳・情報の仕事', drift: 0.49 }], 'Base', 'Candidate'),
      ['このペアでは、平均差が0.50以上のD1〜D10はありません。'],
    );
  });

  test('static SVG histogram uses 20 fixed bins and fallback stats', () => {
    const bins = transformationHistogramBins([0, 0.49, 0.5, 9.9, 10]);
    assert.equal(bins.length, 20);
    assert.equal(bins[0], 2);
    assert.equal(bins[1], 1);
    assert.equal(bins[19], 2);

    const model = buildModelsPageModel(fixture());
    const chart = renderTransformationHistogram(model.latestPair!);
    assert.match(chart.svg, /role="img"/);
    assert.match(chart.svg, /最新2バッチのAI影響度分布/);
    assert.match(chart.fallback, /平均/);
    assert.match(chart.fallback, /中央値/);
    assert.match(chart.fallback, /高帯/);
  });
});
