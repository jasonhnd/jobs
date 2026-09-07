/**
 * grok-run.test.ts — pin the Grok 4.6 path: in-agent transport, xai
 * 提供元 inference, frozen prompt body identical to Opus 5 except the
 * identity header, and neither a Gateway provider nor a bespoke xAI
 * provider file.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { PROVIDERS } from './providers/index.js';
import {
  GROK_MODEL_PROVIDER,
  GROK_MODEL_SLUG,
  GROK_PROMPT_FILE,
  GROK_PROMPT_VERSION,
  GROK_RUBRIC_SOURCE,
  GROK_SCORING_PROVIDER,
} from './grok-run.js';

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

describe('Grok 4.6 path on in-agent', () => {
  test('locks in-agent transport and maps the slug to xai', () => {
    assert.equal(GROK_SCORING_PROVIDER, 'in-agent');
    assert.equal(GROK_MODEL_SLUG, 'grok-4.6');
    assert.equal(GROK_MODEL_PROVIDER, 'xai');
    assert.equal(inferProvider(GROK_MODEL_SLUG), 'xai');
    assert.equal(GROK_SCORING_PROVIDER in PROVIDERS, true);
  });

  test('does not register a Gateway or bespoke xai provider', () => {
    assert.equal('ai-gateway' in PROVIDERS, false);
    assert.equal('xai' in PROVIDERS, false);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/ai-gateway.ts')), false);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/xai.ts')), false);
  });

  test('frozen prompt body matches the Opus 5 rubric except the identity header', () => {
    const grokPath = join(ROOT, GROK_PROMPT_FILE);
    const opusPath = join(ROOT, 'data/prompts', GROK_RUBRIC_SOURCE);
    const grok = readFileSync(grokPath, 'utf8');
    const opus = readFileSync(opusPath, 'utf8');
    assert.match(grok, new RegExp(GROK_PROMPT_VERSION.replace(/\./g, '\\.')));
    assert.match(grok, /in-agent/);
    assert.match(grok, /grok-4\.6/);
    assert.doesNotMatch(grok, /Vercel AI Gateway|spacexai|ai-gateway/i);
    assert.equal(rubricBody(grok), rubricBody(opus));
  });
});
