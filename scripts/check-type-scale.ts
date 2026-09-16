#!/usr/bin/env bun
/**
 * check-type-scale.ts — Design.md §19.1 gate.
 *
 * Fails when a conformant surface carries a `font-size` that is not
 * `var(--t-*)`. Warns on `migrating`, ignores `legacy` — the per-surface
 * ratchet the ledger drives (§19.1 / §20.4).
 */
import { findTypeScaleViolations } from '../src/lib/design-gates/type-scale.js';

const v = findTypeScaleViolations();
const fail = v.filter((x) => x.state === 'conformant');
const warn = v.filter((x) => x.state === 'migrating');

for (const x of warn) {
  console.warn(`[check-type-scale] warn ${x.file}:${x.line} ${x.selector} → ${x.value} (surface migrating)`);
}
if (fail.length > 0) {
  console.error('[check-type-scale] FAIL — raw font-size on a conformant surface (Design.md §4.2):');
  for (const x of fail) console.error(`  ${x.file}:${x.line}  ${x.selector} { font-size: ${x.value} }`);
  console.error('\n  Use a scale step: --t-display / --t-h1 / --t-h2 / --t-h3 / --t-body / --t-sm / --t-xs.');
  console.error('  Pick it by ROLE (Design.md §4.7), not by nearest value (§21.3).');
  process.exit(1);
}
console.log(`[check-type-scale] OK — every font-size on a conformant surface is a scale token (${warn.length} warning(s))`);
