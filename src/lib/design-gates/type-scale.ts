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
import { readLedger, surfaceStateFor, type SurfaceState } from './ledger.js';
import { isUnassigned, stripComments, walkSource } from './scan.js';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly value: string;
  readonly state: SurfaceState;
}

const FONT_SIZE = /font-size:\s*([^;}\n]+)/g;
const TOKEN = /^var\(--t-[a-z0-9]+\)$/;

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

    const lines = stripComments(readFileSync(join(root, file), 'utf-8')).split('\n');
    let selector = '';
    lines.forEach((text, idx) => {
      const sel = text.match(/^\s*([^{}@]+?)\s*\{/);
      if (sel) selector = (sel[1] ?? '').trim();
      for (const m of text.matchAll(FONT_SIZE)) {
        const value = (m[1] ?? '').replace(/!important/, '').trim();
        if (TOKEN.test(value)) continue;
        if (isRootSizing(selector, value)) continue;
        if (isUnassigned(file, selector)) continue;
        out.push({ file, line: idx + 1, selector, value, state });
      }
    });
  }
  return out;
}
