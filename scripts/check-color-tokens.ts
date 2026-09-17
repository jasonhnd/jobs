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
import { findColourViolations, findDataUriDrift } from '../src/lib/design-gates/color-tokens.js';

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
// §2.4 example 2 — a data URI may write a colour out, but it has to still be a
// palette colour. Without this the exception is a hole: move a token and the
// icons keep the old value with nothing to say so.
const drift = findDataUriDrift();
if (drift.length > 0) {
  console.error('[check-color-tokens] FAIL — colour inside a data URI matches no palette token (Design.md §2.4):');
  for (const x of drift) console.error(`  ${x.file}:${x.line}  ${x.colour}`);
  console.error('\n  var() cannot be resolved inside a data URI, so the value is written out —');
  console.error('  but it must equal a token in canonical-css.ts, or the icon drifts when the');
  console.error('  token moves. Use the token\'s current value, or inline the SVG.');
  process.exit(1);
}

console.log(
  `[check-color-tokens] OK — no palette tint written raw, ${drift.length === 0 ? 'data URI colours on palette' : ''} (${report.length} off-palette colour(s) reported by drift:design)`,
);
