// Tests for the grok-cli scoring transport. No model calls.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { classifyErrorText } from './lib/scoring/errors.js';
import { parseReasoningEffort } from './lib/scoring/providers/codex.js';
import {
  assertGrokCliProbe,
  buildGrokExecArgs,
  compareGrokVersions,
  executeGrokAsk,
  grokCliProvider,
  grokEnvelopePath,
  grokHelpRejectsHigh,
  grokIsolateDir,
  grokPromptPath,
  grokScoreSchemaJson,
  interpretGrokEnvelope,
  parseGrokReasoningEffort,
  readGrokVersion,
  GROK_CLI_MIN_VERSION,
  GROK_REASONING_EFFORTS,
  type GrokCliProbe,
  type GrokSpawn,
} from './lib/scoring/providers/grok-cli.js';

const HELP = [
  '  -m, --model <MODEL>',
  '      --json-schema <SCHEMA>',
  '      --prompt-file <PATH>',
  '      --reasoning-effort <EFFORT>',
  '      --output-format <OUTPUT_FORMAT>',
].join('\n');

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'grok-cli-test-'));

function probe(over: Partial<GrokCliProbe> = {}): GrokCliProbe {
  return {
    helpCommand: ['grok', '--help'],
    helpStatus: 0,
    helpStdout: HELP,
    helpStderr: '',
    helpError: null,
    versionCommand: ['grok', '--version'],
    versionStatus: 0,
    versionStdout: 'grok 1.0.40 (abc) [stable]',
    versionStderr: '',
    versionError: null,
    ...over,
  };
}

function envelope(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    text: JSON.stringify({ id: 12, source: 'text' }),
    stopReason: 'end_turn',
    sessionId: 'sess',
    modelUsage: { 'grok-4.7': { inputTokens: 3 } },
    num_turns: 1,
    ...extra,
  });
}

describe('grok-cli argv', () => {
  test('every call passes --model, inline schema, prompt file, effort, and the frozen flags', () => {
    const schemaJson = grokScoreSchemaJson();
    const args = buildGrokExecArgs({
      isolateCwd: '/run/isolate/12',
      model: 'grok-4.7',
      promptFile: '/run/prompts/12.txt',
      reasoningEffort: 'high',
      schemaJson,
    });
    assert.deepEqual(args, [
      '--cwd', '/run/isolate/12',
      '--sandbox', 'strict',
      '--max-turns', '1',
      '--no-subagents',
      '--no-plan',
      '--disable-web-search',
      '--verbatim',
      '--permission-mode', 'dontAsk',
      '--output-format', 'json',
      '--json-schema', schemaJson,
      '--prompt-file', '/run/prompts/12.txt',
      '--reasoning-effort', 'high',
      '--model', 'grok-4.7',
    ]);
    assert.equal(args.filter((arg) => arg === '--model').length, 1);
    assert.equal(schemaJson.startsWith('{'), true);
    assert.equal(schemaJson.includes('\n'), false);
    assert.equal(schemaJson.includes('grok-score.schema.json'), false);
    for (const banned of ['--yolo', '--always-approve', '--resume', '-']) {
      assert.equal(args.includes(banned), false, banned);
    }
  });

  test('the model flag is the requested slug, whatever that slug is', () => {
    for (const model of ['grok-4.7', 'grok-4.7-build-fast', 'grok-4.6']) {
      const args = buildGrokExecArgs({
        isolateCwd: '/run/isolate/1',
        model,
        promptFile: '/run/prompts/1.txt',
        reasoningEffort: 'high',
        schemaJson: '{}',
      });
      assert.equal(args[args.indexOf('--model') + 1], model);
    }
  });

  test('reasoning effort is grok\'s enum and is required', () => {
    for (const effort of GROK_REASONING_EFFORTS) assert.equal(parseGrokReasoningEffort(effort), effort);
    assert.throws(() => parseGrokReasoningEffort(undefined), /--reasoning-effort must be one of/);
    assert.throws(() => parseGrokReasoningEffort('true'), /--reasoning-effort must be one of/);
    assert.equal(parseGrokReasoningEffort('max'), 'max');
    assert.throws(() => parseReasoningEffort('max'), /--reasoning-effort must be one of/);
    assert.equal(parseReasoningEffort(undefined), null);
  });
});

