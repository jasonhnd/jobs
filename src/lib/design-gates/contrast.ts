/**
 * design-gates/contrast.ts — Design.md §19.1 `check-contrast`.
 *
 * §2.2 is a contract with no exemptions: AA 4.5:1, except that WCAG 2.1's
 * "large text" (**>=24px, or >=18.66px at weight 700**) may sit at 3.0:1.
 *
 * The trap this encodes: H2 is 22px and H3 is 18px, and NEITHER qualifies as
 * large text. 22 < 24 and 18 < 18.66. Everything from H2 down needs the full
 * 4.5:1. The canon calls this out because it is easy to get wrong in the
 * lenient direction.
 *
 * The checker reads §4.7's role table out of the canon rather than restating
 * it, so adding a role row automatically puts it under test.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_TOKENS } from '../design-tokens.js';

export interface RoleRow {
  readonly role: string;
  readonly sizeToken: string;
  readonly family: 'serif' | 'sans' | 'mono';
  readonly weight: number;
  readonly colourToken: string;
}

export interface ContrastProblem {
  readonly role: string;
  readonly colourToken: string;
  readonly background: string;
  readonly ratio: number;
  readonly required: number;
  readonly px: number;
  readonly weight: number;
}

/** Backgrounds a foreground can legally sit on (§2.2 実測コントラスト比 table). */
export const BACKGROUNDS = ['--cream', '--paper', '--cream-2'] as const;

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG 2.1 puts large text at >=24px, or >=18.66px at weight >=700 — but the
 * canon is STRICTER than WCAG here, on purpose.
 *
 * §2.2 states that on this site only Display and H1 count as large text, and
 * that H2 must clear the full 4.5:1 even though it is 22px and inherits the UA
 * bold. The reason is §4.5: the shipped serif is a single file registered for
 * 400-700 and renders identically at every one of them (measured 595.97px
 * ×4). A face that cannot render bold cannot claim the bold allowance.
 *
 * So the weight-based allowance applies to SANS only. For serif, only the
 * >=24px rule can grant it — which is exactly "Display and H1 only".
 */
export function requiredRatio(px: number, weight: number, family: 'serif' | 'sans' | 'mono' = 'sans'): number {
  const boldAllowance = family !== 'serif' && px >= 18.66 && weight >= 700;
  return px >= 24 || boldAllowance ? 3.0 : 4.5;
}

/** Hex values live in canonical-css.ts's :root (§18.4 — the only one). */
export function readColourTokens(root: string = process.cwd()): Map<string, string> {
  const css = readFileSync(join(root, 'src/lib/canonical-css.ts'), 'utf-8');
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    out.set(m[1] ?? '', m[2] ?? '');
  }
  return out;
}

/** §4.2 sizes are px except Display, whose clamp maxes at 40px. */
export function tokenPx(sizeToken: string): number | null {
  const raw = DESIGN_TOKENS[sizeToken];
  if (raw == null) return null;
  const clamp = raw.match(/clamp\([^,]+,[^,]+,\s*([0-9.]+)px\)/);
  if (clamp) return Number.parseFloat(clamp[1] ?? '0');
  const px = raw.match(/^([0-9.]+)px$/);
  return px ? Number.parseFloat(px[1] ?? '0') : null;
}

/** Parse §4.7 役割別 早見表 — | 役割 | サイズ | 書体 | 字重 | 色 | 備考 | */
export function parseRoleTable(root: string = process.cwd()): RoleRow[] {
  const md = readFileSync(join(root, 'docs/Design.md'), 'utf-8').replace(/\r\n/g, '\n');
  const start = md.indexOf('## §4.7');
  const end = md.indexOf('## §4.8', start === -1 ? 0 : start);
  const section = start === -1 ? '' : md.slice(start, end === -1 ? undefined : end);
  const rows: RoleRow[] = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim().replace(/\*\*/g, ''));
    if (c.length < 5) continue;
    const size = (c[1] ?? '').match(/`(--t-[a-z0-9]+)`/)?.[1];
    const colour = (c[4] ?? '').match(/`(--[a-z0-9-]+)`/)?.[1];
    if (size == null || colour == null) continue;
    const weights = [...(c[3] ?? '').matchAll(/(\d{3})/g)].map((m) => Number(m[1]));
    const fam = (c[2] ?? '');
    rows.push({
      role: c[0] ?? '',
      sizeToken: size,
      family: fam.includes('serif') ? 'serif' : fam.includes('mono') ? 'mono' : 'sans',
      // 単一 (single weight) means serif; the canon writes no number there.
      weight: weights.length > 0 ? Math.max(...weights) : 400,
      colourToken: colour,
    });
  }
  return rows;
}

export function findContrastProblems(root: string = process.cwd()): ContrastProblem[] {
  const colours = readColourTokens(root);
  const problems: ContrastProblem[] = [];
  for (const row of parseRoleTable(root)) {
    const fg = colours.get(row.colourToken);
    const px = tokenPx(row.sizeToken);
    if (fg == null || px == null) continue;
    // --paper as a FOREGROUND is button text on a coloured fill; §2.2's table
    // covers foregrounds on the three page backgrounds only.
    if (row.colourToken === '--paper') continue;
    for (const bgToken of BACKGROUNDS) {
      const bg = colours.get(bgToken);
      if (bg == null) continue;
      const ratio = contrastRatio(fg, bg);
      const required = requiredRatio(px, row.weight, row.family);
      if (ratio + 0.005 < required) {
        problems.push({
          role: row.role, colourToken: row.colourToken, background: bgToken,
          ratio: Math.round(ratio * 100) / 100, required, px, weight: row.weight,
        });
      }
    }
  }
  return problems;
}
