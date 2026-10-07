import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SCORES_DIR = join(ROOT, 'data', 'scores');

class ExitError extends Error {
  constructor(readonly code: number | undefined) {
    super(`exit ${code}`);
  }
}

const CLI_PATH = join(import.meta.dir, 'check-score-batch.ts');
let tmp: string;
let out: string[];
let exitSpy: ReturnType<typeof spyOn>;
let logSpy: ReturnType<typeof spyOn>;
let errSpy: ReturnType<typeof spyOn>;
const originalArgv = process.argv;

/** Runs the CLI in-process (it executes at import time); returns the exit code (0 when it falls off the end). */
async function runCli(...args: string[]): Promise<number> {
  process.argv = ['bun', 'check-score-batch.ts', ...args];
  try {
    delete require.cache[CLI_PATH];
    await import('./check-score-batch.ts');
    return 0;
  } catch (err) {
    if (err instanceof ExitError) return err.code ?? 0;
    throw err;
  }
}

function realBatch(): Record<string, any> {
  const name = readdirSync(SCORES_DIR).filter((f) => f.startsWith('occupations_') && f.endsWith('.json')).sort().at(-1)!;
  return JSON.parse(readFileSync(join(SCORES_DIR, name), 'utf8'));
}

function writeBatch(mutate: (b: Record<string, any>) => void, name = 'candidate.json'): string {
  const batch = realBatch();
  mutate(batch);
  const path = join(tmp, name);
  writeFileSync(path, JSON.stringify(batch));
  return path;
}

const output = () => out.join('\n');

describe('check-score-batch CLI', () => {
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'csb-'));
    out = [];
    exitSpy = spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new ExitError(code);
    }) as never);
    logSpy = spyOn(console, 'log').mockImplementation((...a: unknown[]) => { out.push(a.join(' ')); });
    errSpy = spyOn(console, 'error').mockImplementation((...a: unknown[]) => { out.push(a.join(' ')); });
  });
  afterEach(() => {
    process.argv = originalArgv;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
    rmSync(tmp, { recursive: true, force: true });
  });

  test('fails with usage when no file is given', async () => {
    expect(await runCli()).toBe(1);
    expect(output()).toContain('no file given');
  });

  test('fails when the file does not exist', async () => {
    expect(await runCli(join(tmp, 'nope.json'))).toBe(1);
    expect(output()).toContain('file not found');
  });

  test('fails on invalid JSON', async () => {
    const p = join(tmp, 'bad.json');
    writeFileSync(p, '{not json');
    expect(await runCli(p)).toBe(1);
    expect(output()).toContain('not valid JSON');
  });

  test('fails and lists issues when the schema does not match', async () => {
    const p = join(tmp, 'schema.json');
    writeFileSync(p, JSON.stringify({ scope: 'occupations' }));
    expect(await runCli(p)).toBe(1);
    expect(output()).toContain('does not match ScoreRunSchema');
  });

  test('warns when run_date is not newer than existing batches', async () => {
    const p = writeBatch((b) => { b.run.run_date = '2000-01-01'; });
    expect(await runCli(p)).toBe(0);
    expect(output()).toContain('is NOT newer than existing max');
  });

  test('reports missing coverage', async () => {
    const p = writeBatch((b) => {
      const ids = Object.keys(b.scores);
      delete b.scores[ids[0]!];
    });
    expect(await runCli(p)).toBe(0);
    expect(output()).toMatch(/missing \d+:/);
  });

  test('fails on scored ids that have no occupation file', async () => {
    const p = writeBatch((b) => {
      const ids = Object.keys(b.scores);
      b.scores['99999999'] = b.scores[ids[0]!];
    });
    expect(await runCli(p)).toBe(1);
    expect(output()).toContain('FAIL — 1 scored id(s) have no occupation file: 99999999');
  });

  test('fails on an empty scores map', async () => {
    const p = writeBatch((b) => { b.scores = {}; });
    expect(await runCli(p)).toBe(1);
    expect(output()).toContain('FAIL — scores is empty');
    expect(output()).not.toContain('NaN');
  });

  for (const runDate of ['not-a-date', '2026-10-7', '2026-02-30', '2999-99-99']) {
    test(`fails on a run_date that is not a real YYYY-MM-DD date (${runDate})`, async () => {
      const p = writeBatch((b) => { b.run.run_date = runDate; });
      expect(await runCli(p)).toBe(1);
      expect(output()).toContain(`FAIL — run.run_date must be a real YYYY-MM-DD date, got "${runDate}"`);
      expect(output()).not.toContain('newer than all');
    });
  }

  test('marks a backfill batch and skips the freshness comparison', async () => {
    const p = writeBatch((b) => { b.run.backfill = true; });
    expect(await runCli(p)).toBe(0);
    const o = output();
    expect(o).toContain('backfill: true');
    expect(o).toContain('n/a — backfill batch');
  });

  test('warns about a vendor outside the whitelist', async () => {
    const p = writeBatch((b) => { b.scorer.model_provider = 'unlisted-vendor'; });
    expect(await runCli(p)).toBe(0);
    expect(output()).toContain('is not in VENDOR_WHITELIST');
  });

  test('skips coverage and drift for a non-occupations scope', async () => {
    const p = writeBatch((b) => { b.scope = 'tasks'; });
    expect(await runCli(p)).toBe(0);
    expect(output()).toContain('skipping occupation coverage/drift');
  });

  // Keep this last: bun's coverage only attributes the last evaluation of the module, so the
  // longest code path should be the one that runs last.
  test('reports a full run for a newer occupations batch', async () => {
    const p = writeBatch((b) => { b.run.run_date = '2099-01-01'; });
    expect(await runCli(p)).toBe(0);
    const o = output();
    expect(o).toContain('schema OK');
    expect(o).toContain('[coverage]');
    expect(o).toContain('OK — run_date 2099-01-01 is newer');
    expect(o).toContain('[drift vs current latest]');
    expect(o).toContain('done — schema valid');
  });
});
