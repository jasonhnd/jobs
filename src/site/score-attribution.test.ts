// Tests for src/site/score-attribution.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  SCORE_ATTRIBUTION,
  formatModelDisplay,
  modelIdFromSlug,
  modelSlug,
  pickAttributionBatch,
  type BatchMetaForAttribution,
} from './score-attribution.js';

const meta = (model: string, runDate: string, hasAiois = true, scope = 'occupations'): BatchMetaForAttribution =>
  ({ scope, model, runDate, hasAiois });
const currentModelIds = [
  'claude-opus-4-7',
  'claude-opus-4-8',
  'claude-fable-5',
  'gpt-5.6-sol',
  'claude-opus-5',
] as const;

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
      ['opus-4-7', 'opus-4-8', 'fable-5', 'gpt-5.6-sol', 'opus-5'],
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
