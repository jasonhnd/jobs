/**
 * gpt-6-astra-run.test.ts — pin the GPT-6 Astra path: Codex CLI transport,
 * openai 提供元 inference, frozen prompt body identical to Grok 4.6 except
 * the identity header, and the Codex default model left on gpt-5.6-sol.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { formatModelDisplay, modelSlug } from '../../../src/site/score-attribution.js';
import { PROVIDERS } from './providers/index.js';
import { CODEX_DEFAULT_MODEL } from './providers/codex.js';
import {
  ASTRA_CODEX_CONFIG_OVERRIDE,
  ASTRA_CODEX_MIN_VERSION,
  ASTRA_MODEL_PROVIDER,
  ASTRA_MODEL_SLUG,
  ASTRA_PREDECESSOR_SLUG,
  ASTRA_PROMPT_FILE,
  ASTRA_PROMPT_VERSION,
  ASTRA_REASONING_EFFORT,
  ASTRA_RUBRIC_SOURCE,
  ASTRA_SCORING_PROVIDER,
} from './gpt-6-astra-run.js';
import { GROK_PROMPT_FILE } from './grok-run.js';

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

describe('GPT-6 Astra path on Codex CLI', () => {
  test('locks Codex transport and maps the slug to openai', () => {
    assert.equal(ASTRA_SCORING_PROVIDER, 'codex');
    assert.equal(ASTRA_MODEL_SLUG, 'gpt-6-astra');
    assert.equal(ASTRA_MODEL_PROVIDER, 'openai');
    assert.equal(ASTRA_REASONING_EFFORT, 'high');
    assert.equal(inferProvider('gpt-6-astra'), 'openai');
    assert.equal(formatModelDisplay('gpt-6-astra'), 'GPT 6 Astra');
    assert.equal(modelSlug('gpt-6-astra'), 'gpt-6-astra');
    assert.equal(ASTRA_SCORING_PROVIDER in PROVIDERS, true);
  });

  test('does not change the Codex default model', () => {
    assert.equal(CODEX_DEFAULT_MODEL, 'gpt-5.6-sol');
    assert.notEqual(ASTRA_MODEL_SLUG, CODEX_DEFAULT_MODEL);
    assert.equal(ASTRA_PREDECESSOR_SLUG, CODEX_DEFAULT_MODEL);
    assert.equal(ASTRA_CODEX_CONFIG_OVERRIDE, 'model_reasoning_effort=high');
    assert.equal(ASTRA_CODEX_MIN_VERSION, '0.153.1');
  });

  test('frozen prompt body matches Grok 4.6 except the identity header', () => {
    const promptPath = join(ROOT, ASTRA_PROMPT_FILE);
    const grokPath = join(ROOT, GROK_PROMPT_FILE);
    assert.equal(existsSync(promptPath), true);
    assert.equal(ASTRA_RUBRIC_SOURCE, '2026-09-06_grok-4.6-aiois10.ja.md');
    const prompt = readFileSync(promptPath, 'utf8');
    const grok = readFileSync(grokPath, 'utf8');
    assert.match(prompt, new RegExp(ASTRA_PROMPT_VERSION.replace(/\./g, '\\.')));
    assert.match(prompt, /--provider codex/);
    assert.match(prompt, /--model gpt-6-astra/);
    assert.match(prompt, /--reasoning-effort high/);
    assert.match(prompt, /gpt-5\.6-sol/);
    assert.match(prompt, /silent fallback/);
    assert.doesNotMatch(prompt, /Vercel AI Gateway|ai-gateway/i);
    assert.equal(rubricBody(prompt), rubricBody(grok));
  });

  test('the predecessor SOL batch file is still on disk', () => {
    assert.equal(
      existsSync(join(ROOT, 'data/scores/occupations_gpt-5.6-sol_2026-07-12.json')),
      true,
    );
  });
});
