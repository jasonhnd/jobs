import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  pickLatestScore,
  pickConsensusScore,
  pickFlagshipMeanScore,
  toFlagshipCanonicalScoreEntry,
  flagshipPanelMeta,
  subtractMonths,
  toCanonicalScoreEntry,
  scorePanelMeta,
  CONSENSUS_WINDOW_MONTHS,
  CONSENSUS_FLOOR_VOTES,
  VENDOR_STALE_MONTHS,
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

function providerOf(model: string): string {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt')) return 'openai';
  if (model.startsWith('grok')) return 'xai';
  return 'test';
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
    provider: providerOf(model),
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
      model: 'old', provider: 'test', date: '2026-01-01', ai_risk: 5, rationale_ja: 'x', aiois: null,
    };
    assert.throws(() => pickConsensusScore([legacy]), /no comparable/);
  });

  test('ignores legacy entries mixed with comparable votes', () => {
    const legacy: ScoreHistEntry = {
      model: 'legacy', provider: 'test', date: '2026-07-26', ai_risk: 9, rationale_ja: 'nope', aiois: null,
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

describe('toCanonicalScoreEntry / scorePanelMeta', () => {
  test('flattens consensus into ScoreHistEntry for projection drop-in', () => {
    const got = pickConsensusScore([
      vote('latest', '2026-07-26', 6.8),
      vote('a', '2026-06-01', 4.2),
      vote('b', '2026-05-01', 4.3),
      vote('c', '2026-04-01', 3.4),
    ]);
    const entry = toCanonicalScoreEntry(got);
    assert.equal(entry.ai_risk, got.transformation);
    assert.equal(entry.date, got.latest.date);
    assert.equal(entry.model, got.rationaleEntry.model);
    assert.equal(entry.rationale_ja, got.rationaleEntry.rationale_ja);
    assert.equal(entry.aiois?.transformation, got.transformation);
    assert.equal(entry.aiois?.displacement, got.displacement);
    assert.equal(entry.aiois?.d1, got.dims.d1);
  });

  test('scorePanelMeta reports panel size, latest date, and window constants', () => {
    const got = pickConsensusScore([
      vote('latest', '2026-07-26', 6),
      vote('a', '2026-06-01', 4),
      vote('b', '2026-05-01', 5),
      vote('c', '2026-04-01', 3),
    ]);
    assert.deepEqual(scorePanelMeta(got), {
      voteCount: 4,
      latestRunDate: '2026-07-26',
      windowMonths: CONSENSUS_WINDOW_MONTHS,
      floorVotes: CONSENSUS_FLOOR_VOTES,
      usedExpiredVotes: false,
    });
  });
});

describe('pickFlagshipMeanScore', () => {
  test('throws on empty history', () => {
    assert.throws(() => pickFlagshipMeanScore([]), /empty history/);
  });

  test('throws when every entry is legacy (no comparable aiois)', () => {
    const legacy: ScoreHistEntry = {
      model: 'old', provider: 'test', date: '2026-01-01', ai_risk: 5, rationale_ja: 'x', aiois: null,
    };
    assert.throws(() => pickFlagshipMeanScore([legacy]), /no comparable/);
  });

  test('throws when a comparable entry has no provider', () => {
    const e = { ...vote('claude-opus-5', '2026-07-26', 5), provider: '' };
    assert.throws(() => pickFlagshipMeanScore([e]), /has no provider/);
  });

  test('one entry per vendor: latest anthropic + sol + grok, mean 5.0', () => {
    const got = pickFlagshipMeanScore([
      vote('claude-opus-4-8', '2026-05-30', 5.0),
      vote('claude-fable-5', '2026-06-13', 6.0),
      vote('claude-opus-5', '2026-07-26', 8.0),
      vote('gpt-5.6-sol', '2026-07-12', 4.0),
      vote('grok-4.6', '2026-09-07', 3.0),
    ]);
    assert.deepEqual(got.panel.map((p) => p.model), ['gpt-5.6-sol', 'claude-opus-5', 'grok-4.6']);
    assert.ok(Math.abs(got.transformation - 5) < 1e-12);
  });

  test('same-date tie within a vendor keeps the later-in-input entry', () => {
    const first = vote('claude-opus-5', '2026-07-26', 8);
    const later = vote('claude-fable-5', '2026-07-26', 6);
    const got = pickFlagshipMeanScore([
      first,
      vote('gpt-5.6-sol', '2026-07-12', 4),
      vote('grok-4.6', '2026-09-07', 3),
      later,
    ]);
    assert.equal(got.panel.find((p) => p.provider === 'anthropic')?.model, 'claude-fable-5');
  });

  test('arithmetic mean is unrounded', () => {
    const got = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 1.0),
      vote('gpt-5.6-sol', '2026-07-12', 2.0),
      vote('grok-4.6', '2026-09-07', 2.0),
    ]);
    assert.ok(Math.abs(got.transformation - 5 / 3) < 1e-12);
  });

  test('dims and displacement are independent per-field means', () => {
    const got = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 5, { d1: 1, displacement: 9 }),
      vote('gpt-5.6-sol', '2026-07-12', 5, { d1: 2, displacement: 6 }),
      vote('grok-4.6', '2026-09-07', 5, { d1: 3, displacement: 3 }),
    ]);
    assert.ok(Math.abs(got.dims.d1 - 2) < 1e-12);
    assert.ok(Math.abs(got.displacement - 6) < 1e-12);
    assert.ok(Math.abs(got.transformation - 5) < 1e-12);
  });

  test('stale boundary: cutoff day is not stale; the day before is', () => {
    const notStale = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-03-07', 5),
      vote('gpt-5.6-sol', '2026-07-12', 5),
      vote('grok-4.6', '2026-09-07', 5),
    ]);
    assert.deepEqual([...notStale.staleVendors], []);

    const stale = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-03-06', 5),
      vote('gpt-5.6-sol', '2026-07-12', 5),
      vote('grok-4.6', '2026-09-07', 5),
    ]);
    assert.deepEqual([...stale.staleVendors], ['anthropic']);
  });

  test('rationale: ±0.3 newest date wins; else nearest; tie newer then model asc', () => {
    const within = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 5.2),
      vote('gpt-5.6-sol', '2026-07-12', 4.9),
      vote('grok-4.6', '2026-09-07', 5.1),
    ]);
    assert.equal(within.rationaleEntry.model, 'grok-4.6');

    const nearest = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 8),
      vote('gpt-5.6-sol', '2026-07-12', 1),
      vote('grok-4.6', '2026-09-07', 2),
    ]);
    // mean = 11/3 ≈ 3.666; distances: opus 4.333, sol 2.666, grok 1.666 → grok
    assert.equal(nearest.rationaleEntry.model, 'grok-4.6');

    const tie = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 1),
      vote('gpt-5.6-sol', '2026-07-26', 9),
      vote('grok-4.6', '2026-07-26', 1),
    ]);
    // mean = 11/3; opus and grok both 2.667 away; same date; model asc → claude-opus-5
    assert.equal(tie.rationaleEntry.model, 'claude-opus-5');
  });

  test('latest is the newest comparable entry and latestDelta is signed', () => {
    const high = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 5),
      vote('gpt-5.6-sol', '2026-07-12', 5),
      vote('grok-4.6', '2026-09-07', 8),
    ]);
    assert.equal(high.latest.model, 'grok-4.6');
    assert.ok(Math.abs(high.latestDelta - (8 - high.transformation)) < 1e-12);
    assert.ok(high.latestDelta > 0);

    const low = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 8),
      vote('gpt-5.6-sol', '2026-07-12', 8),
      vote('grok-4.6', '2026-09-07', 2),
    ]);
    assert.equal(low.latest.model, 'grok-4.6');
    assert.ok(low.latestDelta < 0);
  });

  test('panel is sorted by date ascending then model', () => {
    const got = pickFlagshipMeanScore([
      vote('grok-4.6', '2026-09-07', 5),
      vote('claude-opus-5', '2026-07-26', 5),
      vote('gpt-5.6-sol', '2026-07-12', 5),
    ]);
    assert.deepEqual(got.panel.map((p) => p.date), ['2026-07-12', '2026-07-26', '2026-09-07']);
    assert.deepEqual(got.panel.map((p) => p.model), ['gpt-5.6-sol', 'claude-opus-5', 'grok-4.6']);
  });

  test('toFlagshipCanonicalScoreEntry carries rationale provider, latest date, mean values', () => {
    const got = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 8),
      vote('gpt-5.6-sol', '2026-07-12', 4),
      vote('grok-4.6', '2026-09-07', 3),
    ]);
    const entry = toFlagshipCanonicalScoreEntry(got);
    assert.equal(entry.provider, got.rationaleEntry.provider);
    assert.equal(entry.model, got.rationaleEntry.model);
    assert.equal(entry.date, got.latest.date);
    assert.equal(entry.ai_risk, got.transformation);
    assert.equal(entry.aiois?.transformation, got.transformation);
    assert.equal(entry.aiois?.displacement, got.displacement);
    assert.equal(entry.aiois?.d1, got.dims.d1);
  });

  test('flagshipPanelMeta reports vendorCount, latest date, stale constants, vendors by provider', () => {
    const got = pickFlagshipMeanScore([
      vote('claude-opus-5', '2026-07-26', 5),
      vote('gpt-5.6-sol', '2026-07-12', 5),
      vote('grok-4.6', '2026-09-07', 5),
    ]);
    const meta = flagshipPanelMeta(got);
    assert.equal(meta.vendorCount, 3);
    assert.equal(meta.latestRunDate, '2026-09-07');
    assert.equal(meta.staleMonths, VENDOR_STALE_MONTHS);
    assert.equal(meta.staleMonths, 6);
    assert.equal(meta.staleVendorCount, 0);
    assert.deepEqual(meta.vendors.map((v) => v.provider), ['anthropic', 'openai', 'xai']);
  });
});

