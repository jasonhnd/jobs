#!/usr/bin/env bun
/**
 * design-drift.ts — Design.md §20.5 read-only report. Never fails the build,
 * matching drift:flagship-switch / drift:vendor-update.
 *
 * §2.5 (v1.1) split check-color-tokens in two: tints of a palette token are a
 * FAILING gate (check-color-tokens.ts), because color-mix() expresses them
 * exactly. What remains here is the off-palette residue — brand colours,
 * gradient stops, neutral shadows — which the canon still cannot express.
 *
 * Usage: bun run drift:design
 */
import { findColourViolations } from '../src/lib/design-gates/color-tokens.js';
import { findTypeScaleViolations } from '../src/lib/design-gates/type-scale.js';
import { readLedger } from '../src/lib/design-gates/ledger.js';
import { DESIGN_VERSION } from '../src/lib/design-tokens.js';

const surfaces = readLedger();
const byState = (s: string): number => surfaces.filter((x) => x.state === s).length;

console.log(`── Design v${DESIGN_VERSION} drift report ─────────────────────────────`);
console.log(
  `ledger: ${byState('conformant')} conformant / ${byState('migrating')} migrating / ${byState('legacy')} legacy`,
);

const type = findTypeScaleViolations();
console.log(`\ncheck-type-scale (gate): ${type.length} raw font-size on enforced surfaces`);

const colour = findColourViolations();
const derivable = colour.filter((c) => c.derivable);
const residue = colour.filter((c) => !c.derivable);
console.log(`check-color-tokens (gate): ${derivable.length} palette tint(s) written raw — must be 0 (§2.5)`);
console.log(`off-palette residue (report only): ${residue.length}`);

const byFile = new Map<string, number>();
for (const c of residue) byFile.set(c.file, (byFile.get(c.file) ?? 0) + 1);
for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`   ${String(n).padStart(3)}  ${file}`);
}

console.log('\nWhat the residue is:');
console.log('  brand colours (e.g. LINE #06C755), gradient stops, and neutral');
console.log('  black/white shadows. None has a palette base, so §2.5 does not');
console.log('  reach them and no token expresses them today.');
console.log('──────────────────────────────────────────────────────────────');
