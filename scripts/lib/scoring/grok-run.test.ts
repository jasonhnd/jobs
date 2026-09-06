/**
 * grok-run.test.ts — pin the mms-7a locked path: Gateway model id, xai
 * inference, frozen prompt body identical to Opus 5 except the identity
 * header, and no bespoke xAI provider file.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferProvider } from '../../assemble-scores.js';
import { isGatewayModelId } from './providers/ai-gateway.js';
import { PROVIDERS } from './providers/index.js';
import {
  GROK_GATEWAY_MODEL,
  GROK_MODEL_PROVIDER,
  GROK_MODEL_SLUG,
  GROK_PROMPT_FILE,
  GROK_PROMPT_VERSION,
  GROK_RUBRIC_SOURCE,
} from './grok-run.js';

const ROOT = join(import.meta.dir, '../../..');

function rubricBody(markdown: string): string {
  const marker = '\n---\n';
  const at = markdown.indexOf(marker);
  assert.ok(at >= 0, 'frozen prompt must have a --- body separator');
  return markdown.slice(at + marker.length);
}

describe('mms-7a Grok path on ai-gateway', () => {
  test('locks the gateway catalog id and maps it to xai', () => {
    assert.equal(GROK_GATEWAY_MODEL, 'spacexai/grok-4.6');
    assert.equal(GROK_MODEL_SLUG, 'grok-4.6');
    assert.equal(GROK_MODEL_PROVIDER, 'xai');
    assert.equal(isGatewayModelId(GROK_GATEWAY_MODEL), true);
    assert.equal(inferProvider(GROK_GATEWAY_MODEL), 'xai');
    assert.equal(inferProvider(GROK_MODEL_SLUG), 'xai');
  });

  test('does not register a bespoke xai provider', () => {
    assert.equal('xai' in PROVIDERS, false);
    assert.equal('ai-gateway' in PROVIDERS, true);
    assert.equal(existsSync(join(ROOT, 'scripts/lib/scoring/providers/xai.ts')), false);
  });

  test('frozen prompt body matches the Opus 5 rubric except the identity header', () => {
    const grokPath = join(ROOT, GROK_PROMPT_FILE);
    const opusPath = join(ROOT, 'data/prompts', GROK_RUBRIC_SOURCE);
    const grok = readFileSync(grokPath, 'utf8');
    const opus = readFileSync(opusPath, 'utf8');
    assert.match(grok, new RegExp(GROK_PROMPT_VERSION.replace(/\./g, '\\.')));
    assert.match(grok, /spacexai\/grok-4\.6/);
    assert.equal(rubricBody(grok), rubricBody(opus));
  });
});
