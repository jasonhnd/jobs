import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pickLatestScore } from './score-strategy.js';

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
