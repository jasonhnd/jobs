/**
 * ai-gateway.test.ts — pin the gateway provider's pure surface: model-id
 * shape, executed-model matching (the no-silent-substitution assert),
 * completion-envelope extraction, error classification scope, sidecar
 * attestation, and the no-network guard paths (#340). Conformance coverage
 * lives in conformance.test.ts; this file pins the provider-specific rules.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  askGateway,
  attestationsMatchBatch,
  classifyGatewayError,
  executedModelMatches,
  extractCompletion,
  isGatewayModelId,
  parseExecutedModelsJsonl,
} from './ai-gateway.js';

describe('isGatewayModelId', () => {
  test('accepts creator/slug ids including dots and dashes', () => {
    assert.equal(isGatewayModelId('anthropic/claude-opus-5'), true);
    assert.equal(isGatewayModelId('openai/gpt-5.6-sol'), true);
    assert.equal(isGatewayModelId('xai/grok-4'), true);
  });

  test('rejects bare slugs so the gateway can never guess the vendor', () => {
    assert.equal(isGatewayModelId('claude-opus-5'), false);
    assert.equal(isGatewayModelId(''), false);
    assert.equal(isGatewayModelId('a//b'), false);
    assert.equal(isGatewayModelId('/claude'), false);
  });
});

describe('executedModelMatches', () => {
  test('accepts a verbatim echo and slug-only echo', () => {
    assert.equal(executedModelMatches('anthropic/claude-opus-5', 'anthropic/claude-opus-5'), true);
    assert.equal(executedModelMatches('anthropic/claude-opus-5', 'claude-opus-5'), true);
  });

  test('accepts dated variants of the same model', () => {
    assert.equal(executedModelMatches('anthropic/claude-opus-5', 'claude-opus-5-20260726'), true);
    assert.equal(executedModelMatches('anthropic/claude-opus-5', 'anthropic/claude-opus-5-20260726'), true);
  });

  test('rejects a different model or family outright', () => {
    assert.equal(executedModelMatches('anthropic/claude-opus-5', 'claude-fable-5'), false);
    assert.equal(executedModelMatches('openai/gpt-5.6-sol', 'gpt-5.5'), false);
    assert.equal(executedModelMatches('anthropic/claude-opus-5', ''), false);
  });
});

describe('extractCompletion', () => {
  test('extracts model, content, and finish reason from a completion envelope', () => {
    const completion = extractCompletion({
      model: 'anthropic/claude-opus-5',
      choices: [{ message: { content: '{"id":1}' }, finish_reason: 'stop' }],
    });

    assert.deepEqual(completion, { model: 'anthropic/claude-opus-5', content: '{"id":1}', finishReason: 'stop' });
  });

  test('returns null when the content channel is missing', () => {
    assert.equal(extractCompletion({ choices: [{ message: {} }] }), null);
    assert.equal(extractCompletion('not an object'), null);
    assert.equal(extractCompletion(null), null);
  });
});

describe('classifyGatewayError', () => {
  test('maps the provider mismatch marker onto model_unavailable', () => {
    assert.equal(
      classifyGatewayError('model_mismatch: requested "a/b" but the gateway executed "c"'),
      'model_unavailable',
    );
  });

  test('maps connection failures onto transport (retry with backoff)', () => {
    assert.equal(classifyGatewayError('connection failed: TypeError: fetch failed'), 'transport');
    assert.equal(classifyGatewayError('connection failed: TimeoutError: The operation was aborted'), 'transport');
  });

  test('returns null for everything else so the shared vocabulary keeps authority', () => {
    assert.equal(classifyGatewayError('HTTP 429 Too Many Requests'), null);
    assert.equal(classifyGatewayError('Requested model gpt-9 is unavailable'), null);
    assert.equal(classifyGatewayError('banana pancakes'), null);
  });
});

describe('executed-models sidecar', () => {
  test('parses well-formed jsonl', () => {
    const text = [
      JSON.stringify({ id: 111, requested: 'anthropic/claude-opus-5', executed: 'anthropic/claude-opus-5' }),
      JSON.stringify({ id: 156, requested: 'anthropic/claude-opus-5', executed: 'claude-opus-5-20260726' }),
      '',
    ].join('\n');
    const parsed = parseExecutedModelsJsonl(text);
    assert.equal(parsed.error, null);
    assert.equal(parsed.rows.length, 2);
    assert.equal(attestationsMatchBatch(parsed.rows, 'claude-opus-5'), null);
    assert.equal(attestationsMatchBatch(parsed.rows, 'anthropic/claude-opus-5'), null);
  });

  test('fails when the gateway executed a different model', () => {
    const rows = [{ id: 111, requested: 'anthropic/claude-opus-5', executed: 'openai/gpt-5.6-sol' }];
    assert.match(attestationsMatchBatch(rows, 'claude-opus-5') ?? '', /executed "openai\/gpt-5.6-sol"/);
  });

  test('fails when the requested model is not the batch scorer.model', () => {
    const rows = [{ id: 111, requested: 'anthropic/claude-fable-5', executed: 'anthropic/claude-fable-5' }];
    assert.match(attestationsMatchBatch(rows, 'claude-opus-5') ?? '', /does not match batch scorer.model/);
  });

  test('fails on an empty sidecar', () => {
    assert.equal(attestationsMatchBatch([], 'claude-opus-5'), 'executed-models.jsonl is empty');
  });
});

describe('askGateway guard paths (no network)', () => {
  test('fails without outputSchemaPath before any vendor contact', async () => {
    const response = await askGateway('prompt', {
      cwd: '/tmp',
      model: 'anthropic/claude-opus-5',
      outputLastMessagePath: '/tmp/last.txt',
    });

    assert.notEqual(response.exitCode, 0);
    assert.match(response.stderr, /outputSchemaPath/);
  });

  test('fails without AI_GATEWAY_API_KEY before any vendor contact', async () => {
    const saved = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      const response = await askGateway('prompt', {
        cwd: '/tmp',
        model: 'anthropic/claude-opus-5',
        outputLastMessagePath: '/tmp/last.txt',
        outputSchemaPath: '/tmp/schema.json',
      });

      assert.notEqual(response.exitCode, 0);
      assert.match(response.stderr, /AI_GATEWAY_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
    }
  });
});