describe('grok-cli preflight fixtures', () => {
  test('reads a version and compares it to 1.0.40', () => {
    assert.equal(readGrokVersion('grok 1.0.40 (abc) [stable]'), '1.0.40');
    assert.equal(compareGrokVersions('1.0.40', GROK_CLI_MIN_VERSION), 0);
    assert.equal(compareGrokVersions('1.0.39', GROK_CLI_MIN_VERSION), -1);
    assert.equal(compareGrokVersions('1.1.0', GROK_CLI_MIN_VERSION), 1);
  });

  test('passes a 1.0.40 help text that has the flags and no effort menu', () => {
    assert.equal(grokHelpRejectsHigh(HELP), false);
    assert.doesNotThrow(() => assertGrokCliProbe(probe()));
  });

  test('fails when the binary cannot run, help is missing a flag, version is old, or the menu rejects high', () => {
    assert.throws(() => assertGrokCliProbe(probe({ helpError: 'spawn grok ENOENT' })), /ENOENT/);
    assert.throws(() => assertGrokCliProbe(probe({ helpStatus: 2, helpStderr: 'bad option' })), /status 2/);
    assert.throws(
      () => assertGrokCliProbe(probe({ helpStdout: HELP.replace('--json-schema <SCHEMA>\n', '') })),
      /--json-schema/,
    );
    assert.throws(() => assertGrokCliProbe(probe({ versionStdout: 'grok 1.0.39' })), /below 1.0.40/);
    const menu = `${HELP}\nPossible values: none, minimal, low, medium, xhigh, max`;
    assert.equal(grokHelpRejectsHigh(menu), true);
    assert.throws(() => assertGrokCliProbe(probe({ helpStdout: menu })), /refusing to downgrade/);
    const withHigh = `${HELP}\nPossible values: none, minimal, low, medium, high, xhigh, max`;
    assert.doesNotThrow(() => assertGrokCliProbe(probe({ helpStdout: withHigh })));
  });
});

describe('grok-cli envelope', () => {
  test('structured_output wins, otherwise text that parses as an object', () => {
    const structured = interpretGrokEnvelope(
      envelope({ structured_output: { id: 12, source: 'structured' } }),
      'grok-4.7',
    );
    assert.equal(structured.ok, true);
    assert.deepEqual(JSON.parse(structured.rawText), { id: 12, source: 'structured' });

    const fromText = interpretGrokEnvelope(envelope(), 'grok-4.7');
    assert.equal(fromText.ok, true);
    assert.deepEqual(JSON.parse(fromText.rawText), { id: 12, source: 'text' });
  });

  test('a modelUsage key other than the requested slug is model_unavailable and is not a score', () => {
    for (const key of ['grok-4.7-build-fast', 'grok-4.6', 'grok-4.5']) {
      const result = interpretGrokEnvelope(envelope({ modelUsage: { [key]: { inputTokens: 1 } } }), 'grok-4.7');
      assert.equal(result.ok, false);
      assert.equal(result.kind, 'model_unavailable');
      assert.equal(result.rawText, '');
      assert.equal(classifyErrorText(result.stderr), 'model_unavailable');
    }
    const extra = interpretGrokEnvelope(
      envelope({ modelUsage: { 'grok-4.7': { inputTokens: 1 }, 'grok-4.6': { inputTokens: 1 } } }),
      'grok-4.7',
    );
    assert.equal(extra.kind, 'model_unavailable');
    assert.equal(extra.rawText, '');
    assert.equal(classifyErrorText(extra.stderr), 'model_unavailable');
  });

  test('num_turns other than 1 is transport and is not a score', () => {
    const result = interpretGrokEnvelope(envelope({ num_turns: 2 }), 'grok-4.7');
    assert.equal(result.ok, false);
    assert.equal(result.kind, 'transport');
    assert.equal(result.rawText, '');
    assert.equal(classifyErrorText(result.stderr), 'transport');
  });

  test('stdout that is not an envelope is malformed and keeps no envelope object', () => {
    const result = interpretGrokEnvelope('not-json', 'grok-4.7');
    assert.equal(result.kind, 'malformed');
    assert.equal(result.envelope, null);
    assert.equal(result.rawText, '');
    assert.equal(classifyErrorText(result.stderr), 'malformed');
  });
});

