// CLI tests for scripts/assemble-scores.ts — runs under `bun test`.
// Everything happens in a temporary directory: the repository `data/` (append-only
// score batches) is never read or written.
import { afterEach, beforeEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assembleBatch,
  defaultAssembleEnv,
  runAssembleCli,
  type AssembleCliEnv,
  type BatchMeta,
} from './assemble-scores.js';
import { ScoreRunSchema } from '../src/data/schema/score-run.js';

const AIOIS_LINE = (id: number): string =>
  JSON.stringify({
    id,
    ai_risk: 4.6,
    rationale_ja: '理由',
    confidence: 0.8,
    aiois: {
      d1: 4.8, d2: 4.4, d3: 5.0, d4: 6.5, d5: 5.8, d6: 3.0, d7: 4.2, d8: 3.6, d9: 2.8, d10: 3.5,
      transformation: 4.6, displacement: 1.7,
    },
  });
const LEGACY_LINE = (id: number): string => JSON.stringify({ id, ai_risk: 3.0, rationale_ja: 'x' });

const META: BatchMeta = {
  model: 'claude-opus-4-8',
  modelProvider: 'anthropic',
  date: '2026-06-01',
  promptVersion: '2.0',
  promptFile: 'data/prompts/x.ja.md',
  runId: 'occ_2026-06-01_v1',
  operator: null,
  inputDataVersion: 'occupations_2026-06',
  inputDataSha256: 'abc',
  promptSha256: 'def',
  anchors: { '0-1': 'carried-min', '10': 'carried-max' },
  caveat: 'carried caveat',
  occupationCountScored: 1,
  occupationCountSkipped: 0,
  scoringMethod: 'single-pass per occupation',
  scoringMethodId: 'legacy-single-axis',
};

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

interface Harness {
  readonly root: string;
  readonly occDir: string;
  readonly scoresDir: string;
  /** Run the CLI; resolves the captured output and the exit code (null = returned normally). */
  readonly run: (argv: readonly string[]) => { logs: string[]; errors: string[]; warns: string[]; exitCode: number | null };
  readonly path: (name: string) => string;
  readonly write: (name: string, text: string) => string;
}

let tmp = '';

const makeHarness = (occIds: readonly number[]): Harness => {
  const root = join(tmp, 'repo');
  const occDir = join(root, 'data', 'occupations');
  const scoresDir = join(root, 'data', 'scores');
  mkdirSync(occDir, { recursive: true });
  mkdirSync(scoresDir, { recursive: true });
  occIds.forEach((id) => writeFileSync(join(occDir, `${String(id).padStart(4, '0')}.json`), `{"id":${id}}\n`));
  writeFileSync(join(occDir, 'README.txt'), 'not an occupation');
  writeFileSync(join(occDir, 'notanumber.json'), '{}');
  const path = (name: string): string => join(tmp, name);
  return {
    root,
    occDir,
    scoresDir,
    path,
    write: (name, text) => {
      writeFileSync(path(name), text);
      return path(name);
    },
    run: (argv) => {
      const logs: string[] = [];
      const errors: string[] = [];
      const warns: string[] = [];
      const env: AssembleCliEnv = {
        root,
        occDir,
        scoresDir,
        log: (m) => void logs.push(m),
        error: (m) => void errors.push(m),
        warn: (m) => void warns.push(m),
        exit: (code) => {
          throw new ExitSignal(code);
        },
      };
      try {
        runAssembleCli(argv, env);
        return { logs, errors, warns, exitCode: null };
      } catch (err) {
        if (err instanceof ExitSignal) return { logs, errors, warns, exitCode: err.code };
        throw err;
      }
    },
  };
};

const writeBatch = (h: Harness, file: string, patch: Record<string, unknown>): void => {
  const batch = assembleBatch({ '1': { ai_risk: 3, rationale_ja: 'x', confidence: null } }, META) as Record<string, unknown>;
  const merged = { ...batch, ...patch };
  writeFileSync(join(h.scoresDir, file), JSON.stringify(merged));
};

