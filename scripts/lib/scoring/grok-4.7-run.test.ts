/**
 * grok-4.7-run.test.ts — pin the Grok 4.7 path: grok-cli transport,
 * xai vendor inference, frozen prompt body identical to Grok 4.6 below
 * the identity header, and the historical Grok batches left on in-agent.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { formatModelDisplay, modelSlug } from '../../../src/site/score-attribution.js';
import { PROVIDERS } from './providers/index.js';
import { GROK_4_5_BACKFILL, GROK_4_5_SCORING_PROVIDER } from './grok-4-5-run.js';
import { GROK_PROMPT_FILE, GROK_SCORING_PROVIDER } from './grok-run.js';
import {
  GROK_4_7_BACKFILL,
  GROK_4_7_MIN_CLI_VERSION,
  GROK_4_7_MODEL_PROVIDER,
  GROK_4_7_MODEL_SLUG,
  GROK_4_7_PREDECESSOR_SLUG,
  GROK_4_7_PROMPT_FILE,
  GROK_4_7_PROMPT_VERSION,
  GROK_4_7_REASONING_EFFORT,
  GROK_4_7_RUBRIC_SOURCE,
  GROK_4_7_SCORING_PROVIDER,
} from './grok-4.7-run.js';

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

describe('Grok 4.7 path on grok-cli', () => {
  test('locks grok-cli transport and maps the slug to xai', () => {
    assert.equal(GROK_4_7_SCORING_PROVIDER, 'grok-cli');
    assert.equal(GROK_4_7_MODEL_SLUG, 'grok-4.7-build-fast');
    assert.equal(GROK_4_7_MODEL_PROVIDER, 'xai');
    assert.equal(GROK_4_7_REASONING_EFFORT, 'xhigh');
    assert.equal(GROK_4_7_MIN_CLI_VERSION, '1.0.40');
    assert.equal(GROK_4_7_PREDECESSOR_SLUG, 'grok-4.6');
    assert.equal(GROK_4_7_BACKFILL, false);
    assert.equal(inferProvider('grok-4.7-build-fast'), 'xai');
    assert.equal(formatModelDisplay('grok-4.7-build-fast'), 'Grok 4.7 Build Fast');
    assert.equal(modelSlug('grok-4.7-build-fast'), 'grok-4.7-build-fast');
    assert.equal(GROK_4_7_SCORING_PROVIDER in PROVIDERS, true);
  });

  test('does not rewrite the historical Grok batches onto grok-cli', () => {
    assert.equal(GROK_SCORING_PROVIDER, 'in-agent');
    assert.equal(GROK_4_5_SCORING_PROVIDER, 'in-agent');
    assert.equal(GROK_4_5_BACKFILL, true);
  });

  test('frozen prompt body matches Grok 4.6 except the identity header', () => {
    const promptPath = join(ROOT, GROK_4_7_PROMPT_FILE);
    const grokPath = join(ROOT, GROK_PROMPT_FILE);
    assert.equal(existsSync(promptPath), true);
    assert.equal(GROK_4_7_RUBRIC_SOURCE, '2026-09-06_grok-4.6-aiois10.ja.md');
    const prompt = readFileSync(promptPath, 'utf8');
    const grok = readFileSync(grokPath, 'utf8');
    assert.match(prompt, new RegExp(GROK_4_7_PROMPT_VERSION.replace(/\./g, '\\.')));
    assert.match(prompt, /--provider grok-cli/);
    assert.match(prompt, /--model grok-4\.7/);
    assert.match(prompt, /--reasoning-effort xhigh/);
    assert.match(prompt, /grok-4\.6/);
    assert.match(prompt, /silent fallback/);
    assert.doesNotMatch(prompt, /Vercel AI Gateway|ai-gateway|providers\/xai\.ts/i);
    assert.equal(rubricBody(prompt), rubricBody(grok));
  });

  test('the predecessor Grok 4.6 batch file is still on disk', () => {
    assert.equal(
      existsSync(join(ROOT, 'data/scores/occupations_grok-4.6_2026-09-07.json')),
      true,
    );
  });
});
