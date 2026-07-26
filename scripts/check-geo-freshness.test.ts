// Tests for the pure helpers in scripts/check-geo-freshness.ts — `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { firstStaleToken, staleModelTokens } from './check-geo-freshness.js';
import type { ScoreRun } from '../src/data/schema/index.js';

/** Minimal ScoreRun shape for the token derivation (it reads scorer + run only). */
const run = (model: string, runDate: string): ScoreRun =>
  ({ scorer: { model }, run: { run_date: runDate } }) as unknown as ScoreRun;

const RUNS = [
  run('claude-opus-4-7', '2026-04-25'),
  run('claude-opus-4-8', '2026-05-30'),
  run('claude-fable-5', '2026-06-13'),
  run('gpt-5.6-sol', '2026-07-12'),
  run('claude-opus-5', '2026-07-26'),
];
const ACTIVE = RUNS[4]!;

describe('staleModelTokens', () => {
  test('covers every superseded model id and run date', () => {
    const stale = staleModelTokens(RUNS, ACTIVE);
    for (const token of [
      'claude-opus-4-7', '2026-04-25',
      'claude-opus-4-8', '2026-05-30',
      'claude-fable-5', '2026-06-13',
      'gpt-5.6-sol', '2026-07-12',
    ]) {
      assert.ok(stale.identifiers.includes(token), `missing identifier ${token}`);
    }
  });

  test('never lists the active run', () => {
    const stale = staleModelTokens(RUNS, ACTIVE);
    assert.equal(stale.identifiers.includes('claude-opus-5'), false);
    assert.equal(stale.identifiers.includes('2026-07-26'), false);
    assert.equal(stale.displayNames.includes('Claude Opus 5'), false);
    assert.equal(stale.displayNames.includes('Opus 5'), false);
  });

  test('lists both the full and vendor-stripped display forms', () => {
    const stale = staleModelTokens(RUNS, ACTIVE);
    assert.ok(stale.displayNames.includes('Claude Opus 4.8'));
    assert.ok(stale.displayNames.includes('Opus 4.8'), 'the /models short form is a distinct leak shape');
    assert.ok(stale.displayNames.includes('GPT 5.6 SOL'));
  });

  // The regression this whole change exists for: the previous hand-maintained
  // list named only claude-opus-4-8, so it could never catch a leak of the
  // model that had just been superseded.
  test('catches the immediately-previous model, which the hand-written list never did', () => {
    const stale = staleModelTokens(RUNS, ACTIVE);
    assert.ok(stale.identifiers.includes('gpt-5.6-sol'));
    assert.ok(stale.displayNames.includes('GPT 5.6 SOL'));
  });

  test('a single-batch repo yields no stale tokens', () => {
    const only = [run('claude-opus-5', '2026-07-26')];
    const stale = staleModelTokens(only, only[0]!);
    assert.deepEqual(stale.identifiers, []);
    assert.deepEqual(stale.displayNames, []);
  });
});

describe('firstStaleToken', () => {
  const stale = staleModelTokens(RUNS, ACTIVE);

  test('accepts text that only names the active model', () => {
    assert.equal(firstStaleToken('Active score run: Claude Opus 5, 2026-07-26', stale), null);
  });

  test('flags a superseded model id', () => {
    assert.equal(firstStaleToken('version: gpt-5.6-sol', stale), 'gpt-5.6-sol');
  });

  test('flags a superseded run date', () => {
    assert.equal(firstStaleToken('generated 2026-07-12', stale), '2026-07-12');
  });

  test('flags unresolved build placeholders', () => {
    assert.equal(firstStaleToken('count: __SCORE_TOTAL__', stale), '__SCORE_');
    assert.equal(firstStaleToken('x __GEO_MEAN__ y', stale), '__GEO_');
  });

  // allowValidationModelNames exists so llms.txt can carry the historical
  // cross-model validation note. It must relax display names ONLY — an id or a
  // run date still means the generated attribution itself went stale.
  test('allowValidationModelNames permits a display name but never an id or date', () => {
    const opts = { allowValidationModelNames: true };
    assert.equal(firstStaleToken('cross-checked against Claude Opus 4.8', stale, opts), null);
    assert.equal(firstStaleToken('model: claude-opus-4-8', stale, opts), 'claude-opus-4-8');
    assert.equal(firstStaleToken('run date 2026-05-30', stale, opts), '2026-05-30');
  });

  test('without the exemption, a display name is flagged', () => {
    assert.equal(firstStaleToken('cross-checked against Claude Opus 4.8', stale), 'Claude Opus 4.8');
  });
});