const baseArgs = (h: Harness, extra: readonly string[] = []): string[] => [
  '--mode', 'aiois',
  '--model', 'gpt-6.1-sol',
  '--date', '2026-10-02',
  '--prompt-version', 'v1',
  '--in', h.path('in.jsonl'),
  '--out', h.path('out.json'),
  ...extra,
];

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'assemble-scores-cli-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('runAssembleCli — success', () => {
  test('aiois mode writes a schema-valid batch, carries anchors/caveat from the latest batch, and reports', () => {
    const h = makeHarness([1, 2, 3]);
    writeBatch(h, 'old.json', { anchors: { old: 'old' }, caveat: 'old caveat' });
    writeBatch(h, 'latest.json', { run: { ...META_RUN('2026-09-01') } });
    h.write('in.jsonl', `${AIOIS_LINE(1)}\n${AIOIS_LINE(2)}\n\n`);

    const res = h.run(baseArgs(h));

    assert.equal(res.exitCode, null);
    assert.deepEqual(res.errors, []);
    assert.deepEqual(res.warns, []);
    const written = JSON.parse(readFileSync(h.path('out.json'), 'utf8'));
    assert.equal(ScoreRunSchema.safeParse(written).success, true);
    assert.equal(written.scorer.model, 'gpt-6.1-sol');
    assert.equal(written.scorer.model_provider, 'openai');
    assert.equal(written.scorer.scoring_method_id, 'aiois-semantic-judgment');
    assert.match(written.scorer.scoring_method, /^AIOIS-10 v1\.0/);
    assert.equal(written.run.run_id, 'occ_2026-10-02_v1');
    assert.equal(written.run.operator, null);
    assert.equal(written.run.backfill, undefined);
    assert.equal(written.input.input_data_version, 'occupations_2026-10-02');
    assert.equal(written.input.occupation_count_scored, 2);
    assert.equal(written.input.occupation_count_skipped, 1);
    assert.equal(written.prompt.prompt_file, 'data/prompts/prompt.ja.md');
    assert.equal(written.prompt.prompt_sha256, null);
    assert.deepEqual(written.anchors, META.anchors);
    assert.equal(written.caveat, META.caveat);
    assert.ok(readFileSync(h.path('out.json'), 'utf8').endsWith('}\n'));
    assert.deepEqual(res.logs, [
      `[assemble-scores] OK → ${h.path('out.json')}`,
      '  scored 2/3; missing 1 (3)',
      `  next: bun run check:score-batch ${h.path('out.json')}`,
    ]);
  });

  test('input_data_sha256 hashes the occupation files in sorted order; prompt sha is computed when the file exists', () => {
    const h = makeHarness([2, 1]);
    writeBatch(h, 'b.json', {});
    h.write('in.jsonl', `${AIOIS_LINE(1)}\n${AIOIS_LINE(2)}\n`);
    mkdirSync(join(h.root, 'data', 'prompts'), { recursive: true });
    writeFileSync(join(h.root, 'data', 'prompts', 'p.ja.md'), 'rubric');

    const res = h.run(baseArgs(h, ['--prompt-file', 'data/prompts/p.ja.md']));

    assert.equal(res.exitCode, null);
    const written = JSON.parse(readFileSync(h.path('out.json'), 'utf8'));
    // *.json files only, sorted by name: 0001, 0002, notanumber (README.txt ignored).
    const sorted = createHash('sha256');
    ['0001.json', '0002.json', 'notanumber.json'].forEach((f) => sorted.update(readFileSync(join(h.occDir, f))));
    assert.equal(written.input.input_data_sha256, sorted.digest('hex'));
    assert.equal(written.prompt.prompt_sha256, createHash('sha256').update('rubric').digest('hex'));
    assert.equal(written.prompt.prompt_file, 'data/prompts/p.ja.md');
  });

  test('more than 10 missing occupations → list is truncated with an ellipsis', () => {
    const ids = Array.from({ length: 13 }, (_, i) => i + 1);
    const h = makeHarness(ids);
    writeBatch(h, 'b.json', {});
    h.write('in.jsonl', `${AIOIS_LINE(1)}\n`);

    const res = h.run(baseArgs(h));

    assert.equal(res.exitCode, null);
    assert.equal(res.logs[1], '  scored 1/13; missing 12 (2, 3, 4, 5, 6, 7, 8, 9, 10, 11 …)');
  });

  test('everything scored → no missing list', () => {
    const h = makeHarness([1]);
    writeBatch(h, 'b.json', {});
    h.write('in.jsonl', AIOIS_LINE(1));

    const res = h.run(baseArgs(h));

    assert.equal(res.logs[1], '  scored 1/1; missing 0');
  });

  test('--backfill true marks the batch, logs the history-only notice, and is skipped when carrying anchors', () => {
    const h = makeHarness([1]);
    writeBatch(h, 'normal.json', { anchors: { n: 'normal' }, caveat: 'normal caveat' });
    writeBatch(h, 'backfill.json', {
      run: { ...META_RUN('2026-12-31'), backfill: true },
      anchors: { b: 'backfill' },
      caveat: 'backfill caveat',
    });
    h.write('in.jsonl', AIOIS_LINE(1));

    const res = h.run(baseArgs(h, ['--backfill', 'true', '--provider', 'openai', '--operator', 'op', '--run-id', 'r9']));

    assert.equal(res.exitCode, null);
    const written = JSON.parse(readFileSync(h.path('out.json'), 'utf8'));
    assert.equal(written.run.backfill, true);
    assert.equal(written.run.operator, 'op');
    assert.equal(written.run.run_id, 'r9');
    assert.deepEqual(written.anchors, { n: 'normal' });
    assert.equal(written.caveat, 'normal caveat');
    assert.equal(res.logs[1], '[assemble-scores] backfill batch — history only; will not become the active run');
  });

  test('legacy mode defaults to the legacy method id and accepts confidence-less lines', () => {
    const h = makeHarness([1, 2]);
    writeBatch(h, 'b.json', {});
    h.write('in.jsonl', `${LEGACY_LINE(1)}\n${LEGACY_LINE(2)}\n`);

    const res = h.run(baseArgs(h).map((a) => (a === 'aiois' ? 'legacy' : a)));

    assert.equal(res.exitCode, null);
    const written = JSON.parse(readFileSync(h.path('out.json'), 'utf8'));
    assert.equal(written.scorer.scoring_method_id, 'legacy-single-axis');
    assert.equal(written.scorer.scoring_method, 'single-pass per occupation');
    assert.equal(written.scores['1'].confidence, null);
  });

  test('--anchors/--caveat files, --scoring-method, --input-data-version and --scoring-method-id override the defaults', () => {
    const h = makeHarness([1]);
    h.write('in.jsonl', AIOIS_LINE(1));
    h.write('anchors.json', JSON.stringify({ lo: 'low', hi: 'high' }));
    h.write('caveat.txt', '  explicit caveat  \n');

    const res = h.run(
      baseArgs(h, [
        '--anchors', h.path('anchors.json'),
        '--caveat', h.path('caveat.txt'),
        '--scoring-method', 'custom method',
        '--scoring-method-id', 'legacy-single-axis',
        '--input-data-version', 'v9',
      ]),
    );

    assert.equal(res.exitCode, null);
    const written = JSON.parse(readFileSync(h.path('out.json'), 'utf8'));
    assert.deepEqual(written.anchors, { lo: 'low', hi: 'high' });
    assert.equal(written.caveat, 'explicit caveat');
    assert.equal(written.scorer.scoring_method, 'custom method');
    assert.equal(written.scorer.scoring_method_id, 'legacy-single-axis');
    assert.equal(written.input.input_data_version, 'v9');
  });

  test('default --out is data/scores/occupations_<model>_<date>.json under the scores dir', () => {
    const h = makeHarness([1]);
    writeBatch(h, 'b.json', {});
    h.write('in.jsonl', AIOIS_LINE(1));

    const res = h.run(baseArgs(h).slice(0, -2));

    assert.equal(res.exitCode, null);
    assert.ok(existsSync(join(h.scoresDir, 'occupations_gpt-6.1-sol_2026-10-02.json')));
  });

  test('an unreadable batch in the scores dir only warns; carrying continues from the readable ones', () => {
    const h = makeHarness([1]);
    writeFileSync(join(h.scoresDir, 'broken.json'), '{not json');
    writeBatch(h, 'good.json', {});
    writeBatch(h, 'other-scope.json', { scope: 'something-else', anchors: { x: 'y' }, caveat: 'other' });
    h.write('in.jsonl', AIOIS_LINE(1));

    const res = h.run(baseArgs(h));

    assert.equal(res.exitCode, null);
    assert.deepEqual(res.warns, [
      '[assemble-scores] WARN — skipped unreadable batch broken.json; anchors/caveat cannot be inherited from it.',
    ]);
    assert.deepEqual(JSON.parse(readFileSync(h.path('out.json'), 'utf8')).anchors, META.anchors);
  });
});

