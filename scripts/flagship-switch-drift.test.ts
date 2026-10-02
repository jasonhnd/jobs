import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { displayScore } from '../src/data/lib/banker-round.js';
import { fmean } from '../src/data/lib/fsum.js';
import {
  pickConsensusScore,
  pickFlagshipMeanScore,
  type ScoreHistEntry,
} from '../src/graph/score-strategy.js';
import type { Aiois10 } from '../src/graph/types.js';
import {
  computeFlagshipSwitchDrift,
  formatSwitchDriftSummaryLine,
  renderFlagshipSwitchMarkdown,
} from './flagship-switch-drift.ts';

function aioisAt(value: number): Aiois10 {
  return {
    d1: value, d2: value, d3: value, d4: value, d5: value,
    d6: value, d7: value, d8: value, d9: value, d10: value,
    transformation: value,
    displacement: value,
  };
}

function providerOf(model: string): string {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt')) return 'openai';
  if (model.startsWith('grok')) return 'xai';
  return 'test';
}

function vote(model: string, date: string, transformation: number): ScoreHistEntry {
  return {
    model,
    provider: providerOf(model),
    date,
    ai_risk: transformation,
    rationale_ja: `${model}@${date}`,
    aiois: aioisAt(transformation),
  };
}

const INCOMING = 'claude-fable-5-1';

/** Five old AIOIS-10 votes + one incoming Anthropic run, dates inside the 6-month window. */
function history(
  opus48: number,
  fable5: number,
  opus5: number,
  sol: number,
  grok: number,
  incoming: number,
): ScoreHistEntry[] {
  return [
    vote('claude-opus-4-8', '2026-04-01', opus48),
    vote('claude-fable-5', '2026-05-01', fable5),
    vote('gpt-5.6-sol', '2026-06-01', sol),
    vote('claude-opus-5', '2026-07-01', opus5),
    vote('grok-4.6', '2026-08-01', grok),
    vote(INCOMING, '2026-09-01', incoming),
  ];
}

