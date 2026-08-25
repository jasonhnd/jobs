/**
 * conformance.test.ts — the acceptance suite EVERY provider must pass.
 *
 * This is what makes "we can add another vendor later" a guarantee rather than
 * a hope: the suite iterates the registry, so a newly registered provider is
 * picked up automatically and has to prove it cannot weaken the AIOIS-10
 * contract, the error vocabulary, or the schema translation.
 *
 * Deliberately makes NO real model calls — it exercises the pure surface only.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { PROVIDERS, PROVIDER_NAMES } from './index.js';
import { AWAITING_ANSWER_MARKER, collectSubagentModels, inAgentProvider, loadAnswers } from './in-agent.js';
import { AIOIS_FIELD_NAMES, AioisOutputSchema, SCORE_OUTPUT_JSON_SCHEMA } from '../contract.js';
import { SCORING_ERROR_KINDS, classifyErrorText, type ScoringErrorKind } from '../errors.js';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'scoring-conformance-'));

/** Error wording every provider must agree on unless it overrides classifyError. */
const SHARED_ERROR_CASES: ReadonlyArray<readonly [string, ScoringErrorKind]> = [
  ['Requested model gpt-9 is unavailable', 'model_unavailable'],
  ['指定されたモデルは利用できません', 'model_unavailable'],
  ['HTTP 429 Too Many Requests', 'rate_limited'],
  ['I cannot comply with this request', 'refusal'],
  ['upstream provider error while routing', 'transport'],
  ['connection failed: ETIMEDOUT', 'transport'],
  ['response stopped at max_tokens', 'truncated'],
  ['banana pancakes', 'malformed'],
];

describe('contract stays internally consistent', () => {
  test('AIOIS_FIELD_NAMES matches the schema shape and the JSON Schema', () => {
    assert.deepEqual(Object.keys(AioisOutputSchema.shape), [...AIOIS_FIELD_NAMES]);
    assert.deepEqual(Object.keys(SCORE_OUTPUT_JSON_SCHEMA.properties.aiois.properties), [...AIOIS_FIELD_NAMES]);
    assert.deepEqual([...SCORE_OUTPUT_JSON_SCHEMA.properties.aiois.required], [...AIOIS_FIELD_NAMES]);
    assert.equal(AIOIS_FIELD_NAMES.length, 12);
  });
});

describe('provider registry', () => {
  test('registers at least the codex and in-agent providers', () => {
    assert.ok(PROVIDER_NAMES.includes('codex'));
    assert.ok(PROVIDER_NAMES.includes('in-agent'));
  });

  test('every registry key matches its provider name', () => {
    for (const [key, provider] of Object.entries(PROVIDERS)) {
      assert.equal(provider.name, key, `provider registered as "${key}" reports name "${provider.name}"`);
    }
  });
});

