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
import { blankInterpolations, cleanSelector, stripComments, walkSource } from './scan.js';

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
/**
 * The `font:` shorthand sets all three, and property names are
 * case-insensitive with optional space before the colon — each of those
 * spellings passed until #866.
 */
const GOVERNED = /(?<![\w-])(?:font-size|font-family|font-weight|font)\s*:\s*[^;}]+/gi;

/** Split on `sep` at paren depth 0, so `:is(h1, h2)` stays one piece. */
function splitTop(text: string, sep: RegExp): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0 && sep.test(ch)) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * True when a compound selector lands on a heading element: `h2`, `h2.title`,
 * or a heading inside `:is()` / `:where()` / `:matches()`. `:not(h2)` does not
 * — it selects everything BUT the heading.
 */
function compoundIsHeading(compound: string): boolean {
  if (/^h[1-4](?![\w-])/i.test(compound)) return true;
  for (const m of compound.matchAll(/:(?:is|where|matches|-webkit-any)\(/gi)) {
    let depth = 1;
    let j = (m.index ?? 0) + m[0].length;
    const start = j;
    for (; j < compound.length && depth > 0; j += 1) {
      if (compound[j] === '(') depth += 1;
      if (compound[j] === ')') depth -= 1;
    }
    if (targetsHeading(compound.slice(start, j - 1))) return true;
  }
  return false;
}

/**
 * True when the selector's SUBJECT is a heading — the last compound, the
 * element the declarations actually land on.
 *
 * `h1 .h1-sub` styles a span inside the heading, not the heading, so it is out
 * of scope; `section > h2` and `.type-block h2` are in scope. Matching anywhere
 * in the selector instead would flag every descendant of a heading.
 *
 * The `summary` carve-out is for the ELEMENT. It used to be a `\bsummary\b`
 * test on the whole selector, so `.summary-card h2` was exempt too (#866).
 */
function targetsHeading(selector: string): boolean {
  return splitTop(selector, /,/).some((part) => {
    const compounds = splitTop(part, /[\s>+~]/);
    if (compounds.some((c) => /^summary(?![\w-])/i.test(c))) return false;
    return compoundIsHeading(compounds[compounds.length - 1] ?? '');
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

    const src = blankInterpolations(stripComments(readFileSync(join(root, file), 'utf-8')));
    RULE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE.exec(src)) !== null) {
      const { selector, offset } = cleanSelector(m[1] ?? '');
      if (!targetsHeading(selector)) continue;
      const declarations = (m[2] ?? '').match(GOVERNED) ?? [];
      if (declarations.length === 0) continue;
      out.push({
        file,
        // The line the selector starts on. The match begins right after the
        // previous `}`, i.e. on the line before, so counting from m.index
        // reported one line short (#866).
        line: src.slice(0, m.index + offset).split('\n').length,
        selector,
        declarations: declarations.map((d) => d.trim()),
        state,
      });
    }
  }

  return out;
}
