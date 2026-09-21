#!/usr/bin/env bun
/**
 * check-design-sync.ts — Design.md §19.1 gate.
 *
 * The two canons hold the same values (§ 現行契約). This fails when
 * docs/Design.md §21.2 and src/lib/design-tokens.ts disagree, or when the
 * version is declared differently in the two places §20.2 names.
 */
import { findSyncProblems } from '../src/lib/design-gates/design-sync.js';

const p = findSyncProblems();
if (p.length > 0) {
  console.error('[check-design-sync] FAIL — Design.md and design-tokens.ts disagree:');
  for (const x of p) console.error(`  ${x.kind.padEnd(18)} ${x.token}: doc=${x.doc}  module=${x.module}`);
  console.error('\n  Design.md is the human canon (§20.6). Change it first, then the module.');
  process.exit(1);
}
console.log('[check-design-sync] OK — Design.md §21.2 and design-tokens.ts agree');
