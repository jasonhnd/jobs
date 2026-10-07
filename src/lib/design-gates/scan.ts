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
/**
 * `.js` was missing until #866, so the inline scripts under src/pages/
 * (`_map-inline.js` and friends) sat outside every gate.
 */
const EXTS = ['.ts', '.tsx', '.astro', '.css', '.html', '.js', '.mjs', '.cjs', '.jsx'];

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
      if (/\.test\.[cm]?[tj]sx?$/.test(ent.name)) continue;
      out.push(relative(root, p));
    }
  };
  if (statSync(abs, { throwIfNoEntry: false })) walk(abs);
  return out.sort();
}

/**
 * Blank out comment bodies while keeping line numbering intact, so a reported
 * line still points at the right source line.
 *
 * Two things are NOT a comment and were being treated as one until 2026-09-17:
 *
 *   - `//` inside a quoted string. `xmlns='http://www.w3.org/2000/svg'` in a
 *     data URI blanked the rest of the line, so every gate went blind past it.
 *     Measured when this was fixed: 313 lines across 74 files were truncated,
 *     6 of them carrying a design declaration after the URL.
 *   - `//` immediately after `:`, which is a URL scheme even unquoted.
 *
 * This is the same shape as the coverage hole (design-1.16): the checker
 * reported clean because it could not see, not because there was nothing there.
 */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'block' | 'line' = 'code';
  /** The quote character we are inside, or '' in code. Reset at newline. */
  let quote = '';
  while (i < src.length) {
    const ch = src[i] ?? '';
    const two = src.slice(i, i + 2);

    if (mode === 'code' && quote !== '') {
      if (ch === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (ch === quote) quote = '';
      if (ch === '\n') quote = '';
      out += ch; i += 1; continue;
    }
    if (mode === 'code' && (ch === '"' || ch === "'" || ch === '`')) {
      quote = ch; out += ch; i += 1; continue;
    }
    if (mode === 'code' && two === '/*') { mode = 'block'; out += '  '; i += 2; continue; }
    if (mode === 'block' && two === '*/') { mode = 'code'; out += '  '; i += 2; continue; }
    if (mode === 'code' && two === '//' && src[i - 1] !== ':') {
      mode = 'line'; out += '  '; i += 2; continue;
    }
    if (mode === 'line' && ch === '\n') mode = 'code';
    out += mode === 'code' || ch === '\n' ? ch : ' ';
    i += 1;
  }
  return out;
}

/**
 * Blank every `${…}` interpolation (braces balanced), keeping newlines and
 * length so offsets and line numbers still point at the source.
 *
 * A rule body such as `.card h2 { color: ${c}; font-size: 2rem }` otherwise
 * contains a `{` and a `}` of its own, and a `{…}` rule regex matches the
 * interpolation instead of the rule — the rule was skipped whole (#866).
 */
export function blankInterpolations(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < src.length; j += 1) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') { depth -= 1; if (depth === 0) break; }
      }
      const end = Math.min(j + 1, src.length);
      out += src.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

/**
 * What precedes a rule's `{` up to the previous `;`/`{`/`}` can carry the
 * opening of a template literal or a `<style>` tag; the selector starts after
 * them. `offset` is where the selector text begins inside `raw`.
 */
export function cleanSelector(raw: string): { selector: string; offset: number } {
  let offset = 0;
  const cut = (re: RegExp): void => {
    let last = -1;
    for (const m of raw.matchAll(re)) last = (m.index ?? 0) + m[0].length;
    if (last > offset) offset = last;
  };
  cut(/`/g);
  cut(/<style[^>]*>/gi);
  const rest = raw.slice(offset);
  offset += rest.length - rest.trimStart().length;
  return { selector: raw.slice(offset).trim().replace(/\s+/g, ' '), offset };
}

export interface Declaration {
  /** Lower-cased property name; custom properties keep their `--`. */
  readonly property: string;
  /** The value with whitespace (including newlines) collapsed. */
  readonly value: string;
  /** 1-based line of the property name. */
  readonly line: number;
  /** The innermost enclosing rule's selector (at-rules skipped), or ''. */
  readonly selector: string;
}

/**
 * A declaration: a `--custom` or CSS property name (any case, optional space
 * before the colon) and a value that runs to `;`, `{` or `}`. The value may
 * continue onto the next line — `box-shadow:\n  0 1px 0 rgba(…);` — unless
 * that line starts another `name:`; reading line by line let a value written
 * on its own line skip every gate (#866 review).
 */
const DECLARATION =
  /(?:^|[;{\s])(--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z-]*)\s*:\s*((?:[^;{}<\n]|\n(?!\s*(?:--)?[A-Za-z][A-Za-z0-9_-]*\s*:))*)/g;

/**
 * Blank `<!-- … -->` bodies (newlines kept). A multi-line value would otherwise
 * read prose such as `entry: H2 + trust signal …` as a declaration. A value
 * also stops at `<`, which CSS never writes outside a string.
 */
export function blankHtmlComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
}

/** The innermost non-at-rule selector open at each (ascending) position. */
function selectorsAt(src: string, positions: readonly number[]): string[] {
  const out: string[] = [];
  const stack: string[] = [];
  let segment = 0;
  let p = 0;
  for (let i = 0; i <= src.length && p < positions.length; i += 1) {
    while (p < positions.length && positions[p] === i) {
      out.push([...stack].reverse().find((s) => !s.startsWith('@')) ?? '');
      p += 1;
    }
    const ch = src[i];
    if (ch === '{') { stack.push(cleanSelector(src.slice(segment, i)).selector); segment = i + 1; }
    else if (ch === '}') { stack.pop(); segment = i + 1; }
    else if (ch === ';') segment = i + 1;
  }
  return out;
}

/**
 * Every declaration in already-prepared source (comments stripped, `${…}`
 * blanked), with the line it starts on and the rule it sits in.
 */
export function scanDeclarations(prepared: string): Declaration[] {
  const src = blankHtmlComments(prepared);
  const found: Array<{ property: string; value: string; at: number }> = [];
  for (const m of src.matchAll(DECLARATION)) {
    const property = m[1] ?? '';
    const at = (m.index ?? 0) + m[0].indexOf(property);
    found.push({ property: property.toLowerCase(), value: (m[2] ?? '').replace(/\s+/g, ' ').trim(), at });
  }
  const selectors = selectorsAt(src, found.map((f) => f.at));
  let line = 1;
  let cursor = 0;
  return found.map((f, i) => {
    for (; cursor < f.at; cursor += 1) if (src[cursor] === '\n') line += 1;
    return { property: f.property, value: f.value, line, selector: selectors[i] ?? '' };
  });
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
    // Anchored (#866): unanchored, it also exempted `.four-oh-four-x h2` and
    // anything else that merely contained the class name.
    selector: /^\.four-oh-four$/,
    why: 'decorative numeral — no §4.7 role; owner decision pending',
  },
];

export function isUnassigned(file: string, selector: string): boolean {
  return UNASSIGNED.some((u) => u.file === file && u.selector.test(selector));
}