for (const [name, provider] of Object.entries(PROVIDERS)) {
  describe(`provider conformance: ${name}`, () => {
    test('declares a usable capability set', () => {
      assert.ok(provider.description.trim().length > 0, 'description must be non-empty');
      assert.equal(typeof provider.supportsNativeSchema, 'boolean');
      assert.ok(
        Number.isInteger(provider.maxConcurrency) && provider.maxConcurrency >= 1,
        'maxConcurrency must be a positive integer',
      );
      assert.ok(
        provider.deterministic === undefined || typeof provider.deterministic === 'boolean',
        'deterministic must be a boolean when declared',
      );
      assert.equal(typeof provider.preflight, 'function');
      assert.equal(typeof provider.prepareRun, 'function');
      assert.equal(typeof provider.ask, 'function');
    });

    test('maps shared failure wording onto the shared vocabulary', () => {
      for (const [text, expected] of SHARED_ERROR_CASES) {
        const kind = provider.classifyError?.(text) ?? classifyErrorText(text);
        assert.ok(SCORING_ERROR_KINDS.includes(kind), `${name} returned unknown kind "${kind}"`);
        assert.equal(kind, expected, `${name} classified "${text}" as ${kind}, expected ${expected}`);
      }
    });

    test('never classifies anything as a silent model substitution', () => {
      // There is deliberately no vocabulary entry meaning "use another model".
      const kind = provider.classifyError?.('Requested model gpt-9 is unavailable') ?? 'model_unavailable';
      assert.equal(kind, 'model_unavailable');
    });

    test(
      provider.supportsNativeSchema
        ? 'materializes a native schema carrying all 12 AIOIS fields'
        : 'declares no native schema and materializes none',
      () => {
        const dir = makeTmp();
        try {
          const prep = provider.prepareRun({ cwd: dir, model: 'conformance-model', runDir: dir, options: {} });
          if (!provider.supportsNativeSchema) {
            assert.equal(prep.outputSchemaPath, undefined);
            return;
          }
          assert.ok(prep.outputSchemaPath, 'a native-schema provider must return outputSchemaPath');
          const schema = JSON.parse(readFileSync(prep.outputSchemaPath!, 'utf8')) as {
            properties: { aiois: { properties: Record<string, unknown>; required: string[] } };
            required: string[];
          };
          assert.deepEqual(Object.keys(schema.properties.aiois.properties), [...AIOIS_FIELD_NAMES]);
          assert.deepEqual(schema.properties.aiois.required, [...AIOIS_FIELD_NAMES]);
          assert.deepEqual(schema.required, ['id', 'ai_risk', 'rationale_ja', 'confidence', 'aiois']);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      },
    );

    test('ask() returns a well-formed response shape when its inputs are incomplete', async () => {
      // Exercises the guard path only — no vendor is contacted, because every
      // provider must reject a run that prepareRun did not set up.
      const response = await provider.ask('prompt', {
        cwd: '/nonexistent-conformance-cwd',
        model: 'conformance-model',
        outputLastMessagePath: '/nonexistent-conformance-cwd/last.txt',
      });
      assert.equal(typeof response.exitCode, 'number');
      assert.equal(typeof response.stdout, 'string');
      assert.equal(typeof response.stderr, 'string');
      assert.equal(typeof response.rawText, 'string');
      assert.notEqual(response.exitCode, 0, 'an unprepared run must not report success');
    });
  });
}

describe('in-agent model attestation gate', () => {
  const ctx = (options: Record<string, string>) => ({
    cwd: '/tmp',
    model: 'claude-opus-5',
    runDir: '/tmp',
    options,
  });

  test('refuses to run without an explicit attestation', () => {
    assert.throws(() => inAgentProvider.preflight(ctx({})), /--attest-model/);
  });

  test('refuses an attestation that disagrees with --model', () => {
    assert.throws(
      () => inAgentProvider.preflight(ctx({ 'attest-model': 'claude-fable-5' })),
      /does not match --model/,
    );
  });

  test('accepts a matching attestation', () => {
    assert.doesNotThrow(() => inAgentProvider.preflight(ctx({ 'attest-model': 'claude-opus-5' })));
  });

  test('mechanically rejects transcripts naming another model', () => {
    const dir = makeTmp();
    try {
      writeFileSync(join(dir, 'agent-good1.jsonl'), '{"message":{"model":"claude-opus-5"}}\n');
      writeFileSync(join(dir, 'agent-bad1.jsonl'), '{"message":{"model":"claude-fable-5"}}\n');

      // Directory-wide: the foreign transcript is caught.
      assert.throws(
        () => inAgentProvider.preflight(ctx({ 'attest-model': 'claude-opus-5', 'verify-subagents': dir })),
        /name a model other than "claude-opus-5".*bad1/s,
      );

      // Id-scoped: unrelated agents in the same directory are not penalised.
      assert.doesNotThrow(() =>
        inAgentProvider.preflight(
          ctx({ 'attest-model': 'claude-opus-5', 'verify-subagents': dir, 'verify-agent-ids': 'good1' }),
        ),
      );

      // A scope that matches nothing must fail rather than vacuously pass.
      assert.throws(
        () =>
          inAgentProvider.preflight(
            ctx({ 'attest-model': 'claude-opus-5', 'verify-subagents': dir, 'verify-agent-ids': 'nope' }),
          ),
        /no agent transcripts found/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('collectSubagentModels reports per-agent model sets', () => {
    const dir = makeTmp();
    try {
      writeFileSync(join(dir, 'agent-x.jsonl'), '{"message":{"model":"claude-opus-5"}}\nnot-json\n{"message":{}}\n');
      writeFileSync(join(dir, 'agent-y.jsonl'), '{"message":{"model":"<synthetic>"}}\n');
      const found = collectSubagentModels(dir);
      assert.deepEqual([...(found.get('x') ?? [])], ['claude-opus-5']);
      assert.equal(found.has('y'), false, '<synthetic> is not a model claim');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('in-agent answer ingestion', () => {
  test('reports a missing answer as pending rather than a model failure', async () => {
    const dir = makeTmp();
    try {
      inAgentProvider.prepareRun({ cwd: dir, model: 'claude-opus-5', runDir: dir, options: {} });
      const response = await inAgentProvider.ask('prompt body', {
        cwd: dir,
        model: 'claude-opus-5',
        outputLastMessagePath: join(dir, 'last.txt'),
        runDir: dir,
        occId: 42,
      });
      assert.notEqual(response.exitCode, 0);
      assert.match(response.stderr, new RegExp(AWAITING_ANSWER_MARKER));
      assert.equal(inAgentProvider.classifyError?.(response.stderr), 'missing_answer');
      assert.equal(readFileSync(join(dir, 'prompts', '0042.txt'), 'utf8'), 'prompt body');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('loads chunked JSONL answers and skips unparseable lines', () => {
    const dir = makeTmp();
    try {
      const answers = join(dir, 'answers');
      inAgentProvider.prepareRun({ cwd: dir, model: 'claude-opus-5', runDir: dir, options: {} });
      writeFileSync(join(answers, 'chunk-01.jsonl'), '{"id":1,"x":1}\nnot-json\n{"id":2}\n');
      writeFileSync(join(answers, 'chunk-02.jsonl'), '{"id":3}\n');
      const loaded = loadAnswers(answers);
      assert.deepEqual([...loaded.keys()].sort((a, b) => a - b), [1, 2, 3]);
      assert.equal(loaded.get(1), '{"id":1,"x":1}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
