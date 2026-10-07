/**
 * design-gates/color-tokens.ts — Design.md §19.1 `check-color-tokens`.
 *
 * §2.1 keeps every colour in the single :root of canonical-css.ts, so a raw
 * `#hex` or `rgba()` on a conformant surface means a colour escaped the
 * palette.
 *
 * §2.5 (v1.1) draws the enforceable line: a tint whose BASE is a palette token
 * can be written as color-mix() and is therefore a failure. A colour with no
 * palette base — a brand colour such as LINE's #06C755, a gradient stop —
 * cannot be expressed today and is reported instead. `derivable` carries that
 * distinction so the CLI can fail on one and warn on the other.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_TOKENS } from '../design-tokens.js';
import { blankDataUris, isNeutral, parseColours, RAW_COLOUR, rgbKey } from './colour-parse.js';
import { readLedger, surfaceStateFor, type SurfaceState } from './ledger.js';
import { isUnassigned, stripComments, walkSource } from './scan.js';

export interface ColourViolation {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly property: string;
  readonly value: string;
  readonly state: SurfaceState;
  /** True when the base is a palette token, so §2.5's color-mix() applies. */
  readonly derivable: boolean;
}

/**
 * The properties the gate read before #866. Their values are judged in full,
 * and a quoted value counts — Satori style objects write `color: '#…'`.
 */
const TOKENISED: ReadonlySet<string> = new Set([
  'color', 'background', 'background-color', 'border-color', 'border',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'fill', 'stroke', 'outline-color',
]);

/**
 * Any declaration: a `--custom` property or a CSS property name, case-
 * insensitive, with optional whitespace before the colon. Until #866 only the
 * TOKENISED names were read, so a palette tint in `box-shadow`, `outline`,
 * `border-top-color` or a custom property was invisible (Hub.ts:436 and
 * _index.css escaped that way).
 */
const DECLARATION = /(?:^|[;{\s])(--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z-]*)\s*:\s*([^;}\n]+)/g;

/**
 * Explicit, audited exemptions — a value that matches the palette but cannot be
 * written as `var()` without a canon change or a rendering change. Adding a
 * token is a canon change (§20.6), so these wait for the owner instead of
 * being forced. Each entry names the file, the rule, why, and the audit that
 * listed it. Keep the list short.
 *
 * An entry exempts a COPY of a palette token only: the custom property must be
 * named like the token and still hold the token's current value. A copy that
 * drifts from canonical-css.ts fails like any other raw colour.
 */
export const PALETTE_COPY_EXEMPTIONS: ReadonlyArray<{
  readonly file: string;
  /** Matches the selector the declaration sits under. */
  readonly selector: RegExp;
  readonly why: string;
  readonly audit: string;
}> = [
  {
    // The homepage inlines the head of _index.css as critical CSS in <head>
    // (src/pages/_index-css.ts), while canonical-css.ts's :root is emitted
    // from Footer.astro in <body> — 80 KB later in the byte stream. Until the
    // footer is parsed, var(--bg) etc. resolve only because these copies
    // exist; replacing them with var() would leave the first paint without a
    // palette. Removing the copy needs the canonical :root moved into <head>,
    // which is a page-structure change outside #866.
    file: 'src/pages/_index.css',
    selector: /^:root(?![\w-])/,
    why: 'first-paint copy of the layer-2 aliases; canonical :root arrives later in <body>',
    audit: '2026-10-07 build-gate audit P1-2 (#866)',
  },
];

/**
 * §2.1 — the palette is DEFINED in canonical-css.ts's :root (and the
 * neutralised data-theme copies of that block). A custom property
 * there written as a raw colour is the token, not an escape from it.
 */
const CANON = 'src/lib/canonical-css.ts';
function isPaletteDefinition(file: string, selector: string, property: string): boolean {
  return file === CANON && property.startsWith('--') && /^:root(?![\w-])/.test(selector);
}

function isPaletteCopy(file: string, selector: string, property: string, value: string, root: string): boolean {
  if (!PALETTE_COPY_EXEMPTIONS.some((e) => e.file === file && e.selector.test(selector))) return false;
  const canonical = paletteByName(root).get(property);
  const [rgb, ...rest] = parseColours(value);
  return canonical != null && rgb != null && rest.length === 0 && rgbKey(rgb) === canonical;
}

/**
 * rgb(r,g,b) -> token name, built from canonical-css.ts's :root.
 *
 * Cached PER ROOT: the unit tests run the gates against synthetic repos, and a
 * cache keyed on nothing would leak the real palette into them. A root with no
 * canonical-css.ts simply has an empty palette, so nothing is derivable there.
 */