describe('runAssembleCli — failures (never write, exit 1)', () => {
  const FAILURES: ReadonlyArray<{
    name: string;
    argv: (h: Harness) => string[];
    setup?: (h: Harness) => void;
    message: RegExp;
  }> = [
    { name: 'flag without a value', argv: () => ['--mode'], message: /--mode needs a value/ },
    { name: 'flag followed by another flag', argv: () => ['--mode', '--model'], message: /--mode needs a value/ },
    { name: 'missing --mode', argv: () => [], message: /missing --mode/ },
    { name: 'bad --mode', argv: (h) => baseArgs(h).map((a) => (a === 'aiois' ? 'foo' : a)), message: /--mode must be "aiois" or "legacy", got "foo"/ },
    { name: 'missing --date', argv: () => ['--mode', 'aiois', '--model', 'gpt-x'], message: /missing --date/ },
    ...['not-a-date', '2026-10-7', '2026-02-30', '2026-10-02T00:00:00Z'].map((date) => ({
      name: `--date ${date} is not a real YYYY-MM-DD date`,
      argv: (h: Harness) => baseArgs(h).map((a) => (a === '2026-10-02' ? date : a)),
      setup: (h: Harness) => h.write('in.jsonl', AIOIS_LINE(1)),
      message: /--date must be a real YYYY-MM-DD date/,
    })),
    {
      name: 'an input with no score lines',
      argv: (h) => baseArgs(h),
      setup: (h) => {
        writeBatch(h, 'b.json', {});
        h.write('in.jsonl', '\n\n');
      },
      message: /no scores in --in/,
    },
    { name: 'bad --backfill', argv: (h) => baseArgs(h, ['--backfill', 'maybe']), message: /--backfill must be "true" or "false", got "maybe"/ },
    { name: '--in not found', argv: (h) => baseArgs(h), message: /--in not found:/ },
    {
      name: '--out already exists (append-only)',
      argv: (h) => baseArgs(h),
      setup: (h) => {
        h.write('in.jsonl', AIOIS_LINE(1));
        h.write('out.json', 'KEEP');
      },
      message: /--out already exists \(append-only; never overwrite\):/,
    },
    {
      name: 'scored id without an occupation file',
      argv: (h) => baseArgs(h),
      setup: (h) => h.write('in.jsonl', `${AIOIS_LINE(1)}\n${AIOIS_LINE(77)}\n`),
      message: /1 scored id\(s\) have no occupation file: 77/,
    },
    {
      name: 'no anchors available',
      argv: (h) => baseArgs(h),
      setup: (h) => h.write('in.jsonl', AIOIS_LINE(1)),
      message: /no anchors \(pass --anchors or have an existing batch to carry from\)/,
    },
    {
      name: 'anchors but no caveat',
      argv: (h) => baseArgs(h, ['--anchors', h.path('anchors.json')]),
      setup: (h) => {
        h.write('in.jsonl', AIOIS_LINE(1));
        h.write('anchors.json', '{"a":"b"}');
      },
      message: /no caveat \(pass --caveat or have an existing batch to carry from\)/,
    },
    {
      name: 'unknown --scoring-method-id',
      argv: (h) => baseArgs(h, ['--scoring-method-id', 'nope']),
      setup: (h) => {
        writeBatch(h, 'b.json', {});
        h.write('in.jsonl', AIOIS_LINE(1));
      },
      message: /--scoring-method-id must be one of: .*aiois-semantic-judgment/,
    },
  ];

  for (const f of FAILURES) {
    test(f.name, () => {
      const h = makeHarness([1, 2]);
      f.setup?.(h);

      const res = h.run(f.argv(h));

      assert.equal(res.exitCode, 1);
      assert.match(res.errors[0] ?? '', /^\[assemble-scores\] FAIL — /);
      assert.match(res.errors.join('\n'), f.message);
      assert.deepEqual(res.logs, []);
      if (f.name.startsWith('--out already exists')) assert.equal(readFileSync(h.path('out.json'), 'utf8'), 'KEEP');
      else assert.equal(existsSync(h.path('out.json')), false);
    });
  }

  test('an --out created after the existence check is not overwritten (exclusive create)', () => {
    const h = makeHarness([1, 2]);
    writeBatch(h, 'b.json', {});
    writeFileSync(join(h.scoresDir, 'broken.json'), '{');
    h.write('in.jsonl', AIOIS_LINE(1));
    const errors: string[] = [];
    const env: AssembleCliEnv = {
      root: h.root,
      occDir: h.occDir,
      scoresDir: h.scoresDir,
      log: () => {},
      error: (m) => void errors.push(m),
      // Runs between the existence check and the write: another writer wins the race.
      warn: () => writeFileSync(h.path('out.json'), 'RACE'),
      exit: (code) => {
        throw new ExitSignal(code);
      },
    };
    assert.throws(() => runAssembleCli(baseArgs(h), env), (err: unknown) => err instanceof ExitSignal && err.code === 1);
    assert.match(errors.join('\n'), /--out already exists \(append-only; never overwrite\):/);
    assert.equal(readFileSync(h.path('out.json'), 'utf8'), 'RACE');
  });

  test('invalid input lines are reported (first 30 + a count of the rest) and nothing is written', () => {
    const h = makeHarness([1]);
    writeBatch(h, 'b.json', {});
    h.write('in.jsonl', `${Array.from({ length: 33 }, (_, i) => `garbage ${i}`).join('\n')}\n`);

    const res = h.run(baseArgs(h));

    assert.equal(res.exitCode, 1);
    assert.equal(res.errors[0], '[assemble-scores] FAIL — 33 input error(s):');
    assert.equal(res.errors.length, 1 + 30 + 1);
    assert.equal(res.errors[1], '  line 1: invalid JSON');
    assert.equal(res.errors[31], '  …and 3 more.');
    assert.equal(existsSync(h.path('out.json')), false);
  });

  test('few invalid lines → no "…and N more" line', () => {
    const h = makeHarness([1]);
    h.write('in.jsonl', 'garbage\n');

    const res = h.run(baseArgs(h));

    assert.deepEqual(res.errors, ['[assemble-scores] FAIL — 1 input error(s):', '  line 1: invalid JSON']);
  });

  test('legacy mode rejects aiois-bearing input rather than dropping the block', () => {
    const h = makeHarness([1]);
    h.write('in.jsonl', AIOIS_LINE(1));

    const res = h.run(baseArgs(h).map((a) => (a === 'aiois' ? 'legacy' : a)));

    assert.equal(res.exitCode, 1);
    assert.match(res.errors.join('\n'), /legacy mode would silently drop it/);
  });

  test('an assembled object that fails ScoreRunSchema is reported and not written', () => {
    const h = makeHarness([1]);
    h.write('in.jsonl', AIOIS_LINE(1));
    h.write('anchors.json', '{"a":1}');
    h.write('caveat.txt', 'c');

    const res = h.run(baseArgs(h, ['--anchors', h.path('anchors.json'), '--caveat', h.path('caveat.txt')]));

    assert.equal(res.exitCode, 1);
    assert.equal(res.errors[0], '[assemble-scores] FAIL — assembled object does not pass ScoreRunSchema:');
    assert.match(res.errors[1] ?? '', /^ {2}anchors\.a: /);
    assert.equal(existsSync(h.path('out.json')), false);
  });

  test('an unknown model prefix without --provider throws before anything is written', () => {
    const h = makeHarness([1]);
    h.write('in.jsonl', AIOIS_LINE(1));

    assert.throws(() => h.run(baseArgs(h).map((a) => (a === 'gpt-6.1-sol' ? 'mystery-1' : a))), /cannot infer model_provider/);
    assert.equal(existsSync(h.path('out.json')), false);
  });
});