describe('flagship switch drift', () => {
  test('synthetic 3-occupation history: 5-vote median vs 3-vendor mean with incoming Anthropic', () => {
    const occ1 = history(2, 4, 6, 8, 10, 9);
    const occ2 = history(4, 4, 5, 5, 6, 6.5);
    const occ3 = history(4, 4, 4, 4, 4, 8);
    const historyByOcc = new Map<number, ScoreHistEntry[]>([
      [10, occ1],
      [20, occ2],
      [30, occ3],
    ]);
    const titles = new Map<number, string>([
      [10, '職業10'],
      [20, '職業20'],
      [30, '職業30'],
    ]);

    const without1 = occ1.filter((e) => e.model !== INCOMING);
    const without2 = occ2.filter((e) => e.model !== INCOMING);
    const without3 = occ3.filter((e) => e.model !== INCOMING);
    const before1 = displayScore(pickConsensusScore(without1).transformation);
    const before2 = displayScore(pickConsensusScore(without2).transformation);
    const before3 = displayScore(pickConsensusScore(without3).transformation);
    const after1 = displayScore(pickFlagshipMeanScore(occ1).transformation);
    const after2 = displayScore(pickFlagshipMeanScore(occ2).transformation);
    const after3 = displayScore(pickFlagshipMeanScore(occ3).transformation);

    assert.equal(before1, 6.0);
    assert.equal(after1, 9.0);
    assert.equal(before2, 5.0);
    assert.equal(after2, displayScore(fmean([6.5, 5, 6])));
    assert.equal(before3, 4.0);
    assert.equal(after3, displayScore(fmean([8, 4, 4])));

    const summary = computeFlagshipSwitchDrift(historyByOcc, INCOMING, titles, '2026-09-09');
    assert.equal(summary.occupationCount, 3);
    assert.equal(summary.incomingModel, INCOMING);
    assert.equal(summary.incomingDate, '2026-09-01');

    const row1 = summary.movers.find((row) => row.id === 10)!;
    const row2 = summary.movers.find((row) => row.id === 20)!;
    const row3 = summary.movers.find((row) => row.id === 30)!;
    assert.equal(row1.before, before1);
    assert.equal(row1.after, after1);
    assert.equal(row2.before, before2);
    assert.equal(row2.after, after2);
    assert.equal(row3.before, before3);
    assert.equal(row3.after, after3);

    assert.equal(row1.beforeBand, 'mid');
    assert.equal(row1.afterBand, 'high');
    assert.equal(row2.beforeBand, 'mid');
    assert.equal(row2.afterBand, 'mid');
    assert.equal(row3.beforeBand, 'mid');
    assert.equal(row3.afterBand, 'mid');
    assert.equal(summary.bandChanges, 1);

    const ge05 = [row1, row2, row3].filter((row) => Math.abs(row.delta) >= 0.5).length;
    const ge10 = [row1, row2, row3].filter((row) => Math.abs(row.delta) >= 1.0).length;
    assert.equal(summary.absDeltaGe05, ge05);
    assert.equal(summary.absDeltaGe10, ge10);
    assert.ok(ge05 >= 1);
    assert.ok(ge10 >= 1);

    assert.equal(row1.showsLatestLine, false);
    assert.equal(row3.showsLatestLine, true);
    assert.equal(summary.latestLineCount, 1);

    const markdown = renderFlagshipSwitchMarkdown(summary);
    assert.match(markdown, /旗艦平均への切替 drift（mms-8.28）/);
    assert.match(markdown, /claude-fable-5-1@2026-09-01/);
    assert.match(markdown, /職業10/);
  });
  test('reports every skipped occupation without changing successful statistics', () => {
    const valid = history(2, 4, 6, 8, 10, 9);
    const missingProvider = [{ ...vote('gpt-5.6-sol', '2026-06-01', 8), provider: '' }];
    assert.throws(() => pickFlagshipMeanScore(missingProvider), /has no provider/);
    const baseline = computeFlagshipSwitchDrift(new Map([[10, valid]]), INCOMING, new Map(), '2026-09-09');
    const summary = computeFlagshipSwitchDrift(new Map<number, ScoreHistEntry[]>([
      [50, missingProvider], // Score selection throws.
      [30, []], // No comparable scores.
      [10, valid],
      [40, [{ ...vote('gpt-5.6-sol', '2026-06-01', 8), backfill: true }]],
      [20, [vote(INCOMING, '2026-09-01', 9)]], // No scores before the incoming model.
      [60, [{ ...vote('gpt-5.6-sol', '2026-06-01', 8), aiois: undefined }]],
    ]), INCOMING, new Map(), '2026-09-09');

    assert.equal(summary.occupationCount, 1);
    assert.deepEqual(summary.skippedOccupationIds, [20, 30, 40, 50, 60]);
    assert.deepEqual({ ...summary, skippedOccupationIds: [] }, baseline);
    const diagnostic = 'Skipped occupations: 5; IDs: 20, 30, 40, 50, 60.';
    assert.ok(renderFlagshipSwitchMarkdown(summary).endsWith(`\n${diagnostic}\n`));
    assert.ok(formatSwitchDriftSummaryLine(summary).endsWith(diagnostic));
    assert.equal(
      renderFlagshipSwitchMarkdown(summary).split('\nSkipped occupations:')[0],
      renderFlagshipSwitchMarkdown(baseline).split('\nSkipped occupations:')[0],
    );
    assert.equal(
      formatSwitchDriftSummaryLine(summary).split(' Skipped occupations:')[0],
      formatSwitchDriftSummaryLine(baseline).split(' Skipped occupations:')[0],
    );
    assert.deepEqual(baseline.skippedOccupationIds, []);
    assert.ok(renderFlagshipSwitchMarkdown(baseline).endsWith('\nSkipped occupations: 0; IDs: none.\n'));
    assert.ok(formatSwitchDriftSummaryLine(baseline).endsWith('Skipped occupations: 0; IDs: none.'));
  });

  test('reports skipped IDs when no occupation can be compared', () => {
    const summary = computeFlagshipSwitchDrift(new Map<number, ScoreHistEntry[]>([
      [20, []],
      [10, [vote(INCOMING, '2026-09-01', 9)]],
    ]), INCOMING, new Map(), '2026-09-09');
    assert.equal(summary.occupationCount, 0);
    assert.deepEqual(summary.skippedOccupationIds, [10, 20]);
    const diagnostic = 'Skipped occupations: 2; IDs: 10, 20.';
    assert.ok(renderFlagshipSwitchMarkdown(summary).endsWith(`\n${diagnostic}\n`));
    assert.ok(formatSwitchDriftSummaryLine(summary).endsWith(diagnostic));
  });

});
