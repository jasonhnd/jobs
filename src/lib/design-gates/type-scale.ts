/**
 * design-gates/type-scale.ts — Design.md §19.1 `check-type-scale`.
 *
 * Every `font-size` on a conformant surface must come from the scale
 * (`var(--t-*)`). §4.2 fixes seven steps and a 12px floor; a raw value is how
 * the 75-sizes-over-803-declarations drift happened in the first place.
 *
 * Two things are deliberately NOT violations:
 *
 *   html { font-size: 16px }  — this defines what `rem` means. It is the root
 *     sizing, not a text role, and every page-class CSS file carries it.
 *   ranges the ledger assigns to no surface (scan.ts UNASSIGNED).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TYPE_SCALE } from '../design-tokens.js';
import { readLedger, surfaceStateFor, type SurfaceState } from './ledger.js';
import { blankInterpolations, isUnassigned, scanDeclarations, stripComments, walkSource } from './scan.js';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly value: string;
  readonly state: SurfaceState;
}

const SCALE: ReadonlySet<string> = new Set(Object.keys(TYPE_SCALE));

/** `var(--t-sm)` — and only for a step §4.2 actually defines. */
export function isScaleToken(value: string): boolean {
  const m = value.trim().match(/^var\(\s*(--t-[a-z0-9-]+)\s*\)$/);
  return m != null && SCALE.has(m[1] ?? '');
}

/** Split on whitespace and `/`, keeping parenthesised groups whole. */
function shorthandTokens(value: string): Array<{ text: string; slash: boolean }> {
  const out: Array<{ text: string; slash: boolean }> = [];
  let cur = '';
  let depth = 0;
  const push = (slash: boolean): void => {
    if (cur !== '') out.push({ text: cur, slash });
    else if (slash && out.length > 0) out[out.length - 1] = { ...out[out.length - 1]!, slash: true };
    cur = '';
  };
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0 && /\s/.test(ch)) { push(false); continue; }
    if (depth === 0 && ch === '/') { push(true); continue; }
    cur += ch;
  }
  push(false);
  return out;
}

/** The whole shorthand is one keyword: CSS-wide, or a system font. */
const KEYWORD_ONLY = /^(?:inherit|initial|unset|revert|revert-layer|caption|icon|menu|message-box|small-caption|status-bar)$/i;
/** Tokens that may precede the size: style, variant, weight, stretch. */
const BEFORE_SIZE =
  /^(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[1-9][0-9]{0,2}|1000|(?:ultra-|extra-|semi-)?(?:condensed|expanded))$/i;

/**
 * The font-size inside a `font:` shorthand, or null when it provably has none.
 *
 * null is reserved for the cases that are KNOWN to carry no size: a lone
 * CSS-wide or system-font keyword, and a lone identifier (`font: string` in a
 * TS interface — not CSS). Everything else returns the size slot, which the
 * caller checks with isScaleToken: the token before `/line-height`, else the
 * first token after style/variant/weight/stretch — whatever it is, so
 * `font: 400 var(--custom-size) sans-serif` is checked rather than waved
 * through (#866 review). A shorthand whose size slot cannot be found returns
 * the whole value, which fails the check: undetermined is not clean.
 */
export function shorthandSize(value: string): string | null {
  const v = value.replace(/!important/i, '').trim();
  const tokens = shorthandTokens(v);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    const only = tokens[0]!.text;
    if (KEYWORD_ONLY.test(only) || /^[A-Za-z_$][\w$.]*$/.test(only)) return null;
    return only;
  }
  const beforeSlash = tokens.find((t) => t.slash);
  if (beforeSlash != null) return beforeSlash.text;
  return tokens.find((t) => !BEFORE_SIZE.test(t.text))?.text ?? v;
}

/** `html` at the top of a page-class file — the rem base, not a text role. */
function isRootSizing(selector: string, value: string): boolean {
  return /(^|,)\s*html\s*$/.test(selector) && value.trim() === '16px';
}

export function findTypeScaleViolations(root: string = process.cwd()): Violation[] {
  const surfaces = readLedger(root);
  const out: Violation[] = [];

  for (const file of walkSource(root)) {
    const state = surfaceStateFor(file, surfaces);
    if (state == null || state === 'legacy') continue;

    const src = blankInterpolations(stripComments(readFileSync(join(root, file), 'utf-8')));
    for (const { property, value: raw, line, selector } of scanDeclarations(src)) {
      let value: string | null;
      if (property === 'font-size') value = raw.replace(/!important/i, '').trim();
      else if (property === 'font') value = shorthandSize(raw);
      else continue;
      if (value == null || isScaleToken(value)) continue;
      if (isRootSizing(selector, value)) continue;
      if (isUnassigned(file, selector)) continue;
      out.push({ file, line, selector, value, state });
    }
  }
  return out;
}
