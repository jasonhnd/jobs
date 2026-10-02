import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const ROOT = resolve(import.meta.dir, '..');
const fixtures: string[] = [];
afterEach(() => {
  for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'jobs-script-fallbacks-'));
  fixtures.push(dir);
  mkdirSync(join(dir, 'scripts'));
  copyFileSync(join(ROOT, 'scripts', script), join(dir, 'scripts', script));
  return dir;
}

describe('assemble-scores fallback diagnostics', () => {
  test('warns for missing and malformed batches, inherits from latest valid non-backfill batch', () => {
    const dir = fixture('assemble-scores.ts');
    symlinkSync(join(ROOT, 'src'), join(dir, 'src'), 'dir');
    symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
    mkdirSync(join(dir, 'data', 'occupations'), { recursive: true });
    mkdirSync(join(dir, 'data', 'scores'));
    writeFileSync(join(dir, 'data', 'occupations', '1.json'), '{}');
    const scoresDir = join(dir, 'data', 'scores');
    const anchors = { '0-1': 'min', '10': 'max' };
    const old = { scope: 'occupations', run: { run_date: '2026-05-01' }, anchors, caveat: 'old' };
    writeFileSync(join(scoresDir, 'old.json'), JSON.stringify(old));
    writeFileSync(join(scoresDir, 'latest.json'), JSON.stringify({ ...old, run: { run_date: '2026-06-01' }, caveat: 'latest' }));
    writeFileSync(join(scoresDir, 'backfill.json'), JSON.stringify({ ...old, run: { run_date: '2026-07-01', backfill: true }, caveat: 'backfill' }));
    writeFileSync(join(scoresDir, 'broken.json'), '{invalid private fixture content');
    symlinkSync(join(dir, 'absent.json'), join(scoresDir, 'missing.json'));
    writeFileSync(join(dir, 'input.jsonl'), '{"id":1,"ai_risk":5,"rationale_ja":"fixture"}\n');
    const out = join(dir, 'out.json');
    const result = spawnSync('bun', [join(dir, 'scripts', 'assemble-scores.ts'), '--mode', 'legacy', '--model', 'gpt-6.1-sol', '--date', '2026-08-01', '--prompt-version', '2.0', '--in', join(dir, 'input.jsonl'), '--out', out], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /WARN.*skipped unreadable batch broken\.json/);
    assert.match(result.stderr, /WARN.*skipped unreadable batch missing\.json/);
    assert.doesNotMatch(result.stderr, /private fixture content/);
    const batch = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(batch.anchors, anchors);
    assert.equal(batch.caveat, 'latest');
  });
});

describe('analytics guard middleware read failures', () => {
  function analyticsFixture(): string {
    const dir = fixture('check-analytics-config.cjs');
    mkdirSync(join(dir, 'src', 'layouts'), { recursive: true });
    for (const file of ['vercel.json', '.env.example', 'middleware.ts', 'src/layouts/BaseLayout.astro']) {
      copyFileSync(join(ROOT, file), join(dir, file));
    }
    return dir;
  }
  test('valid configuration passes and a missing middleware fails explicitly', () => {
    const dir = analyticsFixture();
    const script = join(dir, 'scripts', 'check-analytics-config.cjs');
    const valid = spawnSync('node', [script], { encoding: 'utf8' });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /\[check-analytics-config\] OK/);
    rmSync(join(dir, 'middleware.ts'));
    const missing = spawnSync('node', [script], { encoding: 'utf8' });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Cannot read required middleware\.ts for server env checks \(ENOENT\)/);
    assert.doesNotMatch(missing.stdout, /OK/);
  });
  test('Step D fails if middleware becomes unreadable after Step C', () => {
    const dir = analyticsFixture();
    let reads = 0;
    const errors: string[] = [];
    const exit = new Error('exit');
    assert.throws(() => runInNewContext(readFileSync(join(dir, 'scripts', 'check-analytics-config.cjs'), 'utf8'), {
      __dirname: join(dir, 'scripts'),
      require: (name: string) => name === 'node:fs' ? {
        readFileSync: (file: string, encoding: BufferEncoding) => {
          if (file.endsWith('middleware.ts') && ++reads === 2) throw Object.assign(new Error('private diagnostic'), { code: 'EACCES' });
          return readFileSync(file, encoding);
        },
      } : require(name),
      console: { error: (msg: string) => errors.push(msg), log: () => assert.fail('must not report success') },
      process: { exit: (code: number) => { assert.equal(code, 1); throw exit; } },
    }), (err: unknown) => err === exit);
    assert.match(errors.join('\n'), /Cannot read required middleware\.ts.*EACCES/);
    assert.doesNotMatch(errors.join('\n'), /private diagnostic/);
  });
});

describe('e2e header fallback diagnostics', () => {
  for (const mode of ['missing', 'malformed', 'valid'] as const) {
    test(`${mode} configuration has explicit fallback diagnostics or preserves headers`, () => {
      const dir = fixture('e2e-server.cjs');
      if (mode !== 'missing') writeFileSync(join(dir, 'vercel.json'), mode === 'malformed' ? '{private malformed content' : JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'X-Fixture', value: 'preserved' }] }] }));
      const warnings: string[] = [];
      const headers = runInNewContext(`${readFileSync(join(dir, 'scripts', 'e2e-server.cjs'), 'utf8')}\nheadersForRequest({url: '/', headers: {host: 'localhost'}});`, {
        __dirname: join(dir, 'scripts'),
        require: (name: string) => name === 'node:http' ? { createServer: () => ({ listen: () => {} }) } : name === 'node:fs' ? fs : require(name),
        URL,
        process: { env: {} },
        console: { warn: (msg: string) => warnings.push(msg), log: () => {} },
      });
      if (mode === 'valid') {
        assert.equal(warnings.length, 0);
        assert.equal(headers['X-Fixture'], 'preserved');
      } else {
        assert.equal(warnings.length, 1);
        assert.match(warnings[0]!, /WARN.*vercel\.json.*serving without configured headers/);
        assert.doesNotMatch(warnings[0]!, /private malformed content/);
        assert.equal(Object.keys(headers).length, 0);
      }
    });
  }
});
