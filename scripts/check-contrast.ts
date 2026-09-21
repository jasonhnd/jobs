#!/usr/bin/env bun
/**
 * check-contrast.ts — Design.md §19.1 gate.
 *
 * Checks every role in §4.7 against the §2.2 contract. WCAG 2.1's large-text
 * allowance is >=24px, or >=18.66px at weight 700 — so H2 (22px) and H3 (18px)
 * do NOT qualify and need the full 4.5:1. That is the easy mistake §2.2 calls
 * out, and it is encoded here rather than trusted to review.
 */
import { findContrastProblems, parseRoleTable } from '../src/lib/design-gates/contrast.js';

const rows = parseRoleTable();
if (rows.length === 0) {
  console.error('[check-contrast] FAIL — could not parse the §4.7 role table out of Design.md');
  process.exit(1);
}
const p = findContrastProblems();
if (p.length > 0) {
  console.error('[check-contrast] FAIL — §2.2 contract violated:');
  for (const x of p) {
    console.error(`  ${x.role}: ${x.colourToken} on ${x.background} = ${x.ratio}:1, needs ${x.required}:1 (${x.px}px w${x.weight})`);
  }
  process.exit(1);
}
console.log(`[check-contrast] OK — ${rows.length} role × background combinations satisfy §2.2 (AA 4.5:1; large text >=24px, or >=18.66px@700 in SANS only — the shipped serif has one weight (§4.5))`);
