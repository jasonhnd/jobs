// run-e2e.sh must build with every tracker ID overridden. A build from
// .env.local otherwise ships production X / Meta / Ads / Cloudflare IDs into
// the e2e pages (live hits from localhost) and rewrites the CSP hashes.
import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRACKER_IDS = [
  'PUBLIC_X_PIXEL_ID', 'PUBLIC_META_PIXEL_ID', 'PUBLIC_GOOGLE_ADS_ID', 'PUBLIC_CF_BEACON_TOKEN',
] as const;
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('run-e2e.sh', () => {
  test('builds with a throwaway GA4 id and every other tracker id empty', () => {
    const bin = mkdtempSync(join(tmpdir(), 'jobs-run-e2e-'));
    dirs.push(bin);
    const log = join(bin, 'build-env.json');
    // A stand-in `bun` that does nothing except record the env of `bun run build`.
    writeFileSync(join(bin, 'bun'), [
      '#!/usr/bin/env node',
      "if (process.argv[2] === 'run' && process.argv[3] === 'build') {",
      `  require('node:fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.env));`,
      '}',
    ].join('\n'));
    chmodSync(join(bin, 'bun'), 0o755);
    const production = Object.fromEntries(TRACKER_IDS.map((name) => [name, `prod-${name}`]));
    const result = spawnSync('bash', [join(REPO, 'scripts/run-e2e.sh')], {
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, ...production, PUBLIC_GA4_MEASUREMENT_ID: 'G-PRODUCTION', PATH: `${bin}:${process.env.PATH}` },
    });
    assert.equal(result.status, 0, result.stderr);
    const env = JSON.parse(readFileSync(log, 'utf8')) as Record<string, string | undefined>;
    assert.equal(env.PUBLIC_GA4_MEASUREMENT_ID, 'G-E2E0000000');
    for (const name of TRACKER_IDS) assert.equal(env[name], '', `${name} must be overridden empty`);
  });
});
