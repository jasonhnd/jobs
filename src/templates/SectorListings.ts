/**
 * src/templates/SectorListings.ts — list-style templates for the
 * sector hub page (`/sectors/{sector}`).
 *
 * Three exports for three list flavours that lived as inline
 * page-local renderers in [sector].astro:
 *
 *   renderSectorOccupationTopList — short "top-N" list with
 *     risk-pill + workers count (for Top-High / Top-Low /
 *     Top-Workers blocks).
 *   renderSectorOccupationFullList — wider full list with
 *     risk-pill only (no workers count).
 *   renderRelatedSectorsList — sibling sectors list with
 *     occupation count per row.
 *
 * The risk-pill `band-low|mid|high` class comes from src/lib/risk
 * (riskClass) — same bucketing as the per-occupation page.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { fmtInt } from '../lib/num.js';
import { riskClass } from '../lib/risk.js';

/** One row in a top-list or full-list. */
export interface SectorListOccupation {
  readonly id: number;
  /** Empty / null → falls back to "#{id}" in the rendered link. */
  readonly titleJa: string | null;
  readonly aiRisk: number | null;
  /** Only used by renderSectorOccupationTopList. */
  readonly workers?: number | null | undefined;
}

/** One row in a related-sectors list. */
export interface RelatedSectorRow {
  readonly id: string;
  readonly nameJa: string;
  readonly occupationCount: number;
}

function riskScoreText(aiRisk: number | null): string {
  return aiRisk === null || aiRisk === undefined ? '—' : `${aiRisk}/10`;
}

function listItem(
  occ: SectorListOccupation,
  showWorkers: boolean,
): string {
  const titleStr = (occ.titleJa ?? '') || `#${occ.id}`;
  const scoreStr = riskScoreText(occ.aiRisk);
  const band = riskClass(occ.aiRisk);
  const link =
    `<a href="/${occ.id}">` +
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>` +
    `${escapeHtml(titleStr)}` +
    `</a>`;
  const meta = showWorkers
    ? `<span class="meta">${fmtInt(occ.workers)} 就業者</span>`
    : '';
  return `<li>${link}${meta}</li>`;
}

/**
 * Top-N occupation list (risk-pill + workers count per row).
 * Used for Top-High / Top-Low / Top-Workers blocks on the
 * sector hub. Empty `items` → empty SafeHtml.
 */
export function renderSectorOccupationTopList(
  items: ReadonlyArray<SectorListOccupation>,
): SafeHtml {
  if (items.length === 0) return '' as SafeHtml;
  let rows = '';
  for (const o of items) rows += listItem(o, true);
  return (`<ul class="top-list">${rows}</ul>`) as SafeHtml;
}

/**
 * Full-list (risk-pill only, no workers count). Used for the
 * "all occupations" listing below the top-blocks. Empty array
 * still emits `<ul class="full-list"></ul>` to match legacy
 * behaviour (the page wraps the call unconditionally).
 */
export function renderSectorOccupationFullList(
  items: ReadonlyArray<SectorListOccupation>,
): SafeHtml {
  let rows = '';
  for (const o of items) rows += listItem(o, false);
  return (`<ul class="full-list">${rows}</ul>`) as SafeHtml;
}

/**
 * Related-sectors list (sibling-sector navigation). Empty array
 * still emits `<ul class="related-sectors"></ul>` to match
 * legacy behaviour.
 */
export function renderRelatedSectorsList(
  items: ReadonlyArray<RelatedSectorRow>,
): SafeHtml {
  let rows = '';
  for (const s of items) {
    rows +=
      `<li>` +
      `<a href="/sectors/${escapeHtml(s.id)}">` +
      `<span class="ja-name">${escapeHtml(s.nameJa)}</span>` +
      `<span class="count">${s.occupationCount} 職業</span>` +
      `</a>` +
      `</li>`;
  }
  return (`<ul class="related-sectors">${rows}</ul>`) as SafeHtml;
}
