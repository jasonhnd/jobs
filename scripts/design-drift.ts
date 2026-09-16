#!/usr/bin/env bun
/**
 * design-drift.ts — Design.md §20.5 read-only report. Never fails the build,
 * matching drift:flagship-switch / drift:vendor-update.
 *
 * It carries `check-color-tokens` (§19.1) as a REPORT rather than a gate. The
 * rule as written — no raw #hex or rgba() — cannot be enforced yet: roughly
 * 70 uses are alpha tints, gradients and brand colours (LINE's #06C755 among
 * them) and the canon has no token that can express them. Turning it into a
 * failing gate today would mean either a red build or a 70-entry exemption
 * list, and the second is worse than the first. Adding a tint scale is a MINOR
 * revision (§20.1) and the owner's call (§20.6).
 *
 * Usage: bun run drift:design
 */
import { findColourViolations } from '../src/lib/design-gates/color-tokens.js';
import { findTypeScaleViolations } from '../src/lib/design-gates/type-scale.js';
import { readLedger } from '../src/lib/design-gates/ledger.js';

const surfaces = readLedger();
const byState = (s: string): number => surfaces.filter((x) => x.state === s).length;

console.log('── Design v1.0 drift report ──────────────────────────────────');
console.log(
  `ledger: ${byState('conformant')} conformant / ${byState('migrating')} migrating / ${byState('legacy')} legacy`,
);

const type = findTypeScaleViolations();
console.log(`\ncheck-type-scale (gate): ${type.length} raw font-size on enforced surfaces`);

const colour = findColourViolations();
const pureHex = colour.filter((c) => !/rgba?\(/.test(c.value));
console.log(`check-color-tokens (report only): ${colour.length} raw colour(s) — ${pureHex.length} pure hex, ${colour.length - pureHex.length} rgba()`);

const byFile = new Map<string, number>();
for (const c of colour) byFile.set(c.file, (byFile.get(c.file) ?? 0) + 1);
for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`   ${String(n).padStart(3)}  ${file}`);
}

console.log('\nWhy check-color-tokens is not a gate yet:');
console.log('  the canon has no alpha/tint token, so gradients, 0.06-0.45 alpha');
console.log('  borders and brand colours (e.g. LINE #06C755) cannot be expressed.');
console.log('  Adding a tint scale is a MINOR revision (§20.1) — owner decision.');
console.log('──────────────────────────────────────────────────────────────');
