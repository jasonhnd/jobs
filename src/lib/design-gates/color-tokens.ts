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

/** Properties whose colour the canon tokenises (§2.1 / §2.2). */
const TOKENISED = /(?:^|[;{\s])(color|background|background-color|border-color|border(?:-top|-right|-bottom|-left)?|fill|stroke|outline-color)\s*:\s*([^;}\n]+)/g;
const RAW = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

/**
 * Ranges with no token in the canon. Each is in DESIGN_CONFORMANCE.md's
 * 正典にトークンが無い値 note and needs an owner decision before it can be
 * enforced — adding a token is a MINOR revision (§20.1), which only the owner
 * may make (§20.6).
 */
const NO_TOKEN_YET: ReadonlyArray<{ file: string; test: RegExp; why: string }> = [
  {
    // A data URI cannot resolve var(), so the colour has to be written out.
    // §2.4 example 2 allows it ON CONDITION that the value equals a palette
    // token's — checked separately by findDataUriDrift below, because the real
    // risk is not the literal hex, it is the icon silently keeping an old
    // colour after the token moves.
    file: '',
    test: /data:image\/svg\+xml/,
    why: 'var() does not work inside a data URI (value verified against the palette)',
  },
];

function exempt(file: string, line: string): boolean {
  return NO_TOKEN_YET.some((e) => (e.file === '' || e.file === file) && e.test.test(line));
}

/**
 * rgb(r,g,b) -> token name, built from canonical-css.ts's :root.
 *
 * Cached PER ROOT: the unit tests run the gates against synthetic repos, and a
 * cache keyed on nothing would leak the real palette into them. A root with no
 * canonical-css.ts simply has an empty palette, so nothing is derivable there.
 */
const paletteCache = new Map<string, Map<string, string>>();
function paletteByRgb(root: string): Map<string, string> {
  const cached = paletteCache.get(root);
  if (cached != null) return cached;
  const m = new Map<string, string>();
  let css = '';
  try {
    css = readFileSync(join(root, 'src/lib/canonical-css.ts'), 'utf-8');
  } catch {
    paletteCache.set(root, m);
    return m;
  }
  for (const hit of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    let h = (hit[2] ?? '').replace('#', '');
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const key = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).join(',');
    if (!m.has(key)) m.set(key, hit[1] ?? '');
  }
  paletteCache.set(root, m);
  return m;
}

function isPaletteDerived(value: string, root: string): boolean {
  const pal = paletteByRgb(root);
  for (const m of value.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    if (pal.has(`${m[1]},${m[2]},${m[3]}`)) return true;
  }
  return false;
}

export function findColourViolations(root: string = process.cwd()): ColourViolation[] {
  const surfaces = readLedger(root);
  const out: ColourViolation[] = [];

  for (const file of walkSource(root)) {
    const state = surfaceStateFor(file, surfaces);
    if (state == null || state === 'legacy') continue;

    const lines = stripComments(readFileSync(join(root, file), 'utf-8')).split('\n');
    let selector = '';
    lines.forEach((text, idx) => {
      const sel = text.match(/^\s*([^{}@]+?)\s*\{/);
      if (sel) selector = (sel[1] ?? '').trim();
      if (isUnassigned(file, selector) || exempt(file, text)) return;
      for (const m of text.matchAll(TOKENISED)) {
        const property = m[1] ?? '';
        const value = (m[2] ?? '').trim();
        // `var(--bg2, #FFFFFF)` is a token with a defensive fallback, not a raw
        // colour. Strip the var() calls before looking for one.
        const bare = value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '');
        if (!RAW.test(bare)) continue;
        out.push({
          file, line: idx + 1, selector, property,
          value: value.slice(0, 60), state,
          derivable: isPaletteDerived(bare, root),
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
