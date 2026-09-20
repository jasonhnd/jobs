/**
 * design-gates/role-color.ts — Design.md §19.1 `check-role-color`.
 *
 * §4.7 assigns every text role a colour token. `check-contrast` reads that
 * table and asks "does the token clear §2.2?" — it never asks "does the CSS
 * actually use the token?". So `.kpi-row li strong { color: var(--accent-deep) }`
 * sailed through: the green has enough contrast, and nobody checked that the
 * role says `--ink`. The second design review (2026-09-19) found 44 such
 * declarations, including the homepage's 「高影響職業の賃金 105.7兆」 in
 * safety-green — the exact case §4.7's note warns about.
 *
 * This gate closes that half. It maps a selector to a §4.7 role by its
 * SUBJECT (the last compound — the element the declarations land on), looks
 * the role's colour token up in the canon, and fails when a `color:`
 * declaration names a different token. The expected token is never
 * hard-coded here: change the table and the gate follows.
 *
 * Scope is deliberately the roles whose selector is unambiguous. Links,
 * hover states, kickers, card names and raw score values have no §4.7 row
 * yet, so they are not matched (see the negative tests) — widening the gate
 * means adding a row to the canon first.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRoleTable, readColourTokens, type RoleRow } from './contrast.js';
import { readLedger, surfaceStateFor, type SurfaceState } from './ledger.js';
import { stripComments, walkSource } from './scan.js';

export interface RoleColourViolation {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly role: string;
  readonly expected: string;
  readonly actual: string;
  readonly state: SurfaceState;
}

/** §4.7 役割 strings, exactly as the table writes them (bold markers stripped). */
export const ROLE = {
  h1: 'ページ標題',
  h2: '区画見出し',
  h3: '小区画・カード標題',
  h4: 'カード内小見出し・FAQ 設問',
  inline: '本文中の行内強調（`strong` / `em`）',
  statLarge: '統計数値（大）',
  statMedium: '統計数値（中）',
} as const;

/**
 * Whole selectors (whitespace-normalised) that carry a role their subject
 * alone would not reveal. `.rank` is the answers page's serif number.
 */
const EXACT_SELECTORS: ReadonlyMap<string, string> = new Map([
  ['.kpi-row li strong', ROLE.statLarge],
  ['.rank', ROLE.statMedium],
  ['.qa-item summary', ROLE.h4],
]);

const RULE = /([^{};]*)\{([^{}]*)\}/g;
/** `color:` only — not background-color, border-color, -webkit-text-fill-color. */
const COLOR_DECL = /(?:^|[;{\s])color\s*:\s*([^;}]+)/g;

/** Values that defer to the parent or the canon rather than choosing a colour. */
const PASS_THROUGH = new Set(['inherit', 'currentcolor', 'unset', 'initial']);

/**
 * The §4.7 role a selector part addresses, or null when it is out of scope.
 * Matching is on the subject compound; `h1 .accent` (and the home hero's
 * `.acc`) is the title's accent word and takes the title's role.
 */
export function roleForSelector(part: string): string | null {
  const sel = part.trim().replace(/\s+/g, ' ');
  if (sel === '') return null;
  const exact = EXACT_SELECTORS.get(sel);
  if (exact != null) return exact;
  if (/\bsummary\b/.test(sel)) return null; // §4.9 exempts summary; only .qa-item summary is a role
  const compounds = sel.split(/[\s>+~]+/).filter(Boolean);
  const subject = compounds[compounds.length - 1] ?? '';
  const heading = (c: string): string | null => {
    const m = c.match(/^h([1-4])(?![0-9a-z-])/);
    return m ? ROLE[`h${m[1]}` as 'h1' | 'h2' | 'h3' | 'h4'] : null;
  };
  const direct = heading(subject);
  if (direct != null) return direct;
  if (/^\.(accent|acc)(?![a-z0-9-])/.test(subject)) {
    for (const c of compounds.slice(0, -1)) {
      const h = heading(c);
      if (h != null) return h;
    }
    return null;
  }
  if (/^(strong|em)(?![a-z0-9-])/.test(subject)) return ROLE.inline;
  return null;
}

function tokenOf(value: string): string | null {
  const m = value.trim().match(/^var\(\s*(--[a-z0-9-]+)/i);
  return m ? (m[1] ?? null) : null;
}

export function findRoleColourViolations(root: string = process.cwd()): RoleColourViolation[] {
  const rows: RoleRow[] = parseRoleTable(root);
  const expectedByRole = new Map(rows.map((r) => [r.role, r.colourToken]));
  if (expectedByRole.size === 0) return [];

  let colours = new Map<string, string>();
  try {
    colours = readColourTokens(root);
  } catch {
    // A fixture without canonical-css.ts: aliases cannot be resolved by value.
  }
  const hexOf = (token: string): string | undefined => colours.get(token)?.toLowerCase();
  const canvasHex = new Set(
    ['--paper', '--cream', '--cream-2'].map((t) => hexOf(t)).filter((h): h is string => h != null),
  );

  const surfaces = readLedger(root);
  const out: RoleColourViolation[] = [];

  for (const file of walkSource(root)) {
    // §4.7 is site-wide; an unclaimed file reports as a warning, not silence.
    const state = surfaceStateFor(file, surfaces) ?? 'migrating';
    if (state === 'legacy') continue;

    const src = stripComments(readFileSync(join(root, file), 'utf-8'));
    RULE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE.exec(src)) !== null) {
      const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ');
      const body = m[2] ?? '';
      const roles = new Set<string>();
      for (const part of selector.split(',')) {
        const r = roleForSelector(part);
        if (r != null && expectedByRole.has(r)) roles.add(r);
      }
      if (roles.size === 0) continue;

      COLOR_DECL.lastIndex = 0;
      let d: RegExpExecArray | null;
      while ((d = COLOR_DECL.exec(body)) !== null) {
        const value = (d[1] ?? '').trim();
        if (PASS_THROUGH.has(value.toLowerCase())) continue;
        const token = tokenOf(value);
        for (const role of roles) {
          const expected = expectedByRole.get(role) ?? '';
          if (token === expected) continue;
          // A layer-2 alias with the same hex (--fg for --ink) is the same colour.
          if (token != null && hexOf(token) != null && hexOf(token) === hexOf(expected)) continue;
          // Text on a dark fill (CTA band on --ink, primary button) is set in a
          // page-canvas colour — §4.7's ボタン（主） row models it as --paper.
          // The table's colours are for the three §2.2 page backgrounds only.
          if (token != null && canvasHex.has(hexOf(token) ?? '')) continue;
          out.push({
            file,
            line: src.slice(0, m.index).split('\n').length,
            selector,
            role,
            expected,
            actual: value,
            state,
          });
        }
      }
    }
  }
  return out;
}
