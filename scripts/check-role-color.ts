#!/usr/bin/env bun
/**
 * check-role-color.ts — Design.md §19.1 gate for §4.7's colour column.
 *
 * `check-contrast` proves the token a role names is readable; this gate
 * proves the CSS uses that token. Both are needed: the 2026-09-19 review
 * found 44 headings, accents, inline emphases and statistics coloured with
 * `--accent-deep` while §4.7 said `--ink` — every one of them passed
 * contrast, so the canon was written but not enforced.
 */
import { findRoleColourViolations } from '../src/lib/design-gates/role-color.js';
import { parseRoleTable } from '../src/lib/design-gates/contrast.js';

const rows = parseRoleTable();
if (rows.length === 0) {
  console.error('[check-role-color] FAIL — could not parse the §4.7 role table out of Design.md');
  process.exit(1);
}

const v = findRoleColourViolations();
const fail = v.filter((x) => x.state === 'conformant');
const warn = v.filter((x) => x.state === 'migrating');

for (const x of warn) {
  console.warn(`[check-role-color] warn ${x.file}:${x.line} ${x.selector} — ${x.role} wants ${x.expected}, has ${x.actual}`);
}
if (fail.length > 0) {
  console.error('[check-role-color] FAIL — a §4.7 role is coloured with a token the canon does not assign it:');
  for (const x of fail) {
    console.error(`  ${x.file}:${x.line}  ${x.selector} { color: ${x.actual} }  → ${x.role} is ${x.expected}`);
  }
  console.error('\n  Use the role\'s token (docs/Design.md §4.7). If the role really needs another');
  console.error('  colour, that is a canon change (§20.6) — add or amend the row first.');
  process.exit(1);
}
console.log(`[check-role-color] OK — every checked role uses its §4.7 colour token (${rows.length} roles in the table, ${warn.length} warning(s))`);
