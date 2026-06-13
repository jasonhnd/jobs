// Tests for scripts/make-pilot-sample.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { pickPilotSample, riskBand, MUST_INCLUDE_NAMES, type BaselineEntry } from './make-pilot-sample.js';

const mk = (
  id: number,
  aiRisk: number,
  displacement: number,
  title = `職業${id}`,
  aliases: string[] = [],
): BaselineEntry => ({ id, title, aliases, aiRisk, displacement });

const r1 = (n: number): number => Number(n.toFixed(1));

// Synthetic baseline: 20 low (ids 1–20), 25 mid (21–45), 15 high (46–60).
// id 5 carries a 林業 alias; id 30 is titled プログラマー; id 60 has the top
// displacement; id 46 has the sharpest transformation−displacement gap.
const ENTRIES: readonly BaselineEntry[] = [
  ...Array.from({ length: 20 }, (_, i) =>
    mk(i + 1, r1(0.2 + i * 0.18), r1(0.1 + i * 0.05), `職業${i + 1}`, i + 1 === 5 ? ['林業作業者'] : []),
  ),
  ...Array.from({ length: 25 }, (_, i) =>
    mk(i + 21, r1(4.0 + i * 0.11), r1(1.0 + i * 0.1), i + 21 === 30 ? 'プログラマー' : `職業${i + 21}`),
  ),
  ...Array.from({ length: 15 }, (_, i) => mk(i + 46, r1(7.0 + i * 0.2), r1(2.0 + i * 0.3))),
];

describe('riskBand', () => {
  test('canonical boundaries: <4 low, <7 mid, ≥7 high', () => {
    assert.equal(riskBand(3.9), 'low');
    assert.equal(riskBand(4.0), 'mid');
    assert.equal(riskBand(6.9), 'mid');
    assert.equal(riskBand(7.0), 'high');
  });
});

describe('pickPilotSample', () => {
  const SIZE = 40;
  const sel = pickPilotSample(ENTRIES, SIZE);

  test('deterministic — same inputs, same selection', () => {
    assert.deepEqual(pickPilotSample(ENTRIES, SIZE), sel);
  });

  test('ids unique, ascending, within runbook bounds', () => {
    const ids = sel.picks.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
    assert.ok(sel.picks.length >= SIZE, `picked ${sel.picks.length} < ${SIZE}`);
    assert.ok(sel.picks.length <= 50, `picked ${sel.picks.length} > 50`);
  });

  test('band quotas met (high ≥10, mid ≥15, low ≥15 for size 40)', () => {
    const byBand = { low: 0, mid: 0, high: 0 };
    const entryById = new Map(ENTRIES.map((e) => [e.id, e]));
    for (const p of sel.picks) byBand[riskBand(entryById.get(p.id)!.aiRisk)] += 1;
    assert.ok(byBand.high >= 10, `high ${byBand.high}`);
    assert.ok(byBand.mid >= 15, `mid ${byBand.mid}`);
    assert.ok(byBand.low >= 15, `low ${byBand.low}`);
  });

  test('named exemplars matched by title and by alias', () => {
    const pick30 = sel.picks.find((p) => p.id === 30);
    assert.ok(pick30, 'プログラマー (id 30) must be picked');
    assert.ok(pick30!.reasons.includes('named-exemplar:プログラマー'));

    const pick5 = sel.picks.find((p) => p.id === 5);
    assert.ok(pick5, '林業 alias (id 5) must be picked');
    assert.ok(pick5!.reasons.includes('named-exemplar:林業'));
  });

  test('unmatched exemplar names reported (and matched ones absent)', () => {
    assert.ok(sel.unmatchedNames.includes('看護師'));
    assert.ok(!sel.unmatchedNames.includes('林業'));
    assert.ok(!sel.unmatchedNames.includes('プログラマー'));
    assert.equal(sel.unmatchedNames.length, MUST_INCLUDE_NAMES.length - 2);
  });

  test('top-displacement and sharpest-gap specials included', () => {
    const pick60 = sel.picks.find((p) => p.id === 60);
    assert.ok(pick60, 'top displacement (id 60) must be picked');
    assert.ok(pick60!.reasons.includes('top-displacement'));

    const pick46 = sel.picks.find((p) => p.id === 46);
    assert.ok(pick46, 'sharpest gap (id 46) must be picked');
    assert.ok(pick46!.reasons.includes('sharp-transformation-vs-displacement-gap'));
  });

  test('pool smaller than size → returns the whole pool, no crash', () => {
    const small = ENTRIES.slice(0, 10);
    const s = pickPilotSample(small, 40);
    assert.equal(s.picks.length, 10);
  });
});
