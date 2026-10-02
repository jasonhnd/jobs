import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./aiois-drift-report.ts', import.meta.url));
const score = (risk = 5, confidence: number | null = 0.8) => ({
  ai_risk: risk, confidence,
  aiois: { d1: risk, d2: risk, d3: 5, d4: 5, d5: 5, d6: 5, d7: 5, d8: 5, d9: 5, d10: 5, displacement: 2 },
});
const batch = (scores: Record<string, unknown> = { '900001': score() }) => ({
  scorer: { model: 'fixture-model', scoring_method_id: 'aiois-semantic-judgment' },
  run: { run_date: '2026-01-01' }, scores,
});

function fixture(run: (dir: string, args: string[]) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'aiois-drift-cli-'));
  try {
    const base = join(dir, 'base.json');
    const cand = join(dir, 'cand.json');
    writeFileSync(base, JSON.stringify(batch()));
    writeFileSync(cand, JSON.stringify(batch()));
    run(dir, ['--baseline', base, '--candidate', cand, '--out', join(dir, 'nested', 'report.md')]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function cli(args: string[], cwd: string) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 15_000 });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function reject(args: string[], cwd: string, message: string): void {
  const result = cli(args, cwd);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), `[aiois-drift-report] FAIL — ${message}`);
}

describe('aiois drift CLI', () => {
  test('requires each path and rejects switches without values', () => {
    fixture((dir, args) => {
      reject([], dir, 'missing --baseline');
      reject(args.slice(0, 2), dir, 'missing --candidate');
      reject(args.slice(0, 4), dir, 'missing --out');
      reject(['--baseline'], dir, '--baseline needs a value');
      reject(['--baseline', '--candidate'], dir, '--baseline needs a value');
    });
  });

  test('validates metadata for either batch', () => {
    fixture((dir, args) => {
      for (const [name, label] of [['base.json', 'baseline'], ['cand.json', 'candidate']] as const) {
        for (const [value, message] of [
          [{ ...batch(), scores: undefined }, 'missing scores/run/scorer'],
          [{ ...batch(), run: {} }, 'missing scores/run/scorer'],
          [{ ...batch(), scorer: {} }, 'missing scores/run/scorer'],
          [{ ...batch(), scorer: { model: 'fixture-model' } }, 'missing or invalid scorer.scoring_method_id'],
          [{ ...batch(), scorer: { model: 'fixture-model', scoring_method_id: 'unknown' } }, 'missing or invalid scorer.scoring_method_id'],
          [batch({ '900001': { aiois: score().aiois } }), 'id 900001 lacks ai_risk'],
        ] as const) {
          writeFileSync(join(dir, name), JSON.stringify(value));
          reject(args, dir, `${label}: ${message}`);
        }
        writeFileSync(join(dir, name), JSON.stringify(batch()));
      }
    });
  });

  test('writes a nested report and preserves the exact stdout summary', () => {
    fixture((dir, args) => {
      writeFileSync(join(dir, 'base.json'), JSON.stringify(batch({ '900001': score(), '900002': { ai_risk: 9, aiois: null } })));
      writeFileSync(join(dir, 'cand.json'), JSON.stringify(batch({ '900001': score(7, null), '900003': score(1) })));
      const result = cli(['ignored-positional', ...args], dir);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.equal(result.stdout,
        `[aiois-drift-report] OK → ${join(dir, 'nested', 'report.md')}\n` +
        '  compared=1  meanΔT=+2.00 (|2.00|)  meanΔD=+0.00 (|0.00|)\n' +
        '  band crossings=1  manual review=1 (rank≥10)\n');
      const md = readFileSync(join(dir, 'nested', 'report.md'), 'utf8');
      assert.ok(md.includes('| 900001 | (id 900001) | 5.0 → 7.0 (+2.00) | 2.0 → 2.0 (+0.00) | mid→high | 1→1 | – | T-drift≥1.5, band:mid→high |'));
      assert.equal(md.includes('| 900002 |'), false);
      assert.equal(md.includes('| 900003 |'), false);
    });
  });

  test('defaults the rank threshold at the 100-common-id boundary', () => {
    fixture((dir, args) => {
      for (const count of [99, 100]) {
        const scores = Object.fromEntries(Array.from({ length: count }, (_, k) => [900001 + k, score()]));
        writeFileSync(join(dir, 'base.json'), JSON.stringify(batch(scores)));
        writeFileSync(join(dir, 'cand.json'), JSON.stringify(batch({ ...scores, '999999': score() })));
        const result = cli(args, dir);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(result.stdout.includes(`compared=${count}`));
        assert.ok(result.stdout.endsWith(`(rank≥${count === 99 ? 10 : 50})\n`));
      }
    });
  });

  test('honors rank and confidence overrides and compares legacy entries as an empty set', () => {
    fixture((dir, args) => {
      writeFileSync(join(dir, 'cand.json'), JSON.stringify(batch({ '900001': score(5, 0.8) })));
      const result = cli([...args, '--rank-threshold', '0', '--low-confidence', '0.9'], dir);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.endsWith('manual review=1 (rank≥0)\n'));
      assert.ok(readFileSync(join(dir, 'nested', 'report.md'), 'utf8').includes('rank-shift≥0, low-confidence<0.9'));
      writeFileSync(join(dir, 'cand.json'), JSON.stringify(batch({ '900001': { ai_risk: 5 } })));
      const empty = cli(args, dir);
      assert.equal(empty.status, 0, empty.stderr);
      assert.ok(empty.stdout.includes('compared=0'));
      assert.ok(empty.stdout.endsWith('band crossings=0  manual review=0 (rank≥10)\n'));
    });
  });
});
