/**
 * src/templates/SectorChart.ts — shared sector-breakdown bar chart.
 *
 * Replaces 3 identical `renderSectorChart` copies under src/data/lib/
 * (genre-hub, interests, skills-hub). All produced byte-equivalent
 * markup from `(breakdown, title)`; this is the single source of
 * truth they now re-export.
 *
 * Note: ranking-renderers also has a `renderSectorChart` but with a
 * DIFFERENT signature `(items: Occupation[])` that internally builds
 * the breakdown. That one keeps its own implementation until its
 * input shape is unified in a later step.
 *
 * Layout: each row is a horizontal bar `<sb-label> <sb-track/sb-fill>
 * <sb-count>` with bar width relative to the largest bucket (= 100%).
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

export type SectorBreakdownEntry = readonly [sector: string, count: number];

export function renderSectorChart(
  breakdown: ReadonlyArray<SectorBreakdownEntry>,
  title: string,
): SafeHtml {
  if (breakdown.length === 0) return '' as SafeHtml;
  const maxCount = breakdown[0]![1];
  let rows = '';
  for (const [sec, cnt] of breakdown) {
    const pct = Math.trunc((cnt / maxCount) * 100);
    rows +=
      `<div class="sb-row">` +
      `<span class="sb-label">${escapeHtml(sec)}</span>` +
      `<span class="sb-track"><span class="sb-fill" style="width:${pct}%"></span></span>` +
      `<span class="sb-count">${cnt}件</span>` +
      `</div>`;
  }
  return (
    `<div class="sector-chart">` +
    `<div class="sc-title">${escapeHtml(title)}</div>` +
    `${rows}` +
    `</div>`
  ) as SafeHtml;
}
