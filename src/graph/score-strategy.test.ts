import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  pickLatestScore,
  pickConsensusScore,
  subtractMonths,
  type ScoreHistEntry,
} from './score-strategy.js';
import type { Aiois10 } from './types.js';

test('pickLatestScore: throws on empty', () => {
  assert.throws(() => pickLatestScore([]), /empty history/);
});

test('pickLatestScore: single entry returns it', () => {
  const entry = { model: 'm1', date: '2026-01-01', ai_risk: 5 };
  assert.deepEqual(pickLatestScore([entry]), entry);
});

test('pickLatestScore: picks latest by date', () => {
  const a = { model: 'a', date: '2026-01-01', ai_risk: 5 };
  const b = { model: 'b', date: '2026-03-15', ai_risk: 7 };
  const c = { model: 'c', date: '2026-02-10', ai_risk: 6 };
  assert.deepEqual(pickLatestScore([a, b, c]), b);
});

test('pickLatestScore: ties broken by last-in-input-order', () => {
  const a = { model: 'a', date: '2026-04-25', ai_risk: 5 };
  const b = { model: 'b', date: '2026-04-25', ai_risk: 7 };
  assert.deepEqual(pickLatestScore([a, b]), b);
});

test('pickLatestScore: order-independent on distinct dates', () => {
  const e1 = { model: 'm1', date: '2026-01-01', ai_risk: 1 };
  const e2 = { model: 'm2', date: '2026-02-01', ai_risk: 2 };
  const e3 = { model: 'm3', date: '2026-03-01', ai_risk: 3 };
  assert.deepEqual(pickLatestScore([e1, e2, e3]), e3);
  assert.deepEqual(pickLatestScore([e3, e1, e2]), e3);
  assert.deepEqual(pickLatestScore([e2, e3, e1]), e3);
});

test('pickLatestScore: same-date tie prefers the AIOIS-10 entry over legacy', () => {
  const legacy = { model: 'opus-4-7', date: '2026-05-30', ai_risk: 5, aiois: null };
  const aiois = { model: 'opus-4-8', date: '2026-05-30', ai_risk: 7, aiois: { d1: 1 } };
  // AIOIS-10 wins regardless of input order — not filename-order dependent.
  assert.deepEqual(pickLatestScore([legacy, aiois]), aiois);
  assert.deepEqual(pickLatestScore([aiois, legacy]), aiois);
});

test('pickLatestScore: a newer date still beats an older AIOIS-10 entry', () => {
  // The aiois tie-break only applies on EQUAL dates; date dominance wins first.
  const oldAiois = { model: 'opus-4-8', date: '2026-04-25', ai_risk: 7, aiois: { d1: 1 } };
  const newLegacy = { model: 'opus-4-9', date: '2026-05-30', ai_risk: 5, aiois: null };
  assert.deepEqual(pickLatestScore([oldAiois, newLegacy]), newLegacy);
});

function profile(over: Partial<Aiois10> & Pick<Aiois10, 'transformation'>): Aiois10 {
  const t = over.transformation;
  const d = over.displacement ?? t;
  return {
    d1: over.d1 ?? t, d2: over.d2 ?? t, d3: over.d3 ?? t, d4: over.d4 ?? t, d5: over.d5 ?? t,
    d6: over.d6 ?? t, d7: over.d7 ?? t, d8: over.d8 ?? t, d9: over.d9 ?? t, d10: over.d10 ?? t,
    transformation: t,
    displacement: d,
  };
}

function vote(
  model: string,
  date: string,
  transformation: number,
  extra: Partial<Aiois10> = {},
): ScoreHistEntry {
  const aiois = profile({ transformation, ...extra });
  return {
    model,
    date,
    ai_risk: transformation,
    rationale_ja: `${model}@${date}`,
    aiois,
  };
}

describe('subtractMonths', () => {
  test('clamps end-of-month (2026-03-31 minus 6 → 2025-09-30)', () => {
    assert.equal(subtractMonths('2026-03-31', 6), '2025-09-30');
  });

  test('clamps February in a non-leap year', () => {
    assert.equal(subtractMonths('2025-08-31', 6), '2025-02-28');
  });

  test('keeps Feb 29 in a leap year', () => {
    assert.equal(subtractMonths('2024-08-31', 6), '2024-02-29');
  });
});

