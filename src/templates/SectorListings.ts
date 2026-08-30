/**
 * src/templates/SectorListings.ts — list-style templates for the
 * sector hub page (`/sectors/{sector}`).
 *
 * Occupation rows use the MOBILE_SHAPES §3.3 atom (`a.rl-row`,
 * `list_row_click`) so the full list and the three folded TOP5
 * blocks share the #321 tap contract (#328 family 2). Related
 * sectors stay a sibling-nav list, not occupation rows.
 *
 *   renderSectorOccupationTopList — TOP5 with workers in `.rl-meta`.
 *   renderSectorOccupationFullList — full AI-risk-desc list, pill only.
 *   renderRelatedSectorsList — sibling sectors with occupation count.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { fmtInt } from '../lib/num.js';
import { riskClass } from '../lib/risk.js';
import { occupationPath } from '../lib/urls.js';

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
  const metaHtml = showWorkers
    ? `<span class="rl-meta"><span class="rl-workers">${fmtInt(occ.workers)} 就業者</span></span>`
    : '';
  return (
    `<li>` +
    `<a class="rl-row" href="${occupationPath(occ.id)}" data-track-event="list_row_click">` +
    `<span class="rl-main">` +
    `<span class="rl-name">${escapeHtml(titleStr)}</span>` +
    `${metaHtml}` +
    `</span>` +
    `<span class="rl-end">` +
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>` +
    `<span class="rl-chevron" aria-hidden="true">›</span>` +
    `</span>` +
    `</a>` +
    `</li>`
  );
}

function rankList(items: ReadonlyArray<SectorListOccupation>, showWorkers: boolean): string {
  let rows = '';
  for (const o of items) rows += listItem(o, showWorkers);
  return `<ol class="rank-list">${rows}</ol>`;
}

/**
 * Top-N occupation list (workers count in `.rl-meta`).
 * Used for Top-High / Top-Low / Top-Workers blocks on the
 * sector hub. Empty `items` → empty SafeHtml.
 */
export function renderSectorOccupationTopList(
  items: ReadonlyArray<SectorListOccupation>,
): SafeHtml {
  if (items.length === 0) return '' as SafeHtml;
  return rankList(items, true) as SafeHtml;
}

/**
 * Full-list (risk-pill only, no workers count). Used for the
 * first-screen payload (#328 family 2). Empty array still emits
 * the `<ol class="rank-list"></ol>` wrapper (the page wraps the
 * call unconditionally).
 */
export function renderSectorOccupationFullList(
  items: ReadonlyArray<SectorListOccupation>,
): SafeHtml {
  return rankList(items, false) as SafeHtml;
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
