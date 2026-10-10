import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures: string[] = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function write(root: string, file: string, text: string): void {
  const full = join(root, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

const ENV_EXAMPLE = [
  '# Browser trackers',
  'PUBLIC_GA4_MEASUREMENT_ID=',
  'GA4_MP_API_SECRET=',
  '',
].join('\n');

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'jobs-analytics-config-'));
  fixtures.push(root);
  for (const file of ['scripts/check-analytics-config.cjs', 'scripts/lib/walk-files.cjs', 'vercel.json']) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(REPO, file), join(root, file));
  }
  write(root, '.env.example', ENV_EXAMPLE);
  write(root, 'src/layouts/BaseLayout.astro', 'const id = import.meta.env.PUBLIC_GA4_MEASUREMENT_ID;');
  write(root, 'middleware.ts', 'const s = process.env.GA4_MP_API_SECRET;');
  write(root, 'api/.keep', '');
  return root;
}

function run(root: string) {
  return spawnSync(process.execPath, [join(root, 'scripts/check-analytics-config.cjs')], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
  });
}

function rejects(root: string, diagnostic: RegExp): void {
  const result = run(root);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, diagnostic);
}

describe('check-analytics-config', () => {
  test('accepts a fully documented tree', () => {
    const result = run(fixture());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /OK — .*1 PUBLIC_\* env vars documented/);
  });

  test('scans PUBLIC_* reads outside BaseLayout and middleware.ts', () => {
    const root = fixture();
    write(root, 'src/lib/middleware/new.ts', 'const x = process.env.PUBLIC_NEW_TRACKER_ID;');
    rejects(root, /Code references PUBLIC_NEW_TRACKER_ID/);
    const other = fixture();
    write(other, 'api/cron/job.ts', "const x = process.env['PUBLIC_BRACKET_ID'];");
    rejects(other, /Code references PUBLIC_BRACKET_ID/);
  });

  test('scans server env in api/** and src/lib/middleware/**', () => {
    const root = fixture();
    write(root, 'api/cron/job.ts', 'const s = process.env.CRON_SECRET;');
    rejects(root, /api\/cron\/job.ts references process.env.CRON_SECRET/);
  });

  test('a longer name or a commented-out line does not document a variable', () => {
    const root = fixture();
    write(root, 'middleware.ts', 'const s = process.env.API_SECRET; const t = process.env.CRON_SECRET;');
    write(root, '.env.example', `${ENV_EXAMPLE}GA4_MP_API_SECRET=\n# CRON_SECRET=\n`);
    const result = run(root);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /process.env.API_SECRET but .env.example does not document it/);
    assert.match(result.stderr, /process.env.CRON_SECRET but .env.example does not document it/);
  });
});