describe('defaultAssembleEnv', () => {
  test('derives the data dirs from the given root', () => {
    const env = defaultAssembleEnv('/some/root');
    assert.equal(env.root, '/some/root');
    assert.equal(env.occDir, join('/some/root', 'data', 'occupations'));
    assert.equal(env.scoresDir, join('/some/root', 'data', 'scores'));
  });

  test('defaults to the repository root (the parent of scripts/)', () => {
    const env = defaultAssembleEnv();
    assert.equal(env.occDir, join(env.root, 'data', 'occupations'));
    assert.ok(existsSync(join(env.root, 'scripts', 'assemble-scores.ts')));
  });

  test('log / error / warn forward to the console', () => {
    const env = defaultAssembleEnv('/some/root');
    const seen: string[] = [];
    const saved = { log: console.log, error: console.error, warn: console.warn };
    console.log = (m: string) => void seen.push(`log:${m}`);
    console.error = (m: string) => void seen.push(`error:${m}`);
    console.warn = (m: string) => void seen.push(`warn:${m}`);
    try {
      env.log('a');
      env.error('b');
      env.warn('c');
    } finally {
      Object.assign(console, saved);
    }
    assert.deepEqual(seen, ['log:a', 'error:b', 'warn:c']);
  });

  test('exit forwards to process.exit', () => {
    const env = defaultAssembleEnv('/some/root');
    const realExit = process.exit;
    let code: number | undefined;
    process.exit = ((c?: number) => {
      code = c;
      throw new ExitSignal(c ?? 0);
    }) as typeof process.exit;
    try {
      assert.throws(() => env.exit(1), ExitSignal);
    } finally {
      process.exit = realExit;
    }
    assert.equal(code, 1);
  });
});

/** `run` block overriding only the date (keeps every other BatchMeta-derived field). */
function META_RUN(date: string): Record<string, unknown> {
  return { run_date: date, run_id: `occ_${date}_v1`, duration_minutes: null, operator: null };
}
