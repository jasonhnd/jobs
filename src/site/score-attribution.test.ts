// Tests for src/site/score-attribution.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  SCORE_ATTRIBUTION,
  SCORE_PANEL,
  formatModelDisplay,
  modelIdFromSlug,
  modelSlug,
  pickAttributionBatch,
  parseRunSlug,
  runFromSlug,
  runSlug,
  type ScoreRunRef,
  type BatchMetaForAttribution,
} from './score-attribution.js';
import { comparableAioisRuns, listOccupationRuns } from './occupation-runs.js';

const meta = (model: string, runDate: string, hasAiois = true, scope = 'occupations'): BatchMetaForAttribution =>
  ({ scope, model, runDate, hasAiois });
const currentModelIds = listOccupationRuns().map((run) => run.model);

describe('formatModelDisplay', () => {
  test('claude-opus-4-8 → Claude Opus 4.8', () => {
    assert.equal(formatModelDisplay('claude-opus-4-8'), 'Claude Opus 4.8');
  });
  test('claude-fable-5 → Claude Fable 5', () => {
    assert.equal(formatModelDisplay('claude-fable-5'), 'Claude Fable 5');
  });
  test('claude-opus-4-7 → Claude Opus 4.7', () => {
    assert.equal(formatModelDisplay('claude-opus-4-7'), 'Claude Opus 4.7');
  });
  test('gpt-5.6-sol → GPT 5.6 SOL', () => {
    assert.equal(formatModelDisplay('gpt-5.6-sol'), 'GPT 5.6 SOL');
  });
  test('word-only id degrades gracefully', () => {
    assert.equal(formatModelDisplay('claude-fable'), 'Claude Fable');
  });
});

describe('pickAttributionBatch', () => {
  test('latest run_date wins', () => {
    const picked = pickAttributionBatch([
      meta('claude-opus-4-8', '2026-05-30'),
      meta('claude-fable-5', '2026-06-13'),
      meta('claude-opus-4-7', '2026-04-25', false),
    ]);
    assert.equal(picked.model, 'claude-fable-5');
  });

  test('same-date tie prefers the AIOIS-10 batch', () => {
    const picked = pickAttributionBatch([
      meta('aiois-model', '2026-05-30', true),
      meta('legacy-model', '2026-05-30', false),
    ]);
    assert.equal(picked.model, 'aiois-model');
  });

  test('non-occupations scopes are ignored', () => {
    const picked = pickAttributionBatch([
      meta('task-model', '2026-07-01', true, 'tasks'),
      meta('occ-model', '2026-05-30'),
    ]);
    assert.equal(picked.model, 'occ-model');
  });

  test('throws when no occupations batch exists', () => {
    assert.throws(() => pickAttributionBatch([meta('x', '2026-01-01', true, 'tasks')]));
  });
});

describe('modelSlug and modelIdFromSlug', () => {
  test('maps current model ids to public slugs', () => {
    assert.deepEqual(
      currentModelIds.map(modelSlug),
      listOccupationRuns().map((run) => run.slug.replace(/@\d{4}-\d{2}-\d{2}$/, '')),
    );
  });

  test('round-trips all current model ids through the known batch list', () => {
    for (const modelId of currentModelIds) {
      assert.equal(modelIdFromSlug(modelSlug(modelId), currentModelIds), modelId);
    }
  });

  test('unknown, duplicate, and invalid slugs resolve to null', () => {
    assert.equal(modelIdFromSlug('unknown-model', currentModelIds), null);
    assert.equal(modelIdFromSlug('opus-4-8', ['claude-opus-4-8', 'opus-4-8']), null);
    assert.equal(modelIdFromSlug('', currentModelIds), null);
    assert.equal(modelIdFromSlug('bad slug', currentModelIds), null);
    assert.equal(modelIdFromSlug('bad/slug', currentModelIds), null);
  });

  test('modelSlug throws on empty, slash, or whitespace model ids', () => {
    assert.throws(() => modelSlug(''), /invalid model id/);
    assert.throws(() => modelSlug('claude/opus-4-8'), /invalid model id/);
    assert.throws(() => modelSlug('claude opus-4-8'), /invalid model id/);
    assert.throws(() => modelSlug('claude-opus-4-8\n'), /invalid model id/);
  });
});

