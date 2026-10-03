import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-geo-freshness.ts', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));

function fixture(run: (dir: string, put: (rel: string, text: string) => void) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'geo-freshness-cli-'));
  const put = (rel: string, text: string): void => {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  try {
    run(dir, put);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function cli(cwd: string) {
  const result = spawnSync(process.execPath, [script], {
    cwd, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  return result.stderr;
}

function copyGeneratedInputs(dir: string, put: (rel: string, text: string) => void): void {
  // Read the current repository batches/projections; mutate only private copies.
  cpSync(join(root, 'data/scores'), join(dir, 'data/scores'), { recursive: true });
  for (const rel of ['public/data.treemap.json', 'public/llms.txt', 'public/llms-full.txt', 'src/pages/_index-json-ld.json']) {
    put(rel, readFileSync(join(root, rel), 'utf8'));
  }
}

describe('GEO freshness CLI', () => {
  test('parses JSON score files and rejects invalid schema before checking output', () => {
    fixture((dir, put) => {
      put('data/scores/invalid.json', '{}');
      put('data/scores/ignored.txt', 'not JSON');
      assert.ok(cli(dir).includes('ZodError'));
      put('data/scores/invalid.json', '{');
      assert.ok(cli(dir).includes('SyntaxError'));
    });
  });

  test('rejects generated discovery text drift with the rebuild instruction', () => {
    fixture((dir, put) => {
      copyGeneratedInputs(dir, put);
      put('public/llms.txt', `${readFileSync(join(dir, 'public/llms.txt'), 'utf8')}stale\n`);
      assert.equal(cli(dir).trim(), '[check-geo-freshness] FAIL: public/llms.txt does not match the generated GEO facts. Run `bun src/data/build.ts`.');
    });
  });

  test('normalizes CRLF and then validates documented projection examples', () => {
    fixture((dir, put) => {
      copyGeneratedInputs(dir, put);
      for (const rel of ['public/llms.txt', 'public/llms-full.txt', 'src/pages/_index-json-ld.json']) {
        put(rel, readFileSync(join(dir, rel), 'utf8').replace(/\n/g, '\r\n'));
      }
      // Exact text and stale-token checks pass. The isolated fixture deliberately
      // omits projection examples so the next guard must reject the missing file.
      assert.match(cli(dir), /^\[check-geo-freshness\] FAIL: public\/llms.txt documents \d{4}\.json, but public\/data.detail\/\d{4}\.json is missing or invalid\n$/);
    });
  });

  test('requires both public and built examples to match their padded filename', () => {
    fixture((dir, put) => {
      copyGeneratedInputs(dir, put);
      const text = readFileSync(join(dir, 'public/llms.txt'), 'utf8');
      const paddedId = text.match(/https:\/\/mirai-shigoto\.com\/data\.detail\/(\d{4})\.json/)![1]!;
      put(`public/data.detail/${paddedId}.json`, JSON.stringify({ id: -1 }));
      assert.equal(cli(dir).trim(), `[check-geo-freshness] FAIL: public/data.detail/${paddedId}.json id does not match its documented zero-padded filename`);
      put(`public/data.detail/${paddedId}.json`, JSON.stringify({ id: Number(paddedId) }));
      assert.equal(cli(dir).trim(), `[check-geo-freshness] FAIL: public/llms.txt documents ${paddedId}.json, but dist-astro/data.detail/${paddedId}.json is missing or invalid`);
      put(`dist-astro/data.detail/${paddedId}.json`, JSON.stringify({ id: -1 }));
      assert.equal(cli(dir).trim(), `[check-geo-freshness] FAIL: dist-astro/data.detail/${paddedId}.json id does not match its documented zero-padded filename`);
    });
  });
});
