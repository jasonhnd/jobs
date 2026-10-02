// runScoring coverage. The provider is an in-memory double: no model, no codex
// binary, and every file lands under a temp directory.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreToJsonLine } from './contract.js';
import {
  parseArgs,
  runScoring,
  type ScoringArgs,
} from './core.js';
import type { ScoringProvider } from './provider.js';
import type { OccExtract } from '../../scoring-occupation.js';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

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

const validScore = (id: number) => ({
  id,
  ai_risk: 4.6,
  rationale_ja: 'coverage fixture',
  confidence: 0.8,
  aiois: AIOIS,
});

const occ = (id: number): OccExtract => ({ id, text: `occupation ${id}` });

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'scoring-core-run-'));

const outsideRepo = (path: string): void => {
  const rel = relative(REPO, path);
  assert.ok(rel.startsWith('..'), `${path} must stay outside the repo`);
};

const scoringArgs = (root: string, over: Partial<ScoringArgs> = {}): ScoringArgs => ({
  provider: 'fake',
  promptFile: join(root, 'prompt.md'),
  outPath: join(root, 'out.jsonl'),
  model: 'fake-model',
  limit: null,
  ids: null,
  resume: false,
  concurrency: 2,
  runName: 'job0064',
  providerOptions: Object.freeze({ source: 'test' }),
  ...over,
});

const writePrompt = (root: string): void => {
  writeFileSync(join(root, 'prompt.md'), 'rubric\n', 'utf8');
};

interface Logs {
  log: string[];
  err: string[];
}

const collectingDeps = (root: string, occs: readonly OccExtract[], logs?: Logs) => ({
  root,
  occDir: join(root, 'occs'),
  loadOccupations: () => [...occs],
  ...(logs
    ? {
        log: (message: string) => logs.log.push(message),
        logError: (message: string) => logs.err.push(message),
      }
    : {}),
});

const fakeProvider = (over: Partial<ScoringProvider> = {}): ScoringProvider => ({
  name: 'fake',
  description: 'in-memory provider double',
  supportsNativeSchema: false,
  maxConcurrency: 4,
  deterministic: true,
  preflight() {},
  prepareRun() {
    return { audit: { stub: true } };
  },
  ask: async (_prompt, options) => ({
    exitCode: 0,
    stdout: '',
    stderr: '',
    rawText: JSON.stringify(validScore(options.occId ?? 0)),
  }),
  ...over,
});

describe('parseArgs required flags', () => {
  test('rejects a missing provider, a missing model, and a non-integer', () => {
    assert.throws(() => parseArgs(['--prompt-file', 'p.md'], '/repo'), /missing required --provider/);
    assert.throws(
      () => parseArgs(['--prompt-file', 'p.md', '--provider', '--model', 'm'], '/repo'),
      /missing required --provider/,
    );
    assert.throws(
      () => parseArgs(['--prompt-file', 'p.md', '--provider', 'fake'], '/repo'),
      /missing required --model/,
    );
    assert.throws(
      () => parseArgs(['--prompt-file', 'p.md', '--provider', 'fake', '--model', 'm', '--limit', '0'], '/repo'),
      /--limit must be a positive integer/,
    );
    assert.throws(
      () => parseArgs(['--prompt-file', 'p.md', '--provider', 'fake', '--model', 'm', '--ids', '01'], '/repo'),
      /--ids must be a positive integer/,
    );
    assert.throws(
      () => parseArgs(['--prompt-file', 'p.md', '--provider', 'fake', '--model', 'm', '--concurrency', 'true'], '/repo'),
      /--concurrency must be a positive integer/,
    );
  });
});

