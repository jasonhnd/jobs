/**
 * opus-5-5-run.test.ts — pin the Claude Opus 5.5 path: in-agent transport,
 * anthropic vendor inference, predecessor claude-fable-5-1, no backfill,
 * frozen prompt body identical to Grok 4.6 except the identity header, and
 * no new provider.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { formatModelDisplay, modelSlug } from '../../../src/site/score-attribution.js';
import { PROVIDERS } from './providers/index.js';
import { GROK_PROMPT_FILE } from './grok-run.js';
import {
  OPUS_5_5_BACKFILL,
  OPUS_5_5_MODEL_PROVIDER,
  OPUS_5_5_MODEL_SLUG,
  OPUS_5_5_PREDECESSOR_SLUG,
  OPUS_5_5_PROMPT_FILE,
  OPUS_5_5_PROMPT_VERSION,
  OPUS_5_5_REASONING_EFFORT,
  OPUS_5_5_RUBRIC_SOURCE,
  OPUS_5_5_SCORING_PROVIDER,
} from './opus-5-5-run.js';

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

describe('Claude Opus 5.5 path on in-agent', () => {
  test('locks in-agent transport, maps the slug to anthropic, and supersedes Fable 5.1', () => {
    assert.equal(OPUS_5_5_SCORING_PROVIDER, 'in-agent');
    assert.equal(OPUS_5_5_MODEL_SLUG, 'claude-opus-5-5');
    assert.equal(OPUS_5_5_MODEL_PROVIDER, 'anthropic');
    assert.equal(OPUS_5_5_PROMPT_VERSION, 'AIOIS-10-v1.0-claude-opus-5-5');
    assert.equal(OPUS_5_5_REASONING_EFFORT, 'high');
    assert.equal(OPUS_5_5_PREDECESSOR_SLUG, 'claude-fable-5-1');
    assert.equal(OPUS_5_5_BACKFILL, false);
    assert.equal(inferProvider('claude-opus-5-5'), 'anthropic');
    assert.equal(formatModelDisplay('claude-opus-5-5'), 'Claude Opus 5.5');
    assert.equal(modelSlug('claude-opus-5-5'), 'opus-5-5');
    assert.equal(OPUS_5_5_SCORING_PROVIDER in PROVIDERS, true);
  });

  test('does not register a Gateway, anthropic-api, claude-cli, or bespoke xai provider', () => {
    assert.deepEqual(Object.keys(PROVIDERS).sort(), ['codex', 'grok-cli', 'in-agent']);
    for (const file of ['anthropic-api.ts', 'ai-gateway.ts', 'xai.ts', 'claude-cli.ts']) {
      assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers', file)), false, file);
    }
  });

  test('frozen prompt body matches Grok 4.6 except the identity header', () => {
    const promptPath = join(ROOT, OPUS_5_5_PROMPT_FILE);
    assert.equal(existsSync(promptPath), true);
    assert.equal(OPUS_5_5_RUBRIC_SOURCE, '2026-09-06_grok-4.6-aiois10.ja.md');
    const prompt = readFileSync(promptPath, 'utf8');
    const grok = readFileSync(join(ROOT, GROK_PROMPT_FILE), 'utf8');
    assert.match(prompt, new RegExp(OPUS_5_5_PROMPT_VERSION.replace(/\./g, '\\.')));
    assert.match(prompt, /--attest-model claude-opus-5-5/);
    assert.match(prompt, /silent fallback/);
    assert.doesNotMatch(prompt, /claude-opus-5\.5|Vercel AI Gateway|ai-gateway/i);
    assert.equal(rubricBody(prompt), rubricBody(grok));
  });

  test('the predecessor Fable 5.1 batch file is still on disk', () => {
    assert.equal(
      existsSync(join(ROOT, 'data/scores/occupations_claude-fable-5-1_2026-09-09.json')),
      true,
    );
  });
});
