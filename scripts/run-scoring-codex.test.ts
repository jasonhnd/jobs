// Tests for scripts/run-scoring-codex.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  assertCodexModelSupport,
  buildCodexExecArgs,
  buildRunName,
  codexExecSupportsModel,
  completedIdsFromJsonl,
  parseArgs,
  scoreOccupationWithRetries,
  scoreToJsonLine,
  selectPendingOccupations,
  validateAndNormalizeResponse,
  type CodexExecutor,
} from './run-scoring-codex.js';

const AIOIS = {
  d1: 4.8,
  d2: 4.4,
  d3: 5.0,
  d4: 6.5,
  d5: 5.8,
  d6: 3.0,
  d7: 4.2,
  d8: 3.6,
  d9: 2.8,
  d10: 3.5,
  transformation: 4.6,
  displacement: 1.7,
};

const validScore = (id = 1) => ({
  id,
  ai_risk: 4.6,
  rationale_ja: '職務の一部は情報処理で変化するが、現場判断が残る。',
  confidence: 0.8,
  aiois: AIOIS,
});

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'run-scoring-codex-test-'));

describe('parseArgs', () => {
  test('requires --prompt-file', () => {
    assert.throws(() => parseArgs([], '/repo'), /prompt-file/);
  });

  test('parses pilot flags and caps concurrency at 4', () => {
    const args = parseArgs(
      ['--prompt-file', 'data/prompts/x.md', '--out', 'out.jsonl', '--model', 'gpt-5.6-sol', '--ids', '1,2,3', '--limit', '2', '--resume', '--concurrency', '9'],
      '/repo',
      new Date('2026-07-12T00:00:00Z'),
    );
    assert.equal(args.promptFile, resolve('/repo', 'data/prompts/x.md'));
    assert.equal(args.outPath, resolve('out.jsonl'));
    assert.equal(args.model, 'gpt-5.6-sol');
    assert.deepEqual(args.ids, [1, 2, 3]);
    assert.equal(args.limit, 2);
    assert.equal(args.resume, true);
    assert.equal(args.concurrency, 4);
  });

  test('buildRunName is stable and filesystem-safe', () => {
    assert.equal(buildRunName('gpt/5.6 sol', 'raw scores.jsonl', new Date('2026-07-12T01:02:03Z')), 'raw-scores-gpt-5.6-sol-20260712T010203Z');
  });
});

describe('response validation', () => {
  test('accepts a valid full AIOIS object and preserves JSONL shape', () => {
    const score = validateAndNormalizeResponse(JSON.stringify(validScore(1)), 1);
    assert.equal(score.id, 1);
    assert.equal(score.ai_risk, 4.6);
    assert.equal(score.aiois.transformation, 4.6);
    assert.equal(
      scoreToJsonLine(score),
      '{"id":1,"ai_risk":4.6,"rationale_ja":"職務の一部は情報処理で変化するが、現場判断が残る。","confidence":0.8,"aiois":{"d1":4.8,"d2":4.4,"d3":5,"d4":6.5,"d5":5.8,"d6":3,"d7":4.2,"d8":3.6,"d9":2.8,"d10":3.5,"transformation":4.6,"displacement":1.7}}',
    );
  });

  test('normalizes a fenced JSON response before validation', () => {
    const score = validateAndNormalizeResponse(`\`\`\`json\n${JSON.stringify(validScore(2))}\n\`\`\``, 2);
    assert.equal(score.id, 2);
  });

  test('rejects id mismatch and invalid AIOIS formula', () => {
    assert.throws(() => validateAndNormalizeResponse(JSON.stringify(validScore(2)), 1), /id mismatch/);
    assert.throws(
      () => validateAndNormalizeResponse(JSON.stringify({ ...validScore(1), ai_risk: 5.0, aiois: { ...AIOIS, transformation: 5.0 } }), 1),
      /mean\(d1,d2\)/,
    );
  });

  test('detects codex exec --model support from help text', () => {
    assert.equal(codexExecSupportsModel('  -m, --model <MODEL>\\n          Model the agent should use'), true);
    assert.equal(codexExecSupportsModel('Usage: codex exec [OPTIONS] [PROMPT]'), false);
  });

  test('fails model preflight on probe errors, non-zero exits, and missing --model support', () => {
    const command = ['codex', 'exec', '--help'] as const;
    assert.throws(
      () => assertCodexModelSupport({ command, status: null, stdout: '', stderr: '', error: 'ENOENT' }),
      /ENOENT/,
    );
    assert.throws(
      () => assertCodexModelSupport({ command, status: 2, stdout: '', stderr: 'bad option', error: null }),
      /status 2.*bad option/,
    );
    assert.throws(
      () =>
        assertCodexModelSupport({
          command,
          status: 0,
          stdout: 'Usage: codex exec [OPTIONS] [PROMPT]',
          stderr: '',
          error: null,
        }),
      /upgrade Codex/,
    );
    assert.doesNotThrow(() =>
      assertCodexModelSupport({
        command,
        status: 0,
        stdout: '  -m, --model <MODEL>\\n          Model the agent should use',
        stderr: '',
        error: null,
      }),
    );
  });

  test('builds every Codex invocation with the explicit requested model', () => {
    const args = buildCodexExecArgs({
      cwd: '/repo',
      model: 'gpt-5.6-sol',
      outputSchemaPath: '/repo/schema.json',
      outputLastMessagePath: '/repo/last.txt',
    });
    assert.deepEqual(args.slice(-3), ['--model', 'gpt-5.6-sol', '-']);
    assert.equal(args.filter((arg) => arg === '--model').length, 1);
  });

  test('rejects explicit provider/model errors and all-zero placeholders', () => {
    assert.throws(
      () => validateAndNormalizeResponse('Requested model gpt-5.6-sol is unavailable', 1),
      /upstream error\/refusal/,
    );
    const zeroAiois = Object.fromEntries(Object.keys(AIOIS).map((key) => [key, 0]));
    assert.throws(
      () =>
        validateAndNormalizeResponse(
          JSON.stringify({
            id: 1,
            ai_risk: 0,
            rationale_ja: '採点結果を生成できませんでした。',
            confidence: 0,
            aiois: zeroAiois,
          }),
          1,
        ),
      /all-zero placeholder/,
    );
  });
});