describe('pickConsensusScore', () => {
  test('throws on empty history', () => {
    assert.throws(() => pickConsensusScore([]), /empty history/);
  });

  test('throws when every entry is legacy (no comparable aiois)', () => {
    const legacy: ScoreHistEntry = {
      model: 'old', date: '2026-01-01', ai_risk: 5, rationale_ja: 'x', aiois: null,
    };
    assert.throws(() => pickConsensusScore([legacy]), /no comparable/);
  });

  test('ignores legacy entries mixed with comparable votes', () => {
    const legacy: ScoreHistEntry = {
      model: 'legacy', date: '2026-07-26', ai_risk: 9, rationale_ja: 'nope', aiois: null,
    };
    const a = vote('m1', '2026-07-26', 4);
    const b = vote('m2', '2026-06-01', 6);
    const got = pickConsensusScore([legacy, a, b]);
    assert.equal(got.panel.length, 2);
    assert.equal(got.transformation, 5);
    assert.equal(got.panel.some((p) => p.model === 'legacy'), false);
  });

  test('one vote per model: older re-run of the same model is dropped', () => {
    const old = vote('opus-5', '2026-04-01', 8);
    const neu = vote('opus-5', '2026-07-26', 4);
    const other = vote('gpt', '2026-07-01', 6);
    const got = pickConsensusScore([old, neu, other]);
    assert.equal(got.panel.length, 2);
    assert.deepEqual(got.panel.map((p) => p.model).sort(), ['gpt', 'opus-5']);
    assert.equal(got.panel.find((p) => p.model === 'opus-5')?.transformation, 4);
  });

  test('window drops a vote one day before the 6-month cutoff', () => {
    // Anchor 2026-07-26 → cutoff 2026-01-26. 2026-01-25 falls out; no expired fill
    // because in-window count is already 5.
    const votes = [
      vote('a', '2026-07-26', 5),
      vote('b', '2026-06-01', 5),
      vote('c', '2026-05-01', 5),
      vote('d', '2026-03-01', 5),
      vote('e', '2026-01-26', 5),
      vote('old', '2026-01-25', 9),
    ];
    const got = pickConsensusScore(votes);
    assert.equal(got.panel.length, 5);
    assert.equal(got.panel.some((p) => p.model === 'old'), false);
    assert.equal(got.usedExpiredVotes, false);
    assert.equal(got.transformation, 5);
  });

  test('floor 5 fills the newest expired vote (4 in-window + 2 expired → 5)', () => {
    const votes = [
      vote('a', '2026-07-26', 1),
      vote('b', '2026-06-01', 2),
      vote('c', '2026-05-01', 3),
      vote('d', '2026-04-01', 4),
      vote('exp-new', '2026-01-01', 10),
      vote('exp-old', '2025-12-01', 8),
    ];
    const got = pickConsensusScore(votes);
    assert.equal(got.panel.length, 5);
    assert.equal(got.usedExpiredVotes, true);
    assert.equal(got.panel.some((p) => p.model === 'exp-new'), true);
    assert.equal(got.panel.some((p) => p.model === 'exp-old'), false);
  });

  test('fewer than 5 votes total: use all; usedExpiredVotes only if an expired vote is in', () => {
    const allFresh = pickConsensusScore([
      vote('a', '2026-07-26', 4),
      vote('b', '2026-06-01', 6),
    ]);
    assert.equal(allFresh.panel.length, 2);
    assert.equal(allFresh.usedExpiredVotes, false);

    const withExpired = pickConsensusScore([
      vote('a', '2026-07-26', 4),
      vote('old', '2025-01-01', 6),
    ]);
    assert.equal(withExpired.panel.length, 2);
    assert.equal(withExpired.usedExpiredVotes, true);
  });

  test('even-count median is the mean of the two central values, unrounded', () => {
    const got = pickConsensusScore([
      vote('a', '2026-07-26', 1),
      vote('b', '2026-06-01', 2),
      vote('c', '2026-05-01', 3),
      vote('d', '2026-04-01', 4),
    ]);
    assert.equal(got.transformation, 2.5);
    assert.equal(got.displacement, 2.5);
  });

  test('dims are independent per-dimension medians', () => {
    const got = pickConsensusScore([
      vote('a', '2026-07-26', 5, { d1: 1, d2: 9, displacement: 2 }),
      vote('b', '2026-06-01', 5, { d1: 9, d2: 9, displacement: 8 }),
    ]);
    assert.equal(got.dims.d1, 5);
    assert.equal(got.dims.d2, 9);
    assert.equal(got.transformation, 5);
    assert.equal(got.displacement, 5);
    assert.notEqual(got.transformation, (got.dims.d1 + got.dims.d2) / 2);
  });

  test('rationale: several within ±0.3 → newest date wins', () => {
    const got = pickConsensusScore([
      vote('old-close', '2026-04-01', 5.0),
      vote('new-close', '2026-07-26', 5.1),
      vote('mid', '2026-06-01', 5.2),
      vote('far', '2026-05-01', 8),
    ]);
    // sorted 5.0, 5.1, 5.2, 8 → median (5.1+5.2)/2 = 5.15
    // |5.0-5.15|=0.15, |5.1-5.15|=0.05, |5.2-5.15|=0.05, |8-5.15|=2.85
    // within: old-close, new-close, mid → newest is new-close
    assert.equal(got.rationaleEntry.model, 'new-close');
  });

  test('rationale: none within ±0.3 → nearest; date then model break ties', () => {
    const nearest = pickConsensusScore([
      vote('near', '2026-04-01', 4.0),
      vote('far', '2026-07-26', 8.0),
    ]);
    // median 6.0; |4-6|=2, |8-6|=2 — tie distance, newer date wins
    assert.equal(nearest.rationaleEntry.model, 'far');

    const byModel = pickConsensusScore([
      vote('b-model', '2026-07-26', 4.0),
      vote('a-model', '2026-07-26', 8.0),
    ]);
    // median 6, both dist 2, same date → model ascending → a-model
    assert.equal(byModel.rationaleEntry.model, 'a-model');
  });

  test('latestDelta is signed in both directions', () => {
    const high = pickConsensusScore([
      vote('latest', '2026-07-26', 8),
      vote('a', '2026-06-01', 4),
      vote('b', '2026-05-01', 4),
    ]);
    assert.equal(high.latest.model, 'latest');
    assert.equal(high.latestDelta, 8 - high.transformation);

    const low = pickConsensusScore([
      vote('latest', '2026-07-26', 2),
      vote('a', '2026-06-01', 8),
      vote('b', '2026-05-01', 8),
    ]);
    assert.equal(low.latest.model, 'latest');
    assert.ok(low.latestDelta < 0);
  });

  test('panel is sorted by date ascending', () => {
    const got = pickConsensusScore([
      vote('c', '2026-07-26', 5),
      vote('a', '2026-04-01', 5),
      vote('b', '2026-06-01', 5),
    ]);
    assert.deepEqual(got.panel.map((p) => p.date), ['2026-04-01', '2026-06-01', '2026-07-26']);
  });
});
