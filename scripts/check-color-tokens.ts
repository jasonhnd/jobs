#!/usr/bin/env bun
/**
 * check-color-tokens.ts — Design.md §19.1 gate, scoped by §2.5.
 *
 * Fails when a conformant surface writes a tint whose BASE is a palette token:
 * §2.5 says those must be `color-mix(in srgb, var(--token) N%, transparent)`,
 * which is exactly the same colour (measured identical to the byte) and needs
 * no new token.
 *
 * Colours with no palette base — brand colours, gradient stops — cannot be
 * expressed today and are reported by `drift:design` instead of failing here.
 */
import { findColourViolations } from '../src/lib/design-gates/color-tokens.js';

const all = findColourViolations();
const fail = all.filter((x) => x.state === 'conformant' && x.derivable);
const report = all.filter((x) => !x.derivable);

if (fail.length > 0) {
  console.error('[check-color-tokens] FAIL — raw tint of a palette token (Design.md §2.5):');
  for (const x of fail) {
    console.error(`  ${x.file}:${x.line}  ${x.selector} { ${x.property}: ${x.value} }`);
  }
  console.error('\n  Write it as color-mix(in srgb, var(--token) N%, transparent).');
  console.error('  Same colour, no new token — §2.5.');
  process.exit(1);
}
console.log(
  `[check-color-tokens] OK — no palette tint written raw (${report.length} off-palette colour(s) reported by drift:design)`,
);
