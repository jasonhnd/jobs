#!/usr/bin/env bun
/**
 * check-surface-coverage.ts — Design.md §19.1 / §20.4: does the ratchet engage?
 *
 * Every gate skips a file the ledger assigns to no surface. That is how an
 * un-migrated range stays out of scope — and it is also how 244 of 272 source
 * files sat outside every gate while the ledger read `conformant 11/11`.
 *
 * A file carrying design declarations must be claimed. `legacy` is a fine
 * answer; absent is not, because absent reads as clean.
 */
import { findUnclaimedFiles } from '../src/lib/design-gates/coverage.js';

// Failing since design-1.18, when the last range was claimed. It shipped as a
// report in design-1.16 only because 244 files were still unclaimed; leaving it
// that way would have preserved the exact condition it exists to prevent.
const FAIL = process.env.DESIGN_COVERAGE_WARN !== '1';
const unclaimed = findUnclaimedFiles();

if (unclaimed.length === 0) {
  console.log('[check-surface-coverage] OK — every file carrying design declarations belongs to a surface');
  process.exit(0);
}

const total = unclaimed.reduce((n, u) => n + u.declarations, 0);
const head = FAIL ? 'FAIL' : 'warn';
console[FAIL ? 'error' : 'warn'](
  `[check-surface-coverage] ${head} — ${unclaimed.length} file(s) with ${total} design declaration(s) belong to no surface, so every gate skips them:`,
);
for (const u of unclaimed.slice(0, 40)) {
  console[FAIL ? 'error' : 'warn'](`  ${String(u.declarations).padStart(4)}  ${u.file}`);
}
if (unclaimed.length > 40) {
  console[FAIL ? 'error' : 'warn'](`  … and ${unclaimed.length - 40} more`);
}
console[FAIL ? 'error' : 'warn'](
  '\n  Add the range to the 対象ファイル table in docs/DESIGN_CONFORMANCE.md.\n' +
  '  A path ending in `/` claims the directory.',
);
if (FAIL) process.exit(1);
