/**
 * design-gates/heading-rules.ts — Design.md §4.9.
 *
 * "ページ CSS に見出しの字号・書体・字重を書かない。" The heading branch lives
 * in canonical-css.ts and nowhere else; that is what lets §4.8 express page
 * titles in exactly two values site-wide, and what made removing the
 * `!important` in design-1.9 safe.
 *
 * §4.9 was enforced by hand-written greps during the migration and by nothing
 * afterwards. The greps also under-counted: #532's acceptance grep required a
 * prefix before the tag, so a bare `h1{…}` rule slipped through and was only
 * caught later by check-type-scale. Measured 2026-09-17, against a ledger that
 * read "ページ CSS に見出しの字号・書体・字重を書く箇所は 0": 48 such rules
 * existed, 35 of them in files no surface claimed.
 *
 * Scope note: `.faq summary` and friends are card-level headings by markup, not
 * `h1`–`h4`, so they are outside this rule; `summary` selectors are excluded.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLedger, surfaceStateFor, type SurfaceState } from './ledger.js';
import { stripComments, walkSource } from './scan.js';

export interface HeadingViolation {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  /** The offending declarations, e.g. `font-size: 1.35rem`. */
  readonly declarations: readonly string[];
  readonly state: SurfaceState;
}

/** canonical-css.ts owns the heading branch — it is the one file §4.9 exempts. */
const CANON = 'src/lib/canonical-css.ts';

const RULE = /([^{};]*)\{([^{}]*)\}/g;
const GOVERNED = /\b(font-size|font-family|font-weight)\s*:\s*[^;}]+/g;

/**
 * True when the selector's SUBJECT is a heading — the last compound, the
 * element the declarations actually land on.
 *
 * `h1 .h1-sub` styles a span inside the heading, not the heading, so it is out
 * of scope; `section > h2` and `.type-block h2` are in scope. Matching anywhere
 * in the selector instead would flag every descendant of a heading.
 */
function targetsHeading(selector: string): boolean {
  return selector.split(',').some((part) => {
    const subject = part.trim().split(/[\s>+~]+/).pop() ?? '';
    if (/\bsummary\b/.test(part)) return false;
    return /^h[1-4]\b/.test(subject);
  });
}

export function findHeadingRuleViolations(
  root: string = process.cwd(),
): HeadingViolation[] {
  const surfaces = readLedger(root);
  const out: HeadingViolation[] = [];

  for (const file of walkSource(root)) {
    if (file === CANON) continue;
    // §4.9 has no per-surface carve-out — the rule is site-wide. A file the
    // ledger has not claimed yet is reported as `migrating` (a warning) rather
    // than skipped, so the inventory is complete before coverage lands.
    const state = surfaceStateFor(file, surfaces) ?? 'migrating';
    if (state === 'legacy') continue;

    const src = stripComments(readFileSync(join(root, file), 'utf-8'));
    RULE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE.exec(src)) !== null) {
      const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ');
      if (!targetsHeading(selector)) continue;
      const declarations = (m[2] ?? '').match(GOVERNED) ?? [];
      if (declarations.length === 0) continue;
      out.push({
        file,
        line: src.slice(0, m.index).split('\n').length,
        selector,
        declarations: declarations.map((d) => d.trim()),
        state,
      });
    }
  }

  return out;
}
