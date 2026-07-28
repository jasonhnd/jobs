import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'compute-csp-hashes.cjs');
const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), 'lib', 'csp-analytics-manifest.cjs');
const ENV_GATED_VARS = [
  'PUBLIC_GA4_MEASUREMENT_ID',
  'PUBLIC_X_PIXEL_ID',
  'PUBLIC_META_PIXEL_ID',
] as const;
// Imported, never re-typed: a hand-copied duplicate drifts the moment an
// analytics inline script changes, which is exactly what this suite guards.
const { CSP_ANALYTICS_FALLBACK_HASHES: ANALYTICS_FALLBACK_HASHES } =
  require('./lib/csp-analytics-manifest.cjs') as { CSP_ANALYTICS_FALLBACK_HASHES: string[] };

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function hashScript(body: string): string {
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
}

function createFixture({
  body = 'window.fixtureScript = true;',
  extraHashes = [],
  htmlPrefix = '',
  omitFallbackHash,
}: {
  body?: string;
  extraHashes?: string[];
  htmlPrefix?: string;
  omitFallbackHash?: string;
} = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'jobs-csp-hashes-'));
  fixtures.push(root);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'scripts', 'lib'));
  mkdirSync(join(root, 'dist-astro'));
  copyFileSync(SCRIPT, join(root, 'scripts', 'compute-csp-hashes.cjs'));
  // The script requires the shared manifest by relative path; the fixture is a
  // standalone tree, so it needs its own copy.
  copyFileSync(MANIFEST, join(root, 'scripts', 'lib', 'csp-analytics-manifest.cjs'));
  writeFileSync(
    join(root, 'dist-astro', 'index.html'),
    `${htmlPrefix}<script>${body}</script>`,
    'utf8',
  );

  const hashes = [hashScript(body), ...ANALYTICS_FALLBACK_HASHES, ...extraHashes]
    .filter((hash) => hash !== omitFallbackHash)
    .sort();
  const csp = [
    "default-src 'self'",
    `script-src 'self' https://example.test ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
  ].join('; ');
  const vercel = {
    headers: [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: csp }],
      },
    ],
  };
  writeFileSync(join(root, 'vercel.json'), `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');
  return root;
}

function runCheck(root: string, fullAnalyticsEnv = false, checkOnly = true) {
  const env = { ...process.env };
  for (const name of ENV_GATED_VARS) delete env[name];
  if (fullAnalyticsEnv) {
    env.PUBLIC_GA4_MEASUREMENT_ID = 'G-CSP-TEST';
    env.PUBLIC_X_PIXEL_ID = 'x-csp-test';
    env.PUBLIC_META_PIXEL_ID = 'meta-csp-test';
  }
  return spawnSync(
    process.execPath,
    [join(root, 'scripts', 'compute-csp-hashes.cjs'), ...(checkOnly ? ['--check'] : [])],
    {
      cwd: root,
      env,
      encoding: 'utf8',
    },
  );
}

describe('compute-csp-hashes fail-closed validation', () => {
  test('accepts the exact computed plus analytics fallback set without analytics env', () => {
    const root = createFixture();
    const result = runCheck(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /matches dist-astro/);
  });

  test('does not let literal script text in a comment hide the next real script', () => {
    const root = createFixture({
      htmlPrefix: '<!-- Documentation mentions an unclosed <script> tag. -->',
    });
    const result = runCheck(root);

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /matches dist-astro/);
  });

  test('rejects a stale committed hash without analytics env', () => {
    const root = createFixture({ extraHashes: ["'sha256-c3RhbGU='"] });
    const result = runCheck(root);

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /DRIFT/);
    assert.match(result.stderr, /Stale\/extra hash\(es\)/);
    assert.match(result.stderr, /no other hash drift is allowed/);
  });

  test('rejects a missing analytics fallback hash without analytics env', () => {
    const root = createFixture({ omitFallbackHash: ANALYTICS_FALLBACK_HASHES[0] });
    const result = runCheck(root);

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /Missing expected hash\(es\)/);
  });

  test('fails a full-env build when the fallback manifest is stale', () => {
    const root = createFixture();
    const before = readFileSync(join(root, 'vercel.json'), 'utf8');
    const result = runCheck(root, true, false);

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /fallback manifest is stale/);
    assert.equal(readFileSync(join(root, 'vercel.json'), 'utf8'), before);
  });
});
