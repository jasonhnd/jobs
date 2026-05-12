/**
 * src/templates/Topn.ts — "required skills / knowledge / abilities"
 * three-column list for the occupation detail page.
 *
 * Extracted from src/pages/ja/[id].astro (`renderTopn`). Renders
 * `<section class="topn">` with up to three `<div class="topn-block">`
 * children, one per category. Each block is an `<ol>` of items with
 * a label + a one-decimal score (e.g. `4.8`).
 *
 * Gating: empty SafeHtml when ALL THREE arrays are empty. A single
 * empty category drops just its `<div class="topn-block">` (the
 * surrounding `<section>` still renders).
 *
 * Item scoring uses `toFixed(1)` — `score ?? 0` then format. Matches
 * the legacy renderer byte-for-byte (e.g. `null` → `0.0`, integer
 * `4` → `4.0`).
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** One ranked item — label + score in 0-5 scale (typical for O*NET data). */
export interface TopnEntry {
  readonly labelJa: string | null;
  readonly score: number | null;
}

export interface TopnInput {
  readonly skills: ReadonlyArray<TopnEntry>;
  readonly knowledge: ReadonlyArray<TopnEntry>;
  readonly abilities: ReadonlyArray<TopnEntry>;
}

const H2 = '必要なスキル・知識・能力';
const SKILLS_TITLE = 'スキル Top 10';
const KNOWLEDGE_TITLE = '知識 Top 5';
const ABILITIES_TITLE = '能力 Top 5';

function renderBlock(title: string, items: ReadonlyArray<TopnEntry>): string {
  if (items.length === 0) return '';
  let lis = '';
  for (const it of items) {
    const lab = it.labelJa ?? '';
    const score = (it.score ?? 0).toFixed(1);
    lis +=
      `<li>` +
      `<span class="topn-name">${escapeHtml(lab)}</span>` +
      `<span class="topn-score">${score}</span>` +
      `</li>`;
  }
  return `<div class="topn-block"><h3>${escapeHtml(title)}</h3><ol>${lis}</ol></div>`;
}

export function renderTopn(input: TopnInput): SafeHtml {
  const { skills, knowledge, abilities } = input;
  if (skills.length === 0 && knowledge.length === 0 && abilities.length === 0) {
    return '' as SafeHtml;
  }
  const body =
    renderBlock(SKILLS_TITLE, skills) +
    renderBlock(KNOWLEDGE_TITLE, knowledge) +
    renderBlock(ABILITIES_TITLE, abilities);
  return (
    `<section class="topn" aria-label="${escapeHtml(H2)}">` +
    `<h2>${escapeHtml(H2)}</h2>` +
    `<div class="topn-grid">${body}</div>` +
    `</section>`
  ) as SafeHtml;
}
