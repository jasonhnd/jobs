import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { displayScore } from '../src/data/lib/banker-round.js';
import { fmean } from '../src/data/lib/fsum.js';
import { pickFlagshipMeanScore, type ScoreHistEntry } from '../src/graph/score-strategy.js';
import type { Aiois10 } from '../src/graph/types.js';
import {
  computeVendorUpdateDrift,
  formatVendorSwappedLine,
  renderVendorUpdateMarkdown,
  resolveVendorSwap,
} from './vendor-update-drift.ts';

function aioisAt(value: number): Aiois10 {
  return {
    d1: value, d2: value, d3: value, d4: value, d5: value,
    d6: value, d7: value, d8: value, d9: value, d10: value,
    transformation: value,
    displacement: value,
  };
}

function vote(model: string, provider: string, date: string, transformation: number): ScoreHistEntry {
  return {
    model,
    provider,
    date,
    ai_risk: transformation,
    rationale_ja: `${model}@${date}`,
    aiois: aioisAt(transformation),
  };
}

const INCOMING = 'claude-fable-5-1';

/** Three vendor flagships + a newer Anthropic run that replaces Opus 5. */
function panel(opus5: number, sol: number, grok: number, incoming: number): ScoreHistEntry[] {
  return [
    vote('claude-opus-5', 'anthropic', '2026-07-26', opus5),
    vote('gpt-5.6-sol', 'openai', '2026-07-12', sol),
    vote('grok-4.6', 'xai', '2026-09-07', grok),
    vote(INCOMING, 'anthropic', '2026-09-09', incoming),
  ];
}

describe('vendor-update drift', () => {
  test('synthetic three-vendor history: before uses the older Anthropic run, after the newer', () => {
    const occ1 = panel(5, 6, 4, 8);
    const occ2 = panel(4, 4, 4, 4);
    const occ3 = panel(7, 7, 7, 4);
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
    const after1 = displayScore(pickFlagshipMeanScore(occ1).transformation);
    const before1 = displayScore(pickFlagshipMeanScore(without1).transformation);
    assert.equal(before1, displayScore(fmean([5, 6, 4])));
    assert.equal(after1, displayScore(fmean([8, 6, 4])));

    const swap = resolveVendorSwap(historyByOcc, INCOMING);
    assert.equal(swap.provider, 'anthropic');
    assert.equal(swap.oldModel, 'claude-opus-5');
    assert.equal(swap.oldDate, '2026-07-26');
    assert.equal(swap.incomingDate, '2026-09-09');
    assert.match(
      formatVendorSwappedLine(swap),
      /vendor swapped: Anthropic claude-opus-5@2026-07-26 → claude-fable-5-1@2026-09-09/,
    );

    const summary = computeVendorUpdateDrift(historyByOcc, INCOMING, titles, '2026-09-09');
    assert.equal(summary.occupationCount, 3);
    assert.equal(summary.incomingModel, INCOMING);
    assert.equal(summary.incomingDate, '2026-09-09');

    const row1 = summary.movers.find((row) => row.id === 10)!;
    const row2 = summary.movers.find((row) => row.id === 20)!;
    const row3 = summary.movers.find((row) => row.id === 30)!;
    assert.equal(row1.before, before1);
    assert.equal(row1.after, after1);
    assert.equal(row2.before, displayScore(fmean([4, 4, 4])));
    assert.equal(row2.after, displayScore(fmean([4, 4, 4])));
    assert.equal(row3.before, displayScore(fmean([7, 7, 7])));
    assert.equal(row3.after, displayScore(fmean([4, 7, 7])));

    assert.equal(row1.beforeBand, 'mid');
    assert.equal(row1.afterBand, 'mid');
    assert.equal(row3.beforeBand, 'high');
    assert.equal(row3.afterBand, 'mid');
    assert.equal(summary.bandChanges, 1);

    const ge05 = [row1, row2, row3].filter((row) => Math.abs(row.delta) >= 0.5).length;
    const ge10 = [row1, row2, row3].filter((row) => Math.abs(row.delta) >= 1.0).length;
    assert.equal(summary.absDeltaGe05, ge05);
    assert.equal(summary.absDeltaGe10, ge10);
    assert.ok(ge05 >= 1);
    assert.ok(ge10 >= 1);

    const markdown = renderVendorUpdateMarkdown(summary);
    assert.match(markdown, /旗艦入れ替え drift（mms-8.34）/);
    assert.match(markdown, /claude-fable-5-1@2026-09-09/);
    assert.match(markdown, /vendor swapped: Anthropic claude-opus-5@2026-07-26 → claude-fable-5-1@2026-09-09/);
    assert.match(markdown, /着地前（旗艦平均）/);
    assert.match(markdown, /職業10/);
  });

  test('incoming model absent throws', () => {
    const historyByOcc = new Map<number, ScoreHistEntry[]>([
      [1, [
        vote('claude-opus-5', 'anthropic', '2026-07-26', 5),
        vote('gpt-5.6-sol', 'openai', '2026-07-12', 6),
        vote('grok-4.6', 'xai', '2026-09-07', 4),
      ]],
    ]);
    assert.throws(
      () => resolveVendorSwap(historyByOcc, 'gpt-6-astra'),
      /no comparable batch for model gpt-6-astra/,
    );
    assert.throws(
      () => computeVendorUpdateDrift(historyByOcc, 'gpt-6-astra', new Map([[1, 'x']])),
      /no comparable batch for model gpt-6-astra/,
    );
  });

  test('non-whitelisted vendor throws', () => {
    const historyByOcc = new Map<number, ScoreHistEntry[]>([
      [1, [vote('gemini-x', 'google', '2026-09-01', 5)]],
    ]);
    assert.throws(
      () => resolveVendorSwap(historyByOcc, 'gemini-x'),
      /vendor google is not whitelisted/,
    );
  });
});
