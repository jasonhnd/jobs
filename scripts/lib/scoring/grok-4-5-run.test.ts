/**
 * grok-4-5-run.test.ts — pin the Grok 4.5 BACKFILL path: in-agent transport,
 * xai 提供元 inference, frozen prompt body identical to Grok 4.6 except the
 * identity header, `run.backfill: true`, and no new HTTP provider.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { formatModelDisplay, modelSlug } from '../../../src/site/score-attribution.js';
import { PROVIDERS } from './providers/index.js';
import {
  GROK_4_5_BACKFILL,
  GROK_4_5_MODEL_PROVIDER,
  GROK_4_5_MODEL_SLUG,
  GROK_4_5_PROMPT_FILE,
  GROK_4_5_PROMPT_VERSION,
  GROK_4_5_RUBRIC_SOURCE,
  GROK_4_5_SCORING_PROVIDER,
  GROK_4_5_SUCCESSOR_SLUG,
} from './grok-4-5-run.js';
import { GROK_PROMPT_FILE } from './grok-run.js';

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

describe('Grok 4.5 backfill path on in-agent', () => {
  test('locks in-agent transport and maps the slug to xai', () => {
    assert.equal(GROK_4_5_SCORING_PROVIDER, 'in-agent');
    assert.equal(GROK_4_5_MODEL_SLUG, 'grok-4.5');
    assert.equal(GROK_4_5_MODEL_PROVIDER, 'xai');
    assert.equal(GROK_4_5_SCORING_PROVIDER in PROVIDERS, true);
    assert.equal(inferProvider('grok-4.5'), 'xai');
    assert.equal(formatModelDisplay('grok-4.5'), 'Grok 4.5');
    assert.equal(modelSlug('grok-4.5'), 'grok-4.5');
  });

  test('is a backfill sitting behind the Grok 4.6 flagship', () => {
    assert.equal(GROK_4_5_BACKFILL, true);
    assert.equal(GROK_4_5_SUCCESSOR_SLUG, 'grok-4.6');
    assert.equal(
      existsSync(join(ROOT, 'data/scores/occupations_grok-4.6_2026-09-07.json')),
      true,
    );
  });

  test('does not register a Gateway or bespoke xai provider', () => {
    assert.deepEqual(Object.keys(PROVIDERS).sort(), ['codex', 'in-agent']);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/ai-gateway.ts')), false);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/xai.ts')), false);
  });

  test('frozen prompt body matches Grok 4.6 except the identity header', () => {
    const promptPath = join(ROOT, GROK_4_5_PROMPT_FILE);
    const grokPath = join(ROOT, GROK_PROMPT_FILE);
    assert.equal(existsSync(promptPath), true);
    assert.equal(GROK_4_5_RUBRIC_SOURCE, '2026-09-06_grok-4.6-aiois10.ja.md');
    const prompt = readFileSync(promptPath, 'utf8');
    const grok46 = readFileSync(grokPath, 'utf8');
    assert.match(prompt, new RegExp(GROK_4_5_PROMPT_VERSION.replace(/\./g, '\\.')));
    assert.match(prompt, /--attest-model grok-4\.5/);
    assert.match(prompt, /--backfill true/);
    assert.match(prompt, /追跡採点/);
    assert.match(prompt, /silent fallback/);
    assert.doesNotMatch(prompt, /Vercel AI Gateway|spacexai|ai-gateway/i);
    assert.equal(rubricBody(prompt), rubricBody(grok46));
  });
});
