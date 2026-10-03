// In-process tests for runCodexCli (scripts/run-scoring-codex.ts) — runs under `bun test`.
// The scorer is injected, so no `codex` process is started, no model is called, and
// nothing is written to the repository `data/` or `.cache/`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

import { defaultCodexCliDeps, runCodexCli, type CodexCliDeps } from './run-scoring-codex.js';
import { loadOccupationExtracts } from './scoring-occupation.js';
import { runScoring } from './lib/scoring/core.js';
import { codexProvider } from './lib/scoring/providers/codex.js';

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

type RunScoringFn = CodexCliDeps['run'];
type RunCall = Parameters<RunScoringFn>;

const FAKE_OCCS: ReturnType<CodexCliDeps['loadOccupations']> = [];

const fakeResult = (failures: number): Awaited<ReturnType<RunScoringFn>> => ({
  scored: 3,
  failures: Array.from({ length: failures }, (_, i) => ({ ok: false as const, id: i + 1, attempts: 3, failures: [] })),
  pending: [],
  runDir: '/fake/run',
});

const harness = (run: RunScoringFn) => {
  const logs: string[] = [];
  const errors: string[] = [];
  const exitCodes: number[] = [];
  const calls: RunCall[] = [];
  const deps: CodexCliDeps = {
    root: '/fake/root',
    occDir: '/fake/root/data/occupations',
    loadOccupations: () => FAKE_OCCS,
    run: async (...call) => {
      calls.push(call);
      return run(...call);
    },
    log: (m) => void logs.push(m),
    error: (m) => void errors.push(m),
    exit: (code) => {
      throw new ExitSignal(code);
    },
    setExitCode: (code) => void exitCodes.push(code),
  };
  const go = async (argv: readonly string[]): Promise<number | null> => {
    try {
      await runCodexCli(argv, deps);
      return null;
    } catch (err) {
      if (err instanceof ExitSignal) return err.code;
      throw err;
    }
  };
  return { deps, logs, errors, exitCodes, calls, go };
};

describe('runCodexCli', () => {
  test('success: scores with the Codex provider and prints the assemble hint', async () => {
    const h = harness(async () => fakeResult(0));

    const exit = await h.go(['--prompt-file', 'p.md', '--out', '/tmp/x/raw.jsonl', '--run-name', 'r1']);

    assert.equal(exit, null);
    assert.deepEqual(h.exitCodes, []);
    assert.deepEqual(h.errors, []);
    assert.equal(h.calls.length, 1);
    const [args, provider, runDeps] = h.calls[0]!;
    assert.equal(provider, codexProvider);
    assert.equal(args.model, 'gpt-5.6-sol');
    assert.equal(args.provider, 'codex');
    assert.equal(args.promptFile, join('/fake/root', 'p.md'));
    assert.equal(args.outPath, '/tmp/x/raw.jsonl');
    assert.equal(args.runName, 'r1');
    assert.deepEqual(runDeps, { root: '/fake/root', occDir: '/fake/root/data/occupations', loadOccupations: runDeps.loadOccupations });
    assert.equal(runDeps.loadOccupations(runDeps.occDir), FAKE_OCCS);
    assert.deepEqual(h.logs, [
      '  next: bun run assemble:scores --mode aiois --model gpt-5.6-sol --date <YYYY-MM-DD> ' +
        '--prompt-version AIOIS-10-v1.0-gpt-5.6-sol --prompt-file /fake/root/p.md --in /tmp/x/raw.jsonl ' +
        '--out data/scores/occupations_gpt-5.6-sol_<date>.json',
    ]);
  });

  test('--model flows into the hint', async () => {
    const h = harness(async () => fakeResult(0));

    await h.go(['--prompt-file', 'p.md', '--model', 'gpt-6.1-sol', '--out', '/tmp/x/raw.jsonl', '--run-name', 'r']);

    assert.match(h.logs[0] ?? '', /--model gpt-6\.1-sol .*--prompt-version AIOIS-10-v1\.0-gpt-6\.1-sol .*occupations_gpt-6\.1-sol_<date>\.json$/);
  });

  test('some occupations failed: exit code 1 is set but the hint is still printed', async () => {
    const h = harness(async () => fakeResult(2));

    const exit = await h.go(['--prompt-file', 'p.md', '--run-name', 'r']);

    assert.equal(exit, null);
    assert.deepEqual(h.exitCodes, [1]);
    assert.equal(h.logs.length, 1);
    assert.match(h.logs[0] ?? '', /^ {2}next: bun run assemble:scores /);
  });

  test('argument errors fail before scoring starts', async () => {
    const h = harness(async () => fakeResult(0));

    const exit = await h.go([]);

    assert.equal(exit, 1);
    assert.deepEqual(h.errors, ['[run-scoring-codex] FAIL — missing required --prompt-file <path>']);
    assert.equal(h.calls.length, 0);
    assert.deepEqual(h.logs, []);
  });

  test('invalid numeric flag is reported as a FAIL line', async () => {
    const h = harness(async () => fakeResult(0));

    const exit = await h.go(['--prompt-file', 'p.md', '--limit', '0']);

    assert.equal(exit, 1);
    assert.deepEqual(h.errors, ['[run-scoring-codex] FAIL — --limit must be a positive integer']);
  });

  test('a scorer error (e.g. prompt file not found) becomes a FAIL line and no hint', async () => {
    const h = harness(async () => {
      throw new Error('prompt file not found: /fake/root/p.md');
    });

    const exit = await h.go(['--prompt-file', 'p.md', '--run-name', 'r']);

    assert.equal(exit, 1);
    assert.deepEqual(h.errors, ['[run-scoring-codex] FAIL — prompt file not found: /fake/root/p.md']);
    assert.deepEqual(h.logs, []);
    assert.deepEqual(h.exitCodes, []);
  });
});

describe('defaultCodexCliDeps', () => {
  test('wires the real scorer, occupation loader and repo-relative data dir', () => {
    const deps = defaultCodexCliDeps();
    assert.equal(deps.run, runScoring);
    assert.equal(deps.loadOccupations, loadOccupationExtracts);
    assert.equal(deps.occDir, join(deps.root, 'data', 'occupations'));
  });

  test('log / error forward to the console', () => {
    const deps = defaultCodexCliDeps();
    const seen: string[] = [];
    const saved = { log: console.log, error: console.error };
    console.log = (m: string) => void seen.push(`log:${m}`);
    console.error = (m: string) => void seen.push(`error:${m}`);
    try {
      deps.log('a');
      deps.error('b');
    } finally {
      Object.assign(console, saved);
    }
    assert.deepEqual(seen, ['log:a', 'error:b']);
  });

  test('setExitCode sets process.exitCode; exit forwards to process.exit', () => {
    const deps = defaultCodexCliDeps();
    const savedCode = process.exitCode;
    const realExit = process.exit;
    let exited: number | undefined;
    process.exit = ((c?: number) => {
      exited = c;
      throw new ExitSignal(c ?? 0);
    }) as typeof process.exit;
    try {
      deps.setExitCode(7);
      assert.equal(process.exitCode, 7);
      assert.throws(() => deps.exit(1), ExitSignal);
    } finally {
      process.exit = realExit;
      process.exitCode = savedCode;
    }
    assert.equal(exited, 1);
  });
});