describe('grok-cli ask', () => {
  test('writes the prompt file, passes the frozen argv, and stores the envelope separately', async () => {
    const dir = makeTmp();
    try {
      const calls: string[][] = [];
      const spawnGrok: GrokSpawn = async (args) => {
        calls.push([...args]);
        assert.equal(readFileSync(grokPromptPath(dir, 12), 'utf8'), 'PROMPT-BODY');
        return {
          exitCode: 0,
          stdout: envelope({ structured_output: { id: 12, source: 'structured' } }),
          stderr: '',
          error: null,
        };
      };
      const options = {
        cwd: dir,
        model: 'grok-4.7',
        outputLastMessagePath: join(dir, 'last.txt'),
        outputSchemaPath: join(dir, 'grok-score.schema.json'),
        runDir: dir,
        rawDir: join(dir, 'raw'),
        occId: 12,
      };
      const response = await executeGrokAsk('PROMPT-BODY', options, 'high', spawnGrok);
      assert.equal(response.exitCode, 0);
      assert.deepEqual(JSON.parse(response.rawText), { id: 12, source: 'structured' });
      assert.deepEqual(calls, [
        buildGrokExecArgs({
          isolateCwd: grokIsolateDir(dir, 12),
          model: 'grok-4.7',
          promptFile: grokPromptPath(dir, 12),
          reasoningEffort: 'high',
          schemaJson: grokScoreSchemaJson(),
        }),
      ]);
      const saved = JSON.parse(readFileSync(grokEnvelopePath(options)!, 'utf8')) as { sessionId: string };
      assert.equal(saved.sessionId, 'sess');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a rejected envelope is saved, and rawText stays empty', async () => {
    const dir = makeTmp();
    try {
      const response = await executeGrokAsk(
        'PROMPT-BODY',
        {
          cwd: dir,
          model: 'grok-4.7',
          outputLastMessagePath: join(dir, 'last.txt'),
          outputSchemaPath: join(dir, 'schema.json'),
          runDir: dir,
          occId: 12,
        },
        'high',
        async () => ({ exitCode: 0, stdout: envelope({ num_turns: 2 }), stderr: '', error: null }),
      );
      assert.equal(response.exitCode, 1);
      assert.equal(response.rawText, '');
      assert.equal(classifyErrorText(response.stderr), 'transport');
      const saved = readFileSync(join(dir, 'raw', '12.envelope.json'), 'utf8');
      assert.equal(JSON.parse(saved).num_turns, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an unprepared ask does not create a prompt file', async () => {
    const dir = makeTmp();
    try {
      const response = await grokCliProvider.ask('PROMPT-BODY', {
        cwd: dir,
        model: 'grok-4.7',
        outputLastMessagePath: join(dir, 'last.txt'),
        runDir: dir,
        occId: 12,
      });
      assert.notEqual(response.exitCode, 0);
      assert.equal(response.rawText, '');
      assert.throws(() => readFileSync(grokPromptPath(dir, 12), 'utf8'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('grok-cli prepareRun', () => {
  test('a missing grok binary is an audit record, not a thrown error', () => {
    const dir = makeTmp();
    const savedPath = process.env.PATH;
    process.env.PATH = dir;
    try {
      const missing = grokCliProvider.prepareRun({
        cwd: dir,
        model: 'grok-4.7',
        runDir: dir,
        options: {},
      });
      assert.equal(missing.audit?.reasoning_effort ?? null, null);
      assert.equal(missing.audit?.reasoning_effort_source, 'missing');
      assert.ok(missing.audit?.error || missing.audit?.status !== 0);
      const schema = JSON.parse(readFileSync(missing.outputSchemaPath!, 'utf8')) as { required: string[] };
      assert.deepEqual(schema.required, ['id', 'ai_risk', 'rationale_ja', 'confidence', 'aiois']);

      const withEffort = grokCliProvider.prepareRun({
        cwd: dir,
        model: 'grok-4.7',
        runDir: dir,
        options: { 'reasoning-effort': 'high' },
      });
      assert.equal(withEffort.audit?.reasoning_effort, 'high');
      assert.equal(withEffort.audit?.reasoning_effort_source, 'cli-flag');
      assert.equal(grokCliProvider.maxConcurrency, 4);
      assert.equal(grokCliProvider.supportsNativeSchema, true);
    } finally {
      grokCliProvider.prepareRun({ cwd: dir, model: 'grok-4.7', runDir: dir, options: {} });
      process.env.PATH = savedPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
