/**
 * mms-8-run.test.ts — pin the two mms-8 paths (Issue #404): Fable 5.1 on
 * in-agent, GPT-6 Astra on codex; public 提供元 inference; frozen prompt
 * bodies byte-identical to the Grok 4.6 freeze (itself identical to Opus 5)
 * except the identity header; effort pinned to `high` on both; the Codex
 * default model untouched; and still no Gateway / bespoke HTTP providers.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { formatModelDisplay, modelSlug } from '../../../src/site/score-attribution.js';
import { PROVIDERS } from './providers/index.js';
import { CODEX_DEFAULT_MODEL } from './providers/codex.js';
import { GROK_PROMPT_FILE, GROK_RUBRIC_SOURCE } from './grok-run.js';
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

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('Claude Fable 5.1 path on in-agent (mms-8F)', () => {
  test('locks in-agent transport, anthropic 提供元, and the public display/slug', () => {
    assert.equal(FABLE_5_1_SCORING_PROVIDER, 'in-agent');
    assert.equal(FABLE_5_1_SCORING_PROVIDER in PROVIDERS, true);
    assert.equal(FABLE_5_1_MODEL_SLUG, 'claude-fable-5-1');
    assert.equal(FABLE_5_1_MODEL_PROVIDER, 'anthropic');
    assert.equal(inferProvider(FABLE_5_1_MODEL_SLUG), FABLE_5_1_MODEL_PROVIDER);
    assert.equal(formatModelDisplay(FABLE_5_1_MODEL_SLUG), 'Claude Fable 5.1');
    assert.equal(modelSlug(FABLE_5_1_MODEL_SLUG), 'fable-5-1');
    assert.equal(FABLE_5_1_REASONING_EFFORT, 'high');
  });

  test('is a new vote next to Fable 5, not a replacement', () => {
    assert.equal(FABLE_5_1_PREDECESSOR_SLUG, 'claude-fable-5');
    assert.notEqual(FABLE_5_1_MODEL_SLUG, FABLE_5_1_PREDECESSOR_SLUG);
    assert.notEqual(modelSlug(FABLE_5_1_MODEL_SLUG), modelSlug(FABLE_5_1_PREDECESSOR_SLUG));
    assert.equal(existsSync(join(ROOT, 'data/scores/occupations_claude-fable-5_2026-06-13.json')), true);
  });

  test('frozen prompt body matches the Grok 4.6 freeze except the identity header', () => {
    const prompt = read(FABLE_5_1_PROMPT_FILE);
    assert.equal(FABLE_5_1_RUBRIC_SOURCE, GROK_PROMPT_FILE.replace('data/prompts/', ''));
    const grok = read(join('data/prompts', FABLE_5_1_RUBRIC_SOURCE));
    const opus = read(join('data/prompts', GROK_RUBRIC_SOURCE));
    assert.match(prompt, new RegExp(escapeRe(FABLE_5_1_PROMPT_VERSION)));
    assert.match(prompt, /in-agent/);
    assert.match(prompt, /--attest-model claude-fable-5-1/);
    assert.match(prompt, /claude-fable-5-1/);
    assert.match(prompt, /silent fallback/);
    assert.doesNotMatch(prompt, /claude-fable-5\.1|Vercel AI Gateway|ai-gateway/i);
    assert.equal(rubricBody(prompt), rubricBody(grok));
    assert.equal(rubricBody(prompt), rubricBody(opus));
  });
});

describe('GPT-6 Astra path on codex (mms-8G)', () => {
  test('locks codex transport, openai 提供元, and the public display/slug', () => {
    assert.equal(ASTRA_SCORING_PROVIDER, 'codex');
    assert.equal(ASTRA_SCORING_PROVIDER in PROVIDERS, true);
    assert.equal(ASTRA_MODEL_SLUG, 'gpt-6-astra');
    assert.equal(ASTRA_MODEL_PROVIDER, 'openai');
    assert.equal(inferProvider(ASTRA_MODEL_SLUG), ASTRA_MODEL_PROVIDER);
    assert.equal(formatModelDisplay(ASTRA_MODEL_SLUG), 'GPT 6 Astra');
    assert.equal(modelSlug(ASTRA_MODEL_SLUG), 'gpt-6-astra');
  });

  test('pins effort high explicitly and a Codex CLI floor that accepts -m gpt-6-astra', () => {
    assert.equal(ASTRA_REASONING_EFFORT, 'high');
    assert.equal(ASTRA_CODEX_CONFIG_OVERRIDE, `model_reasoning_effort=${ASTRA_REASONING_EFFORT}`);
    assert.equal(ASTRA_CODEX_MIN_VERSION, '0.153.1');
  });

  test('never becomes the Codex default: gpt-5.6-sol stays and is a distinct vote', () => {
    assert.equal(CODEX_DEFAULT_MODEL, 'gpt-5.6-sol');
    assert.equal(ASTRA_PREDECESSOR_SLUG, CODEX_DEFAULT_MODEL);
    assert.notEqual(ASTRA_MODEL_SLUG, CODEX_DEFAULT_MODEL);
    assert.equal(existsSync(join(ROOT, 'data/scores/occupations_gpt-5.6-sol_2026-07-12.json')), true);
  });

  test('frozen prompt body matches the Grok 4.6 freeze except the identity header', () => {
    const prompt = read(ASTRA_PROMPT_FILE);
    assert.equal(ASTRA_RUBRIC_SOURCE, GROK_PROMPT_FILE.replace('data/prompts/', ''));
    const grok = read(join('data/prompts', ASTRA_RUBRIC_SOURCE));
    assert.match(prompt, new RegExp(escapeRe(ASTRA_PROMPT_VERSION)));
    assert.match(prompt, /--provider codex/);
    assert.match(prompt, /--model gpt-6-astra/);
    assert.match(prompt, /silent fallback/);
    assert.match(prompt, /gpt-5\.6-sol/); // the explicit "do not label the default as Astra" line
    assert.doesNotMatch(prompt, /Vercel AI Gateway|ai-gateway/i);
    assert.equal(rubricBody(prompt), rubricBody(grok));
  });
});

describe('mms-8 adds no transport', () => {
  test('still no Gateway, no Anthropic HTTP, no xAI, no OpenAI HTTP provider files', () => {
    for (const name of ['ai-gateway', 'anthropic-api', 'anthropic', 'openai', 'openai-api', 'xai']) {
      assert.equal(name in PROVIDERS, false, name);
      assert.equal(existsSync(join(ROOT, `scripts/lib/scoring/providers/${name}.ts`)), false, name);
    }
    assert.deepEqual(Object.keys(PROVIDERS).sort(), ['codex', 'in-agent']);
  });
});