function entry(args: {
  model: string;
  provider: string;
  date: string;
  t: number;
  backfill?: boolean;
}): ScoreHistEntry {
  const aiois = profile({ transformation: args.t });
  return {
    model: args.model,
    provider: args.provider,
    date: args.date,
    backfill: args.backfill,
    ai_risk: args.t,
    rationale_ja: `${args.model}@${args.date}`,
    aiois,
  };
}

describe('pickLatestScore / pickFlagshipMeanScore skip backfill (mms-9.6)', () => {
  test('pickLatestScore ignores a backfill entry even when it is the newest', () => {
    const a = entry({ model: 'gpt-6-astra', provider: 'openai', date: '2026-09-10', t: 6 });
    const b = entry({ model: 'grok-4.5', provider: 'xai', date: '2026-12-01', t: 9, backfill: true });
    assert.deepEqual(pickLatestScore([a, b]), a);
    assert.deepEqual(pickLatestScore([b, a]), a);
  });

  test('pickLatestScore throws when only backfill entries exist', () => {
    const only = entry({ model: 'grok-4.5', provider: 'xai', date: '2026-12-01', t: 9, backfill: true });
    assert.throws(() => pickLatestScore([only]), /only backfill/);
  });

  test('pickLatestScore same-date tie still prefers AIOIS over legacy among non-backfill entries', () => {
    const legacy = { model: 'opus-4-7', date: '2026-05-30', ai_risk: 5, aiois: null };
    const aiois = { model: 'opus-4-8', date: '2026-05-30', ai_risk: 7, aiois: { d1: 1 } };
    const extra = entry({ model: 'grok-4.5', provider: 'xai', date: '2026-12-01', t: 9, backfill: true });
    assert.deepEqual(pickLatestScore([legacy, aiois, extra]), aiois);
    assert.deepEqual(pickLatestScore([extra, aiois, legacy]), aiois);
  });

  const panelBase = [
    entry({ model: 'claude-fable-5-1', provider: 'anthropic', date: '2026-09-09', t: 5 }),
    entry({ model: 'gpt-6-astra', provider: 'openai', date: '2026-09-10', t: 6 }),
    entry({ model: 'grok-4.6', provider: 'xai', date: '2026-09-07', t: 4 }),
  ];

  test('pickFlagshipMeanScore excludes backfill from panel, latest, anchor and rationale', () => {
    const backfill = entry({ model: 'grok-4.5', provider: 'xai', date: '2026-12-31', t: 9, backfill: true });
    const got = pickFlagshipMeanScore([...panelBase, backfill]);
    assert.deepEqual(got.panel.map((p) => p.model), ['grok-4.6', 'claude-fable-5-1', 'gpt-6-astra']);
    assert.equal(got.transformation, 5);
    assert.equal(got.latest.model, 'gpt-6-astra');
    assert.deepEqual(got.staleVendors, []);
    assert.notEqual(got.rationaleEntry.model, 'grok-4.5');
    assert.equal(got.latestDelta, 1);
  });

  test('backfill entry does not rescue the aging note', () => {
    const backfill = entry({ model: 'grok-4.5', provider: 'xai', date: '2027-06-01', t: 9, backfill: true });
    const got = pickFlagshipMeanScore([...panelBase, backfill]);
    assert.equal(got.latest.date, '2026-09-10');
    assert.deepEqual(got.staleVendors, []);
  });

  test('a vendor with only a backfill run has no flagship', () => {
    const got = pickFlagshipMeanScore([
      entry({ model: 'claude-fable-5-1', provider: 'anthropic', date: '2026-09-09', t: 5 }),
      entry({ model: 'gpt-6-astra', provider: 'openai', date: '2026-09-10', t: 6 }),
      entry({ model: 'grok-4.5', provider: 'xai', date: '2026-12-31', t: 9, backfill: true }),
    ]);
    assert.equal(got.panel.length, 2);
    assert.deepEqual(got.panel.map((p) => p.provider).sort(), ['anthropic', 'openai']);
  });

  test('live data: appending a synthetic xai backfill to every occupation changes nothing', async () => {
    const { buildIndexes } = await import('../data/lib/indexes.js');
    const { indexes, errors } = await buildIndexes();
    assert.equal(errors.length, 0);
    for (const [, hist] of indexes.historyByOcc) {
      const before = pickFlagshipMeanScore(hist);
      const xai = hist.find((e) => e.provider === 'xai' && e.backfill !== true);
      assert.ok(xai, 'every occupation has a non-backfill xAI run');
      const shifted = profile({
        transformation: (xai.aiois?.transformation ?? xai.ai_risk) + 1,
        displacement: (xai.aiois?.displacement ?? xai.ai_risk) + 1,
      });
      const synthetic: ScoreHistEntry = {
        ...xai,
        model: 'grok-4.5',
        date: '2099-12-31',
        backfill: true,
        ai_risk: shifted.transformation,
        aiois: shifted,
      };
      const afterHist = [...hist, synthetic];
      const after = pickFlagshipMeanScore(afterHist);
      assert.deepEqual(after, before);
      assert.deepEqual(pickLatestScore(afterHist), pickLatestScore(hist));
    }
  });
});
