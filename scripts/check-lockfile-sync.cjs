#!/usr/bin/env bun
/**
 * check-lockfile-sync.cjs — guard against the "package.json drifts from
 * the lockfile" bug class that broke Vercel deploy on commit 6bfb1aba.
 *
 * What happened that day:
 *   - I added `@playwright/test` and `http-server` to package.json
 *     devDependencies but didn't reinstall, so the lockfile was never
 *     updated.
 *   - I committed only package.json. The lockfile in git was stale.
 *   - Vercel runs `install --frozen-lockfile` (CI default). The frozen
 *     flag refuses to install when package.json has deps not present in
 *     the lockfile. Build failed.
 *   - The user only saw it after the deploy failed: "you fixed this bug,
 *     don't let it happen again."
 *
 * This script catches the same drift LOCALLY before it ever leaves the
 * developer's machine. Wired into `build` so a stale lockfile fails the
 * build with an actionable message instead of waiting for Vercel.
 *
 * The check is conservative — it compares (1) dep names and (2) specifier
 * strings between the two files, treating the lockfile's `workspaces['']`
 * block as ground truth for "what's actually locked." If anything
 * mismatches, the build fails with file paths and a fix command.
 *
 * 2026-05-29: rewritten for the pnpm → bun migration. Reads `bun.lock`
 * (a JSONC file: standard JSON plus trailing commas) instead of
 * pnpm-lock.yaml. The e2e packages (@playwright/test, http-server,
 * @axe-core/playwright) are plain devDependencies — they install
 * everywhere; only Playwright's Chromium binary is fetched on demand by
 * scripts/run-e2e.sh, so e2e stays local/manual and never runs in deploy.
 *
 * Pure node:fs — adds no dependencies (deliberate; this script must work
 * even when the lockfile is broken). Runs under bun (and node).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const LOCK_PATH = path.join(ROOT, 'bun.lock');

if (!fs.existsSync(LOCK_PATH)) {
  console.error('[check-lockfile-sync] FAIL — bun.lock not found.');
  console.error('  Run `bun install` to generate it.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const lockText = fs.readFileSync(LOCK_PATH, 'utf8');

// Combine all top-level deps from package.json with their specifier strings.
const pkgDeps = new Map();
for (const [name, spec] of Object.entries(pkg.dependencies || {})) {
  pkgDeps.set(name, { spec, kind: 'dep' });
}
for (const [name, spec] of Object.entries(pkg.devDependencies || {})) {
  pkgDeps.set(name, { spec, kind: 'devDep' });
}
for (const [name, spec] of Object.entries(pkg.optionalDependencies || {})) {
  pkgDeps.set(name, { spec, kind: 'optDep' });
}

// Parse bun.lock. It is JSONC — valid JSON except for trailing commas
// before a closing `}` or `]`. Strip those, then JSON.parse. (bun.lock
// uses no `//` comments, so we deliberately do NOT strip comments — that
// would risk corrupting `https://` substrings inside specifiers.)
let lock;
try {
  lock = JSON.parse(lockText.replace(/,(\s*[}\]])/g, '$1'));
} catch (err) {
  console.error('[check-lockfile-sync] FAIL — could not parse bun.lock as JSONC.');
  console.error('  ' + (err && err.message ? err.message : String(err)));
  console.error('  The bun.lock format may have changed. Update this parser, or run `bun install` to regenerate.');
  process.exit(1);
}

// The root workspace lives under the empty-string key.
const rootWs = lock.workspaces && lock.workspaces[''];
if (!rootWs) {
  console.error("[check-lockfile-sync] FAIL — bun.lock has no root workspace (workspaces['']).");
  console.error('  Run `bun install` to regenerate.');
  process.exit(1);
}

const lockDeps = new Map();
for (const block of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, spec] of Object.entries(rootWs[block] || {})) {
    lockDeps.set(name, String(spec));
  }
}

// Compare and collect issues
const issues = [];

// (a) every dep in package.json must exist in the lockfile workspace with
//     a matching specifier
for (const [name, { spec }] of pkgDeps) {
  const lockSpec = lockDeps.get(name);
  if (!lockSpec) {
    issues.push({ name, packageSpec: spec, lockSpec: null, kind: 'missing-from-lockfile' });
  } else if (lockSpec !== spec) {
    issues.push({ name, packageSpec: spec, lockSpec, kind: 'spec-mismatch' });
  }
}
// (b) every dep in the lockfile workspace must be in package.json (catches
//     stale entries that a reinstall would normally clean up)
for (const [name, lockSpec] of lockDeps) {
  if (!pkgDeps.has(name)) {
    issues.push({ name, packageSpec: null, lockSpec, kind: 'extra-in-lockfile' });
  }
}

// Integrity health check: the resolved `packages` table must be present
// when the workspace declares any deps. A workspace-only lockfile with an
// empty/missing packages table means a half-truncated or hand-edited file.
{
  const hasPackages = lock.packages && Object.keys(lock.packages).length > 0;
  if (lockDeps.size > 0 && !hasPackages) {
    console.error(
      '[check-lockfile-sync] FAIL — bun.lock declares workspace deps but its `packages` table is empty/missing. ' +
        'Run `bun install` to regenerate.',
    );
    process.exit(1);
  }
  // Note: deep transitive verification (every resolved version reachable,
  // no orphans) is delegated to Vercel's build-time
  // `bun install --frozen-lockfile`, which catches it in seconds.
}

// Defensive: parsed zero workspace deps while package.json clearly has some.
if (lockDeps.size === 0 && pkgDeps.size > 0) {
  console.error(
    "[check-lockfile-sync] FAIL — parsed 0 deps from bun.lock workspaces[''] but package.json has " +
      pkgDeps.size +
      ' deps.',
  );
  console.error('  The bun.lock format may have changed. Update scripts/check-lockfile-sync.cjs before relying on it.');
  process.exit(1);
}

if (issues.length === 0) {
  console.log(`[check-lockfile-sync] OK — ${pkgDeps.size} deps match between package.json and bun.lock.`);
  process.exit(0);
}

// FAIL output — actionable error message
console.error(`[check-lockfile-sync] FAIL — ${issues.length} drift issue(s) between package.json and bun.lock:\n`);
for (const i of issues) {
  console.error(`  ${i.name}  (${i.kind})`);
  console.error(`    package.json:  ${i.packageSpec ?? '<not present>'}`);
  console.error(`    bun.lock:      ${i.lockSpec ?? '<not present>'}\n`);
}
console.error('  This is the bug class that broke Vercel deploy on commit 6bfb1aba.');
console.error('  Vercel uses `--frozen-lockfile` and will reject deploys with drift.');
console.error('');
console.error('  Fix:');
console.error('    bun install               # update bun.lock to match package.json');
console.error('    git add bun.lock package.json');
console.error('    git commit                # commit BOTH files together');
process.exit(1);