describe('SCORE_ATTRIBUTION (live repo data)', () => {
  test('derives the active batch (latest run_date under data/scores/)', () => {
    // Repo invariant: the active batch is the newest occupations run.
    // After the Issue #9 full run this is claude-fable-5 / 2026-06-13;
    // the assertion is shape-based plus a consistency cross-check so a
    // future newer batch does not break this test.
    assert.match(SCORE_ATTRIBUTION.runDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(SCORE_ATTRIBUTION.runDate >= '2026-06-13');
    assert.equal(SCORE_ATTRIBUTION.modelDisplay, formatModelDisplay(SCORE_ATTRIBUTION.modelId));
    assert.equal(SCORE_ATTRIBUTION.standardLabel, 'AIOIS-10');
    assert.ok(SCORE_ATTRIBUTION.modelDisplay.length > 0);
  });
});

describe('SCORE_PANEL (live repo data)', () => {
  test('matches the current comparable occupation panel', () => {
    const aiois = comparableAioisRuns();
    const latest = aiois[aiois.length - 1];
    assert.ok(latest);
    assert.equal(SCORE_PANEL.voteCount, aiois.length);
    assert.equal(SCORE_PANEL.latestRunDate, latest.runDate);
    assert.equal(SCORE_PANEL.latestRunDate, SCORE_ATTRIBUTION.runDate);
    assert.equal(SCORE_PANEL.windowMonths, 6);
    assert.equal(SCORE_PANEL.floorVotes, 5);
    assert.equal(SCORE_PANEL.usedExpiredVotes, false);
  });
});

// Issue #218: public URLs are keyed by RUN, not by model. A model can be
// scored more than once; `data/scores/` is append-only and the runbook treats
// re-scoring as normal.
describe('runSlug / parseRunSlug / runFromSlug', () => {
  const runs: ScoreRunRef[] = [
    { model: 'claude-opus-4-7', runDate: '2026-04-25' },
    { model: 'claude-opus-5', runDate: '2026-07-26' },
    { model: 'gpt-5.6-sol', runDate: '2026-07-12' },
    // The case that used to crash the build: one model, two runs.
    { model: 'gpt-5.6-sol', runDate: '2026-09-01' },
  ];

  test('builds model@date and strips the provider prefix', () => {
    assert.equal(runSlug({ model: 'claude-opus-5', runDate: '2026-07-26' }), 'opus-5@2026-07-26');
    assert.equal(runSlug({ model: 'gpt-5.6-sol', runDate: '2026-07-12' }), 'gpt-5.6-sol@2026-07-12');
  });

  test('rejects a malformed run date', () => {
    assert.throws(() => runSlug({ model: 'claude-opus-5', runDate: '2026-7-26' }), /invalid run date/);
    assert.throws(() => runSlug({ model: 'claude-opus-5', runDate: '' }), /invalid run date/);
  });

  test('round-trips every run, including two runs of one model', () => {
    for (const run of runs) {
      const resolved = runFromSlug(runSlug(run), runs);
      assert.deepEqual(resolved, run, runSlug(run));
    }
  });

  test('two runs of one model resolve to different pages', () => {
    const july = runFromSlug('gpt-5.6-sol@2026-07-12', runs);
    const september = runFromSlug('gpt-5.6-sol@2026-09-01', runs);
    assert.equal(july?.runDate, '2026-07-12');
    assert.equal(september?.runDate, '2026-09-01');
    assert.notDeepEqual(july, september);
  });

  test('a repeated model id is no longer mistaken for an ambiguous slug', () => {
    // Handed a run-derived list, `modelIdFromSlug` used to see the same id
    // twice and return null — which surfaced as "model slug round-trip failed"
    // and crashed the build. The slug names exactly one model; the repetition
    // was the caller's, not a collision.
    assert.equal(modelIdFromSlug('gpt-5.6-sol', runs.map((r) => r.model)), 'gpt-5.6-sol');

    // A genuine collision — two DISTINCT ids sharing a slug — still returns null.
    assert.equal(modelIdFromSlug('opus-5', ['claude-opus-5', 'opus-5']), null);
  });

  test('parseRunSlug rejects anything that is not model@YYYY-MM-DD', () => {
    assert.equal(parseRunSlug('opus-5'), null);
    assert.equal(parseRunSlug('opus-5@'), null);
    assert.equal(parseRunSlug('@2026-07-26'), null);
    assert.equal(parseRunSlug('opus-5@2026-7-26'), null);
    assert.equal(parseRunSlug('opus-5@2026-07-26-extra'), null);
    assert.deepEqual(parseRunSlug('opus-5@2026-07-26'), { modelSlug: 'opus-5', runDate: '2026-07-26' });
  });

  test('unknown runs and bare model slugs do not resolve', () => {
    assert.equal(runFromSlug('opus-5@2026-01-01', runs), null);
    assert.equal(runFromSlug('opus-5', runs), null);
    assert.equal(runFromSlug('nope@2026-07-26', runs), null);
  });
});
