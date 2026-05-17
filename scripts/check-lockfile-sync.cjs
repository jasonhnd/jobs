#!/usr/bin/env node
/**
 * check-lockfile-sync.cjs — guard against the "package.json drifts from
 * pnpm-lock.yaml" bug class that broke Vercel deploy on commit 6bfb1aba.
 *
 * What happened that day:
 *   - I added `@playwright/test` and `http-server` to package.json
 *     devDependencies but didn't run `pnpm install`, so pnpm-lock.yaml
 *     was never updated.
 *   - I committed only package.json. The lockfile in git was stale.
 *   - Vercel runs `corepack pnpm install --frozen-lockfile` (CI default).
 *     The frozen-lockfile flag refuses to install when package.json has
 *     deps not present in the lockfile. Build failed.
 *   - The user only saw it after the deploy failed: "you fixed this bug,
 *     don't let it happen again."
 *
 * This script catches the same drift LOCALLY before it ever leaves
 * the developer's machine. Wired into `npm run build` so a stale lockfile
 * fails the build with an actionable message instead of waiting for
 * Vercel to reject the push.
 *
 * The check is conservative — it compares (1) dep names and (2) specifier
 * strings between the two files, treating the lockfile's `importers['.']`
 * section as ground truth for "what's actually locked." If anything
 * mismatches, the build fails with file paths and a fix command.
 *
 * Pure node:fs — adds no dependencies (deliberate; this script must work
 * even when the lockfile is broken).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const LOCK_PATH = path.join(ROOT, 'pnpm-lock.yaml');

if (!fs.existsSync(LOCK_PATH)) {
  console.error('[check-lockfile-sync] FAIL — pnpm-lock.yaml not found.');
  console.error('  Run `corepack pnpm install` to generate it.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const lockText = fs.readFileSync(LOCK_PATH, 'utf8');

// Combine all top-level deps from package.json with their specifier strings.
// (We intentionally skip optionalDependencies since pnpm handles them
// differently in the importers block; if the project starts using them,
// extend this map.)
const pkgDeps = new Map();
for (const [name, spec] of Object.entries(pkg.dependencies || {})) {
  pkgDeps.set(name, { spec, kind: 'dep' });
}
for (const [name, spec] of Object.entries(pkg.devDependencies || {})) {
  pkgDeps.set(name, { spec, kind: 'devDep' });
}

// Parse pnpm-lock.yaml v9 importers['.'] block. Format:
//
//   importers:
//
//     .:
//       dependencies:
//         '@scope/name':
//           specifier: ^1.0.0
//           version: 1.2.3(...)
//         pkg-name:
//           specifier: ^2.0.0
//           ...
//       devDependencies:
//         ...
//
// Stops parsing when a non-importer top-level key (`packages:` /
// `snapshots:` / etc.) is reached.
const lockDeps = new Map();
{
  const lines = lockText.split('\n');
  let inImporters = false;
  let inRoot = false;
  let currentDep = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (/^[a-z]/i.test(line) && !line.startsWith('importers:')) {
      // Top-level key that isn't "importers" — stop scanning the importers block.
      if (inImporters) inImporters = false;
      continue;
    }
    if (line === 'importers:' || line.startsWith('importers:')) {
      inImporters = true;
      continue;
    }
    if (!inImporters) continue;
    // Root importer marker: "  .:" (2 spaces + dot + colon)
    if (/^\s\s\.:\s*$/.test(line) || /^  \.:\s*$/.test(line)) {
      inRoot = true;
      continue;
    }
    // Other importer (e.g. workspace package) — exit root scope
    if (/^\s\s[^.\s]/.test(line)) {
      inRoot = false;
      continue;
    }
    if (!inRoot) continue;
    // Dep name line: 6-space indent, optional quotes, ends with ":"
    //   "      '@scope/pkg':"  or  "      pkg-name:"
    const depMatch = line.match(/^\s{6}'?([@a-zA-Z0-9_./-]+)'?:\s*$/);
    if (depMatch) {
      currentDep = depMatch[1];
      continue;
    }
    // Specifier line: 8-space indent, "specifier:" then the spec
    const specMatch = line.match(/^\s{8}specifier:\s*'?([^'\n]+?)'?\s*$/);
    if (specMatch && currentDep) {
      lockDeps.set(currentDep, specMatch[1].trim());
      currentDep = null;
    }
  }
}

// Compare and collect issues
const issues = [];

// (a) every dep in package.json must exist in lockfile with matching specifier
for (const [name, { spec }] of pkgDeps) {
  const lockSpec = lockDeps.get(name);
  if (!lockSpec) {
    issues.push({ name, packageSpec: spec, lockSpec: null, kind: 'missing-from-lockfile' });
  } else if (lockSpec !== spec) {
    issues.push({ name, packageSpec: spec, lockSpec, kind: 'spec-mismatch' });
  }
}
// (b) every dep in lockfile importers must be in package.json (catches stale
//     entries that pnpm install would normally clean up)
for (const [name, lockSpec] of lockDeps) {
  if (!pkgDeps.has(name)) {
    issues.push({ name, packageSpec: null, lockSpec, kind: 'extra-in-lockfile' });
  }
}

// 2026-05-17 C5: transitive integrity health check.
// We can't easily reproduce `pnpm install --frozen-lockfile`'s full
// resolution pass in pure JS without a pnpm runtime — but we CAN
// catch the common drift class: lockfile body (packages: + snapshots:
// sections) missing or empty while importers still references them.
// That happens when someone hand-edits the lockfile, or a partial
// merge resolves to a half-truncated YAML.
{
  const hasPackagesSection = /^\s*packages:\s*$/m.test(lockText);
  const hasSnapshotsSection = /^\s*snapshots:\s*$/m.test(lockText);
  if (lockDeps.size > 0 && !hasPackagesSection) {
    console.error(
      '[check-lockfile-sync] FAIL — lockfile importers references deps but no `packages:` section. ' +
        'Run `pnpm install` to regenerate.',
    );
    process.exit(1);
  }
  if (lockDeps.size > 0 && !hasSnapshotsSection) {
    console.error(
      '[check-lockfile-sync] FAIL — lockfile importers references deps but no `snapshots:` section. ' +
        'Run `pnpm install` to regenerate.',
    );
    process.exit(1);
  }
  // Note: deep transitive verification (every resolved version in
  // snapshots is reachable, no orphans) is delegated to Vercel's
  // build-time `pnpm install --frozen-lockfile` — failing locally
  // would be valuable but requires running pnpm itself, which
  // bloats CI gate startup. Vercel catches it in ~25s anyway.
}

// Defensive: if the parser found zero deps in importers['.'] but the
// lockfile clearly has importers + deps, the format probably changed
// under us (pnpm v10+). Fail with an actionable message rather than
// silently passing as "no drift". Skips the check when the project
// genuinely has no deps (impossible in practice for this repo).
if (lockDeps.size === 0 && pkgDeps.size > 0 && /^\s\s\.:/m.test(lockText)) {
  console.error(
    '[check-lockfile-sync] FAIL — parsed 0 deps from importers[".\\"] but package.json has ' +
      pkgDeps.size +
      ' deps and the lockfile contains an importers root.',
  );
  console.error(
    '  The pnpm-lock.yaml indentation / format may have changed (e.g. pnpm v10+).',
  );
  console.error(
    "  Update scripts/check-lockfile-sync.cjs's parser before relying on it.",
  );
  process.exit(1);
}

if (issues.length === 0) {
  console.log(`[check-lockfile-sync] OK — ${pkgDeps.size} deps match between package.json and pnpm-lock.yaml.`);
  process.exit(0);
}

// FAIL output — actionable error message
console.error(`[check-lockfile-sync] FAIL — ${issues.length} drift issue(s) between package.json and pnpm-lock.yaml:\n`);
for (const i of issues) {
  console.error(`  ${i.name}  (${i.kind})`);
  console.error(`    package.json:    ${i.packageSpec ?? '<not present>'}`);
  console.error(`    pnpm-lock.yaml:  ${i.lockSpec ?? '<not present>'}\n`);
}
console.error('  This is the bug class that broke Vercel deploy on commit 6bfb1aba.');
console.error('  Vercel uses `--frozen-lockfile` and will reject deploys with drift.');
console.error('');
console.error('  Fix:');
console.error('    corepack pnpm install     # update pnpm-lock.yaml to match package.json');
console.error('    git add pnpm-lock.yaml package.json');
console.error('    git commit                # commit BOTH files together');
process.exit(1);