describe('runScoring', () => {
  test('refuses a missing prompt before creating a run directory or touching the output', async () => {
    const root = makeTmp();
    try {
      const args = scoringArgs(root);
      writeFileSync(args.outPath, 'KEEP', 'utf8');
      await assert.rejects(
        () => runScoring(args, fakeProvider(), collectingDeps(root, [occ(1)])),
        /prompt file not found/,
      );
      assert.equal(readFileSync(args.outPath, 'utf8'), 'KEEP');
      assert.equal(existsSync(join(root, '.cache')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a failed preflight does not truncate an existing output file', async () => {
    const root = makeTmp();
    try {
      writePrompt(root);
      const args = scoringArgs(root);
      writeFileSync(args.outPath, 'KEEP', 'utf8');
      const provider = fakeProvider({
        preflight() {
          throw new Error('probe failed');
        },
      });
      await assert.rejects(
        () => runScoring(args, provider, collectingDeps(root, [occ(1)])),
        /probe failed/,
      );
      assert.equal(readFileSync(args.outPath, 'utf8'), 'KEEP');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('throws when every occupation is filtered out and keeps the output file', async () => {
    const root = makeTmp();
    try {
      writePrompt(root);
      const args = scoringArgs(root, { ids: [34], resume: true });
      writeFileSync(args.outPath, 'KEEP', 'utf8');
      await assert.rejects(
        () => runScoring(args, fakeProvider(), collectingDeps(root, [occ(1)])),
        /no occupations to score/,
      );
      assert.equal(readFileSync(args.outPath, 'utf8'), 'KEEP');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('scores pending occupations into a temp JSONL and writes the audit trail', async () => {
    const root = makeTmp();
    const logs: Logs = { log: [], err: [] };
    try {
      writePrompt(root);
      const args = scoringArgs(root, { concurrency: 8 });
      const provider = fakeProvider({
        maxConcurrency: 1,
        ask: async (_prompt, options) => {
          if (options.occId === 1) writeFileSync(options.outputLastMessagePath, 'last-message', 'utf8');
          else mkdirSync(options.outputLastMessagePath);
          return {
            exitCode: 0,
            stdout: '',
            stderr: '',
            rawText: JSON.stringify(validScore(options.occId ?? 0)),
          };
        },
      });
      const result = await runScoring(args, provider, collectingDeps(root, [occ(1), occ(2)], logs));
      outsideRepo(result.runDir);
      outsideRepo(args.outPath);
      assert.equal(result.scored, 2);
      assert.deepEqual(result.failures, []);
      assert.deepEqual(result.pending, []);
      const lines = readFileSync(args.outPath, 'utf8').trim().split('\n');
      assert.deepEqual(
        lines.map((line) => JSON.parse(line) as { id: number }).map((row) => row.id).sort((a, b) => a - b),
        [1, 2],
      );
      assert.equal(lines[0], scoreToJsonLine(validScore(JSON.parse(lines[0]!).id as number)));
      const audit = JSON.parse(readFileSync(join(result.runDir, 'provider-preflight.json'), 'utf8')) as {
        provider: string;
        stub: boolean;
        explicit_model_flag: boolean;
      };
      assert.equal(audit.provider, 'fake');
      assert.equal(audit.stub, true);
      assert.equal(audit.explicit_model_flag, true);
      assert.match(readFileSync(join(result.runDir, 'raw', '1.txt'), 'utf8'), /coverage fixture/);
      assert.match(logs.log.join('\n'), /concurrency=1/);
      assert.match(logs.log.join('\n'), /2 scored/);
      assert.equal(logs.err.length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('resume appends only new ids and ignores a corrupt line', async () => {
    const root = makeTmp();
    const logs: Logs = { log: [], err: [] };
    try {
      writePrompt(root);
      const args = scoringArgs(root, { resume: true });
      const existing = scoreToJsonLine(validScore(1));
      writeFileSync(args.outPath, `\nnot-json\n${existing}\n`, 'utf8');
      const result = await runScoring(args, fakeProvider(), collectingDeps(root, [occ(1), occ(2)], logs));
      assert.equal(result.scored, 1);
      assert.deepEqual(result.pending, []);
      const lines = readFileSync(args.outPath, 'utf8').trim().split('\n').filter((line) => line !== 'not-json');
      assert.deepEqual(
        lines.map((line) => (JSON.parse(line) as { id: number }).id),
        [1, 2],
      );
      assert.match(logs.log.join('\n'), /resume: skipping 1 completed/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('resume with no output file scores every occupation', async () => {
    const root = makeTmp();
    const logs: Logs = { log: [], err: [] };
    try {
      writePrompt(root);
      const args = scoringArgs(root, { resume: true });
      const result = await runScoring(args, fakeProvider(), collectingDeps(root, [occ(7)], logs));
      assert.equal(result.scored, 1);
      assert.match(readFileSync(args.outPath, 'utf8'), /"id":7/);
      assert.equal(logs.log.some((line) => line.includes('resume: skipping')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a fresh run truncates an existing output file before appending', async () => {
    const root = makeTmp();
    const logs: Logs = { log: [], err: [] };
    try {
      writePrompt(root);
      const args = scoringArgs(root, { resume: false });
      writeFileSync(args.outPath, 'OLD\n', 'utf8');
      await runScoring(args, fakeProvider(), collectingDeps(root, [occ(1)], logs));
      const text = readFileSync(args.outPath, 'utf8');
      assert.equal(text.startsWith('OLD'), false);
      assert.match(text, /"id":1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('uses the default console loggers when the caller does not pass any', async () => {
    const root = makeTmp();
    const logged: string[] = [];
    const errors: string[] = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = ((message?: unknown) => {
      logged.push(String(message));
    }) as typeof console.log;
    console.error = ((message?: unknown) => {
      errors.push(String(message));
    }) as typeof console.error;
    try {
      writePrompt(root);
      const result = await runScoring(scoringArgs(root), fakeProvider(), collectingDeps(root, [occ(1)]));
      assert.equal(result.scored, 1);
      assert.match(logged.join('\n'), /ok id=1/);
      assert.equal(errors.length, 0);
    } finally {
      console.log = origLog;
      console.error = origErr;
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('reports provider failures and caps the per-id detail at 20 lines', async () => {
    const root = makeTmp();
    const logs: Logs = { log: [], err: [] };
    try {
      writePrompt(root);
      const occs = Array.from({ length: 21 }, (_, i) => occ(i + 1));
      const provider = fakeProvider({
        deterministic: true,
        maxConcurrency: 4,
        classifyError: () => 'contract_violation',
        ask: async () => ({ exitCode: 1, stdout: '', stderr: 'schema mismatch', rawText: '' }),
      });
      const result = await runScoring(scoringArgs(root), provider, collectingDeps(root, occs, logs));
      assert.equal(result.scored, 0);
      assert.equal(result.pending.length, 0);
      assert.equal(result.failures.length, 21);
      const failureFile = readFileSync(join(result.runDir, 'raw', '1.failures.jsonl'), 'utf8');
      assert.match(failureFile, /contract_violation/);
      const summary = logs.err.find((line) => line.startsWith('  failures '));
      assert.ok(summary);
      assert.match(summary!, /failures 21: 1, 2, 3,/);
      const details = logs.err.filter((line) => line.startsWith('    id='));
      assert.equal(details.length, 20);
      assert.match(logs.err.join('\n'), /\[contract_violation\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('classifies a non-zero exit with the shared vocabulary when the provider does not', async () => {
    const root = makeTmp();
    const logs: Logs = { log: [], err: [] };
    try {
      writePrompt(root);
      const provider = fakeProvider({
        classifyError: undefined,
        ask: async () => ({ exitCode: 2, stdout: 'fallback stdout', stderr: '', rawText: 'raw-body' }),
      });
      const result = await runScoring(scoringArgs(root), provider, collectingDeps(root, [occ(3)], logs));
      assert.equal(result.scored, 0);
      assert.equal(result.failures.length, 1);
      assert.equal(result.failures[0]?.id, 3);
      assert.match(logs.err.join('\n'), /provider exit 2: fallback stdout/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('lists pending ids when the provider is still waiting for an answer', async () => {
    const root = makeTmp();
    const logs: Logs = { log: [], err: [] };
    try {
      writePrompt(root);
      const occs = Array.from({ length: 21 }, (_, i) => occ(i + 1));
      const provider = fakeProvider({
        classifyError: () => 'missing_answer',
        ask: async () => ({ exitCode: 1, stdout: '', stderr: 'waiting', rawText: '' }),
      });
      const result = await runScoring(scoringArgs(root, { concurrency: 4 }), provider, collectingDeps(root, occs, logs));
      assert.equal(result.scored, 0);
      assert.equal(result.failures.length, 0);
      assert.equal(result.pending.length, 21);
      assert.match(logs.log.join('\n'), /pending 21 awaiting answers: .* …/);
      assert.equal(logs.err.length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
