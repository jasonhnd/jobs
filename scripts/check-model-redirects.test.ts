import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../src/data/schema/index.js';
import { expectedRedirects, loadRedirects, loadScoreRuns, main } from './check-model-redirects.ts';

const ROOT = join(import.meta.dir, '..');

function realRun(): ScoreRun {
  const dir = join(ROOT, 'data', 'scores');
  const name = readdirSync(dir).filter((f) => f.startsWith('occupations_') && f.endsWith('.json')).sort()[0]!;
  return ScoreRunSchema.parse(JSON.parse(readFileSync(join(dir, name), 'utf-8')));
}

function withRun(base: ScoreRun, model: string, runDate: string, scope: ScoreRun['scope'] = 'occupations'): ScoreRun {
  return { ...base, scope, scorer: { ...base.scorer, model }, run: { ...base.run, run_date: runDate } } as ScoreRun;
}

class ExitError extends Error {}

describe('check-model-redirects', () => {
  let exitSpy: ReturnType<typeof spyOn>;
  let errSpy: ReturnType<typeof spyOn>;
  let logSpy: ReturnType<typeof spyOn>;
  const errors: string[] = [];

  beforeEach(() => {
    errors.length = 0;
    exitSpy = spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new ExitError(`exit ${code}`);
    }) as never);
    errSpy = spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a.join(' ')); });
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('main passes against the committed vercel.json and data/scores', () => {
    expect(() => main()).not.toThrow();
    expect(logSpy.mock.calls.flat().join('\n')).toContain('[check-model-redirects] OK');
  });

  test('loadScoreRuns and loadRedirects return parsed data', () => {
    expect(loadScoreRuns().length).toBeGreaterThan(0);
    expect(loadRedirects().some((r) => r.source.startsWith('/models/'))).toBe(true);
  });

  test('expectedRedirects maps each model to its newest run', () => {
    const base = realRun();
    const map = expectedRedirects([withRun(base, 'model-a', '2026-01-01'), withRun(base, 'model-a', '2026-02-02')]);
    expect(map.size).toBe(1);
    const [bare, target] = [...map.entries()][0]!;
    expect(bare.startsWith('/models/')).toBe(true);
    expect(target).toContain('2026-02-02');
  });

  test('expectedRedirects ignores non-occupation scopes and fails when nothing remains', () => {
    const base = realRun();
    expect(() => expectedRedirects([withRun(base, 'm', '2026-01-01', 'tasks')])).toThrow(ExitError);
    expect(errors.join('\n')).toContain('no occupations batches');
  });

  test('expectedRedirects fails on two models sharing a bare slug', () => {
    const base = realRun();
    const a = withRun(base, 'claude-foo-1', '2026-01-01');
    const b = withRun(base, 'foo-1', '2026-01-02');
    expect(() => expectedRedirects([a, b])).toThrow(ExitError);
    expect(errors.join('\n')).toContain('share the bare slug');
  });
});
