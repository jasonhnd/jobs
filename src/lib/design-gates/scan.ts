/**
 * design-gates/scan.ts — shared scanning for the Design v1.0 gates (§19.1).
 *
 * The gates read source, not built CSS, so a violation is reported at the line
 * a human edits. Comments are stripped first: a value inside /* … *\/ or // is
 * documentation, and several canon comments quote the very values the gates
 * forbid.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface Hit {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

const SKIP_DIRS = new Set(['node_modules', 'dist-astro', '.astro', '__snapshots__']);
const EXTS = ['.ts', '.tsx', '.astro', '.css', '.html'];

export function walkSource(root: string, dir = 'src'): string[] {
  const out: string[] = [];
  const abs = join(root, dir);
  const walk = (d: string): void => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) walk(p);
        continue;
      }
      if (!EXTS.some((e) => ent.name.endsWith(e))) continue;
      if (/\.test\.[tj]sx?$/.test(ent.name)) continue;
      out.push(relative(root, p));
    }
  };
  if (statSync(abs, { throwIfNoEntry: false })) walk(abs);
  return out.sort();
}

/**
 * Blank out comment bodies while keeping line numbering intact, so a reported
 * line still points at the right source line.
 */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'block' | 'line' = 'code';
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (mode === 'code' && two === '/*') { mode = 'block'; out += '  '; i += 2; continue; }
    if (mode === 'block' && two === '*/') { mode = 'code'; out += '  '; i += 2; continue; }
    if (mode === 'code' && two === '//') { mode = 'line'; out += '  '; i += 2; continue; }
    const ch = src[i] ?? '';
    if (mode === 'line' && ch === '\n') mode = 'code';
    out += mode === 'code' || ch === '\n' ? ch : ' ';
    i += 1;
  }
  return out;
}

export function scan(root: string, file: string, re: RegExp): Hit[] {
  const lines = stripComments(readFileSync(join(root, file), 'utf-8')).split('\n');
  const hits: Hit[] = [];
  lines.forEach((text, idx) => {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    if (r.test(text)) hits.push({ file, line: idx + 1, text: text.trim().slice(0, 120) });
  });
  return hits;
}

/**
 * Ranges the ledger assigns to no surface. The gates skip them because
 * enforcing there would mean enforcing on a surface that does not exist —
 * §19.1's ratchet is per surface.
 *
 * design-1.13 emptied the canonical-css.ts entry by giving the site chrome its
 * own ledger row, so only the 404 numeral remains.
 *
 * Each entry cites the ledger. Removing an entry is how the owner brings that
 * range under a surface; the gates then start failing on it, which is the
 * point.
 */
export const UNASSIGNED: ReadonlyArray<{
  readonly file: string;
  /** Matches the SELECTOR text a declaration sits under. */
  readonly selector: RegExp;
  readonly why: string;
}> = [
  {
    // The 404 numeral is a decorative glyph at 80-144px; the page's real title
    // is the h1 beneath it. §4.2's scale has no role for it and §4.8 reserves
    // Display for Feature page titles, so the canon does not cover this.
    // Reported to the owner rather than forced into a step that would destroy
    // the page.
    file: 'src/pages/404.astro',
    selector: /\.four-oh-four/,
    why: 'decorative numeral — no §4.7 role; owner decision pending',
  },
];

export function isUnassigned(file: string, selector: string): boolean {
  return UNASSIGNED.some((u) => u.file === file && u.selector.test(selector));
}
