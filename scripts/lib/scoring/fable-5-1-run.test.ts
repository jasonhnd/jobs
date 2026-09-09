/**
 * fable-5-1-run.test.ts — pin the Claude Fable 5.1 path: in-agent transport,
 * anthropic 提供元 inference, frozen prompt body identical to Grok 4.6 and
 * Opus 5 except the identity header, and no new HTTP provider.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { formatModelDisplay, modelSlug } from '../../../src/site/score-attribution.js';
import { PROVIDERS } from './providers/index.js';
import {
  FABLE_5_1_MODEL_PROVIDER,
  FABLE_5_1_MODEL_SLUG,
  FABLE_5_1_PREDECESSOR_SLUG,
  FABLE_5_1_PROMPT_FILE,
  FABLE_5_1_PROMPT_VERSION,
  FABLE_5_1_REASONING_EFFORT,
  FABLE_5_1_RUBRIC_SOURCE,
  FABLE_5_1_SCORING_PROVIDER,
} from './fable-5-1-run.js';
import { GROK_PROMPT_FILE, GROK_RUBRIC_SOURCE } from './grok-run.js';

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

describe('Claude Fable 5.1 path on in-agent', () => {
  test('locks in-agent transport and maps the slug to anthropic', () => {
    assert.equal(FABLE_5_1_SCORING_PROVIDER, 'in-agent');
    assert.equal(FABLE_5_1_MODEL_SLUG, 'claude-fable-5-1');
    assert.equal(FABLE_5_1_MODEL_PROVIDER, 'anthropic');
    assert.equal(FABLE_5_1_REASONING_EFFORT, 'high');
    assert.equal(FABLE_5_1_PREDECESSOR_SLUG, 'claude-opus-5');
    assert.equal(inferProvider('claude-fable-5-1'), 'anthropic');
    assert.equal(formatModelDisplay('claude-fable-5-1'), 'Claude Fable 5.1');
    assert.equal(modelSlug('claude-fable-5-1'), 'fable-5-1');
    assert.equal(FABLE_5_1_SCORING_PROVIDER in PROVIDERS, true);
  });

  test('does not register a Gateway, anthropic-api, or bespoke xai provider', () => {
    assert.deepEqual(Object.keys(PROVIDERS).sort(), ['codex', 'in-agent']);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/anthropic-api.ts')), false);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/ai-gateway.ts')), false);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/xai.ts')), false);
  });

  test('frozen prompt body matches Grok 4.6 and Opus 5 except the identity header', () => {
    const promptPath = join(ROOT, FABLE_5_1_PROMPT_FILE);
    const grokPath = join(ROOT, GROK_PROMPT_FILE);
    const opusPath = join(ROOT, 'data/prompts', GROK_RUBRIC_SOURCE);
    assert.equal(existsSync(promptPath), true);
    assert.equal(FABLE_5_1_RUBRIC_SOURCE, '2026-09-06_grok-4.6-aiois10.ja.md');
    const prompt = readFileSync(promptPath, 'utf8');
    const grok = readFileSync(grokPath, 'utf8');
    const opus = readFileSync(opusPath, 'utf8');
    assert.match(prompt, new RegExp(FABLE_5_1_PROMPT_VERSION.replace(/\./g, '\\.')));
    assert.match(prompt, /--attest-model claude-fable-5-1/);
    assert.match(prompt, /silent fallback/);
    assert.doesNotMatch(prompt, /claude-fable-5\.1|Vercel AI Gateway|ai-gateway/i);
    assert.equal(rubricBody(prompt), rubricBody(grok));
    assert.equal(rubricBody(prompt), rubricBody(opus));
  });
});
