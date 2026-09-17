/**
 * design-gates/coverage.ts — Design.md §19.1 / §20.4: does the ratchet engage?
 *
 * Every other gate starts with `surfaceStateFor(file)` and SKIPS the file when
 * the ledger assigns it to no surface (null). That is deliberate — it is how an
 * un-migrated range stays out of scope — but it means the ledger's file table
 * silently decides how much of the site the gates can see.
 *
 * It decided very little. Measured 2026-09-17, after the ledger already read
 * `conformant 11/11 surface`:
 *
 *   272 source files scanned
 *    28 claimed by a surface
 *   244 skipped — including src/pages/_index.css (the 75 KB homepage sheet;
 *       the table named src/pages/_index-css.ts, a different 3.5 KB file),
 *       TopNav.astro, Footer.astro, and every src/pages/<hub>/ route.
 *
 * Hidden in that gap: 255 raw `font-size` declarations, 15 renderings below the
 * 12px floor (§4.2), and 35 page-local heading rules (§4.9) — while the ledger
 * and ROADMAP both stated those counts were zero.
 *
 * This module closes the loop: a file that carries a design-relevant
 * declaration must be claimed by some surface. Membership can still be
 * `legacy`, which is an honest "not yet" — what it may not be is absent, which
 * reads as "clean" and is how the drift got back in.
 *
 * This is the same failure the programme already hit twice: §18.7 declared page
 * class membership that was never wired, and `check-contrast` measured declared
 * roles rather than rendered colour. Declaring a scope is not the same as
 * covering it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLedger, surfaceStateFor } from './ledger.js';
import { stripComments, walkSource } from './scan.js';

/** Declarations the design canon governs. A file with none is not in scope. */
const DESIGN_DECL =
  /(^|[\s;{])(font-size|font-family|font-weight|line-height|z-index|color|background-color)\s*:/;

export interface Unclaimed {
  readonly file: string;
  /** How many design declarations the file carries. */
  readonly declarations: number;
}

export function findUnclaimedFiles(root: string = process.cwd()): Unclaimed[] {
  const surfaces = readLedger(root);
  const out: Unclaimed[] = [];

  for (const file of walkSource(root)) {
    if (surfaceStateFor(file, surfaces) !== null) continue;
    const src = stripComments(readFileSync(join(root, file), 'utf-8'));
    const declarations = src
      .split('\n')
      .filter((line) => DESIGN_DECL.test(line)).length;
    if (declarations > 0) out.push({ file, declarations });
  }

  return out.sort((a, b) => b.declarations - a.declarations);
}
