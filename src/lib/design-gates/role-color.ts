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
 * Scope is deliberately explicit: established card-title, metadata, paired
 * label, raw-score and navigation consumers are mapped below. Ordinary link
 * interaction states, kicker branding, deltas and decorative numbers remain
 * unresolved. A selector name alone is never evidence of a semantic role.
 * This source gate checks declared colours and locally provable dark fills;
 * computed inheritance and responsive backgrounds require rendered checks.
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
  rawScore: 'ID・スコア生値',
  cardMeta: 'カードのメタ情報',
  label: '項目ラベル（値と対）',
  statLabel: '統計ラベル',
  caption: 'caption・出典',
  breadcrumb: 'パンくず',
  navigation: 'グローバルナビ',
  listText: '表セル（文字）',
} as const;

/**
 * Whole selectors (whitespace-normalised) that carry a role their subject
 * alone would not reveal. `.rank` is the answers page's serif number.
 */
const EXACT_SELECTORS: ReadonlyMap<string, string> = new Map([
  ['.kpi-row li strong', ROLE.statLarge],
  ['.rank', ROLE.statMedium],
  ['.qa-item summary', ROLE.h4],
  // /<id>: the two AIOIS-10 index numbers, the consensus score, the model-history rows
  ['.aio-idx-num', ROLE.statLarge],
  ['.aio-idx.idx-t .aio-idx-num', ROLE.statLarge],
  ['.aio-idx.idx-d .aio-idx-num', ROLE.statLarge],
  ['.score-num', ROLE.statLarge],
  ['.score-history-item-facts .sh-num', ROLE.statMedium],
  // mono --t-xs raw values on hub / skill / detail cards
  ['.genre-score', ROLE.rawScore],
  ['.skill-score', ROLE.rawScore],
  ['.srn-card .srn-risk', ROLE.rawScore],
  ['.score-value', ROLE.rawScore],
  ['.stat dd', ROLE.statMedium],
  // Confirmed title text only; unrelated descendants and interactive states
  // do not acquire a heading role by proximity or by a name/title substring.
  ['.vendor-card h3 a', ROLE.h3],
  ['.sc-name', ROLE.h3],
  ['.sci-name', ROLE.h3],
  ['.gci-name', ROLE.h3],
  ['.iri-name', ROLE.h3],
  ['.m-top10-card-name', ROLE.h3],
  ['.transfer-card .tc-name', ROLE.h3],
  ['.rr-title', ROLE.h3],
  ['.ranking-group-title', ROLE.h3],
  ['.home-door-title', ROLE.h3],
  ['.topn-block .topn-name', ROLE.listText],
  ['section.related .r-name', ROLE.listText],
  ['.rank-list .rl-name', ROLE.listText],
  ['.mover-name', ROLE.listText],
  ['.vendor-history-date', ROLE.cardMeta],
  ['.vendor-history-count', ROLE.caption],
  ['.vendor-facts dt', ROLE.label],
  ['.current-model-card dt', ROLE.label],
  ['.profile-box dt', ROLE.label],
  ['.stat dt', ROLE.statLabel],
  ['.score-history-current-date', ROLE.caption],
  ['.score-history-item-model span', ROLE.caption],
  ['.score-history-item-facts dt', ROLE.label],
  ['.crumb', ROLE.breadcrumb],
  ['.crumb a', ROLE.breadcrumb],
  ['nav.crumb', ROLE.breadcrumb],
  ['nav.crumb a', ROLE.breadcrumb],
  ['html body nav.top-nav a:not(.top-nav-brand)', ROLE.navigation],
]);