const paletteCache = new Map<string, { byRgb: Map<string, string>; byName: Map<string, string> }>();
function paletteByRgb(root: string): Map<string, string> {
  return palette(root).byRgb;
}
/** token name -> rgb key */
function paletteByName(root: string): Map<string, string> {
  return palette(root).byName;
}
function palette(root: string): { byRgb: Map<string, string>; byName: Map<string, string> } {
  const cached = paletteCache.get(root);
  if (cached != null) return cached;
  const m = new Map<string, string>();
  const byName = new Map<string, string>();
  const result = { byRgb: m, byName };
  let css = '';
  try {
    css = readFileSync(join(root, 'src/lib/canonical-css.ts'), 'utf-8');
  } catch {
    paletteCache.set(root, result);
    return result;
  }
  const add = (name: string, hex: string): void => {
    const [rgb] = parseColours(hex);
    if (rgb == null) return;
    if (!m.has(rgbKey(rgb))) m.set(rgbKey(rgb), name);
    if (!byName.has(name)) byName.set(name, rgbKey(rgb));
  };
  for (const hit of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    add(hit[1] ?? '', hit[2] ?? '');
  }
  // Tokens emitted into :root from design-tokens.ts (--red-text, --risk-*) are
  // part of the palette too; they are not literal in the file's text.
  for (const [name, value] of Object.entries(DESIGN_TOKENS)) {
    if (/^#[0-9a-fA-F]{3,6}$/.test(value)) add(name, value);
  }
  paletteCache.set(root, result);
  return result;
}

/** The palette token a value's colour equals, if any. */
export function paletteTokenFor(value: string, root: string = process.cwd()): string | null {
  const pal = paletteByRgb(root);
  for (const rgb of parseColours(value)) {
    const token = pal.get(rgbKey(rgb));
    if (token != null) return token;
  }
  return null;
}

/** `var(--bg2, #FFFFFF)` is a token with a defensive fallback, not a raw colour. */
const stripVars = (value: string): string =>
  value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '');

export function findColourViolations(root: string = process.cwd()): ColourViolation[] {
  const surfaces = readLedger(root);
  const out: ColourViolation[] = [];

  for (const file of walkSource(root)) {
    const state = surfaceStateFor(file, surfaces);
    if (state == null || state === 'legacy') continue;

    const lines = stripComments(readFileSync(join(root, file), 'utf-8')).split('\n');
    let selector = '';
    lines.forEach((raw, idx) => {
      const sel = raw.match(/^\s*([^{}@]+?)\s*\{/);
      if (sel) selector = (sel[1] ?? '').trim();
      if (isUnassigned(file, selector)) return;
      const text = blankDataUris(raw);
      for (const m of text.matchAll(DECLARATION)) {
        const property = (m[1] ?? '').toLowerCase();
        const value = (m[2] ?? '').trim();
        if (isPaletteDefinition(file, selector, property)) continue;
        if (isPaletteCopy(file, selector, property, value, root)) continue;
        const known = TOKENISED.has(property);
        // Outside the original list, only CSS syntax counts: a colour inside
        // quotes there is data (`CPB: '#D96B3D'`, `CPB: { accent: '#…' }`),
        // not a CSS colour — CSS never quotes one.
        const css = known ? value : value.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, (q) => ' '.repeat(q.length));
        const bare = stripVars(css);
        if (!RAW_COLOUR.test(bare)) continue;
        // Neutral black/white shadows and highlights have no hue to tokenise.
        // Exempt only on the newly read properties, so nothing that failed
        // before #866 passes now.
        const colours = parseColours(bare);
        const unparsed = /(?<![\w-])(?:hwb|lab|lch|oklab|color)\(/i.test(bare);
        if (!known && !unparsed && colours.length > 0 && colours.every(isNeutral)) continue;
        out.push({
          file, line: idx + 1, selector, property,
          value: value.slice(0, 60), state,
          derivable: paletteTokenFor(bare, root) != null,
        });
      }
    });
  }
  return out;
}

/** A colour inside a data URI that matches no palette token. */
export interface DataUriDrift {
  readonly file: string;
  readonly line: number;
  readonly colour: string;
  readonly state: SurfaceState;
}

/**
 * Design.md §2.4 example 2 — a `data:image/svg+xml` cannot resolve `var()`, so
 * its colours are written out. That is allowed, but only while the value still
 * equals a palette token's.
 *
 * The literal hex is not the danger; the drift is. Four data URIs carry
 * `stroke='%237A6F5E'`, which is `--fg2` today. Move `--fg2` and the icons keep
 * the old colour with nothing to say so. This check is what makes the exception
 * safe to grant.
 */
export function findDataUriDrift(root: string = process.cwd()): DataUriDrift[] {
  const surfaces = readLedger(root);
  const pal = paletteByRgb(root);
  const known = new Set(
    [...pal.keys()].map((rgb) => {
      const [r, g, b] = rgb.split(',').map(Number);
      return [r, g, b]
        .map((v) => (v ?? 0).toString(16).padStart(2, '0'))
        .join('')
        .toLowerCase();
    }),
  );
  const out: DataUriDrift[] = [];

  for (const file of walkSource(root)) {
    const state = surfaceStateFor(file, surfaces);
    if (state == null || state === 'legacy') continue;
    const lines = stripComments(readFileSync(join(root, file), 'utf-8')).split('\n');
    lines.forEach((text, idx) => {
      if (!text.includes('data:image/svg+xml')) return;
      // A `rel="icon"` data URI is a brand asset, not site chrome. Its colours
      // are the mark's own — the same category as LINE's #06C755, which §2.4
      // already treats as having no palette base. The rule here is about a UI
      // icon drifting away from the token it was copied from.
      const near = lines.slice(Math.max(0, idx - 4), idx + 1).join(' ');
      if (/rel=["']icon["']|rel=["']apple-touch-icon["']/.test(near)) return;
      for (const m of text.matchAll(/%23([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
        let hex = (m[1] ?? '').toLowerCase();
        if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
        if (known.has(hex)) continue;
        out.push({ file, line: idx + 1, colour: `#${hex}`, state });
      }
    });
  }
  return out;
}