describe('resume filtering', () => {
  test('reads completed ids from existing JSONL and skips them before limit', () => {
    const done = completedIdsFromJsonl('{"id":1}\nnot-json\n{"id":3,"ai_risk":4.0}\n');
    assert.deepEqual([...done].sort((a, b) => a - b), [1, 3]);
    const pending = selectPendingOccupations(
      [
        { id: 1, text: 'one' },
        { id: 2, text: 'two' },
        { id: 3, text: 'three' },
        { id: 4, text: 'four' },
      ],
      { ids: [1, 2, 3, 4], limit: 2 },
      done,
    );
    assert.deepEqual(pending.map((o) => o.id), [2, 4]);
  });
});

describe('retry/failure accounting', () => {
  test('retries invalid model output, then succeeds and writes raw audit text', async () => {
    const dir = makeTmp();
    try {
      const rawDir = join(dir, 'raw');
      const tmpDir = join(dir, 'tmp');
      mkdirSync(tmpDir, { recursive: true });
      let calls = 0;
      const executor: CodexExecutor = async () => {
        calls += 1;
        return { exitCode: 0, stdout: '', stderr: '', rawText: calls < 3 ? 'not json' : JSON.stringify(validScore(7)) };
      };
      const result = await scoreOccupationWithRetries(
        { id: 7, text: '職業ID: 7' },
        'rubric',
        { cwd: dir, model: 'gpt-5.6-sol', outputSchemaPath: join(dir, 'schema.json'), tmpDir, rawDir },
        executor,
        async () => {},
      );
      assert.equal(result.ok, true);
      assert.equal(calls, 3);
      assert.equal(result.attempts, 3);
      assert.equal(existsSync(join(rawDir, '7.txt')), true);
      assert.match(readFileSync(join(rawDir, '7.txt'), 'utf8'), /not json/);
      assert.match(readFileSync(join(rawDir, '7.txt'), 'utf8'), /"id":7/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns a failure after three invalid responses', async () => {
    const dir = makeTmp();
    try {
      const rawDir = join(dir, 'raw');
      const tmpDir = join(dir, 'tmp');
      mkdirSync(tmpDir, { recursive: true });
      let calls = 0;
      const executor: CodexExecutor = async () => {
        calls += 1;
        return { exitCode: 0, stdout: '', stderr: '', rawText: JSON.stringify({ ...validScore(9), ai_risk: 4.5 }) };
      };
      const result = await scoreOccupationWithRetries(
        { id: 9, text: '職業ID: 9' },
        'rubric',
        { cwd: dir, model: 'gpt-5.6-sol', outputSchemaPath: join(dir, 'schema.json'), tmpDir, rawDir },
        executor,
        async () => {},
      );
      assert.equal(result.ok, false);
      assert.equal(calls, 3);
      assert.equal(result.failures.length, 3);
      assert.match(result.failures[2]!.message, /ai_risk/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('retries an explicit model-unavailable response and records the rejection reason', async () => {
    const dir = makeTmp();
    try {
      const rawDir = join(dir, 'raw');
      const tmpDir = join(dir, 'tmp');
      mkdirSync(tmpDir, { recursive: true });
      let calls = 0;
      const executor: CodexExecutor = async () => {
        calls += 1;
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          rawText: calls === 1 ? 'Requested model gpt-5.6-sol is unavailable' : JSON.stringify(validScore(11)),
        };
      };
      const result = await scoreOccupationWithRetries(
        { id: 11, text: '職業ID: 11' },
        'rubric',
        { cwd: dir, model: 'gpt-5.6-sol', outputSchemaPath: join(dir, 'schema.json'), tmpDir, rawDir },
        executor,
        async () => {},
      );
      assert.equal(result.ok, true);
      assert.equal(calls, 2);
      assert.match(readFileSync(join(rawDir, '11.failures.jsonl'), 'utf8'), /upstream error\/refusal/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exhausts retries for provider errors without accepting a placeholder score', async () => {
    const dir = makeTmp();
    try {
      const rawDir = join(dir, 'raw');
      const tmpDir = join(dir, 'tmp');
      mkdirSync(tmpDir, { recursive: true });
      let calls = 0;
      const executor: CodexExecutor = async () => {
        calls += 1;
        return { exitCode: 0, stdout: '', stderr: '', rawText: 'Provider error: requested model is unavailable' };
      };
      const result = await scoreOccupationWithRetries(
        { id: 12, text: '職業ID: 12' },
        'rubric',
        { cwd: dir, model: 'gpt-5.6-sol', outputSchemaPath: join(dir, 'schema.json'), tmpDir, rawDir },
        executor,
        async () => {},
      );
      assert.equal(result.ok, false);
      assert.equal(calls, 3);
      assert.equal(result.failures.length, 3);
      assert.match(result.failures[2]!.message, /upstream error\/refusal/);
      assert.equal(readFileSync(join(rawDir, '12.failures.jsonl'), 'utf8').trim().split('\n').length, 3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