const RULE = /([^{};`]*)\{([^{}]*)\}/g;
/** `color:` only — not background-color, border-color, -webkit-text-fill-color. */
const COLOR_DECL = /(?:^|[;{\s])color\s*:\s*([^;}]+)/g;

/** Values that defer to the parent or the canon rather than choosing a colour. */
const PASS_THROUGH = new Set(['inherit', 'currentcolor', 'unset', 'initial']);

/**
 * The §4.7 role a selector part addresses, or null when it is out of scope.
 * Matching is on the subject compound; `h1 .accent` (and the home hero's
 * `.acc`) is the title's accent word and takes the title's role.
 */
// Breadcrumb coverage is limited to the A06 consumers claimed by this issue.
// Other page overrides need their own inventory; do not widen this repair by
// treating every identically named class as an approved consumer.
const BREADCRUMB_FILES = new Set([
  'src/lib/canonical/hub.ts', 'src/lib/canonical/doc.ts',
  'src/lib/canonical/static.ts', 'src/lib/canonical/detail.ts',
  'src/pages/models.astro', 'src/pages/models/[model].astro',
  'src/pages/sectors/index.astro', 'src/pages/skills/index.astro',
  'src/pages/skills/[skill].astro', 'src/pages/interests/index.astro',
  'src/pages/interests/[type].astro', 'src/pages/rankings/index.astro',
  'src/pages/compare/[pair].astro',
]);

export function roleForSelector(part: string, file?: string): string | null {
  const sel = part.replace(/^[\s\S]*<style[^>]*>/i, '').trim().replace(/\s+/g, ' ');
  if (sel === '') return null;
  // The base role does not settle parked link/hover/focus state semantics.
  // Pseudo-elements may carry independent decorative or badge content.
  if (/:(?:hover|focus(?:-visible|-within)?|active)\b|::[a-z-]+/i.test(sel)) return null;
  const exact = EXACT_SELECTORS.get(sel);
  if (exact === ROLE.breadcrumb && file != null && !BREADCRUMB_FILES.has(file.replace('src/pages/pro/', 'src/pages/'))) return null;
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
  // The title's accent word and a numbered heading's numeral are the heading.
  if (/^\.(accent|acc|num)(?![a-z0-9-])/.test(subject)) {
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
    // Resolve only same-file, literal selector contexts. This is deliberately
    // not a substitute for the browser cascade: do not guess a dark background
    // from a class name or from a white foreground token.
    const backgrounds = new Map<string, string>();
    for (const rule of src.matchAll(new RegExp(RULE.source, 'g'))) {
      for (const decl of (rule[2] ?? '').matchAll(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;}]+)/g)) {
        const value = (decl[1] ?? '').trim();
        for (const part of (rule[1] ?? '').split(',')) {
          backgrounds.set(part.replace(/^[\s\S]*<style[^>]*>/i, '').trim().replace(/\s+/g, ' '), value);
        }
      }
    }
    const hasDarkFill = (part: string): boolean => {
      // Descendant/child prefixes can prove a declared ancestor fill. Stop at
      // the first declared surface: a light child cannot borrow a dark parent.
      let context = part.trim().replace(/\s+/g, ' ');
      while (context !== '') {
        // A simple class/tag rule also applies to this compound even when it
        // was not written with the complete ancestor selector.
        const compound = context.split(/\s+|>/).filter(Boolean).at(-1) ?? context;
        const bg = backgrounds.get(context) ?? backgrounds.get(compound);
        if (bg != null) {
          const token = tokenOf(bg);
          if (token == null || !/^var\(\s*--[a-z0-9-]+\s*\)\s*$/i.test(bg)) return false;
          return ['--ink', '--orange-hot'].some((t) => hexOf(t) != null && hexOf(t) === hexOf(token));
        }
        // Sibling selectors do not establish ancestry.
        if (/[+~]/.test(context)) return false;
        const parent = context.replace(/(?:\s*>\s*|\s+)[^\s>]+$/, '').trim();
        if (parent === context) break;
        context = parent;
      }
      return false;
    };
    RULE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RULE.exec(src)) !== null) {
      const selector = (m[1] ?? '').replace(/^[\s\S]*<style[^>]*>/i, '').trim().replace(/\s+/g, ' ');
      const body = m[2] ?? '';
      const subjects: { selector: string; role: string }[] = [];
      for (const part of selector.split(',')) {
        const r = roleForSelector(part, file);
        if (r != null && expectedByRole.has(r)) subjects.push({ selector: part, role: r });
      }
      if (subjects.length === 0) continue;

      COLOR_DECL.lastIndex = 0;
      let d: RegExpExecArray | null;
      while ((d = COLOR_DECL.exec(body)) !== null) {
        const value = (d[1] ?? '').trim();
        if (PASS_THROUGH.has(value.toLowerCase())) continue;
        const token = tokenOf(value);
        for (const { selector: part, role } of subjects) {
          const expected = expectedByRole.get(role) ?? '';
          if (token === expected) continue;
          // A layer-2 alias with the same hex (--fg for --ink) is the same colour.
          if (token != null && hexOf(token) != null && hexOf(token) === hexOf(expected)) continue;
          // Text on a dark fill (CTA band on --ink, primary button) is set in a
          // page-canvas colour — §4.7's ボタン（主） row models it as --paper.
          // The table's colours are for the three §2.2 page backgrounds only.
          if (token != null && canvasHex.has(hexOf(token) ?? '') && hasDarkFill(part)) continue;
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
