/**
 * src/templates/ProfileRadar.ts — 5-axis radar chart + legend for the
 * occupation detail page.
 *
 * Extracted from src/pages/ja/[id].astro (`renderProfileRadar`).
 * Renders a `<section class="profile">` containing an inline SVG
 * pentagon chart and a `<dl class="radar-legend">` value list.
 *
 * Axes (clockwise from top): 創造性 / 対人 / 判断 / 身体 / 定型.
 * The label set + geometry constants are part of the visual contract
 * and live inside the template — callers only supply the five numeric
 * values resolved from `graph.occupations.get(id).profile5` (Phase E
 * follow-up 2026-05-16; the legacy `getProfile5()[occId]` fs loader
 * was retired).
 *
 * Gating: empty SafeHtml when every axis is 0/null (no entry in the
 * profile lookup, or all-zero record). Matches the page-level
 * `if (!values.some(v => v)) return ''`.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** Five-axis profile values (0-100). null/undefined coerce to 0; an
 *  all-zero input collapses the whole block. */
export interface ProfileRadarInput {
  readonly creative: number | null | undefined;
  readonly social: number | null | undefined;
  readonly judgment: number | null | undefined;
  readonly physical: number | null | undefined;
  readonly routine: number | null | undefined;
}

// Geometry — kept in module scope so the constants are computed once
// and shared across all calls. The values are pinned by the SEO
// baseline snapshot (viewBox 0 0 340 340, radius 130).
const CX = 170;
const CY = 170;
const R = 130;
const LABELS: readonly string[] = ['創造性', '対人', '判断', '身体', '定型'];
const GRID_LEVELS: readonly number[] = [0.25, 0.5, 0.75, 1.0];
const H2 = '5 次元プロファイル';

export function renderProfileRadar(input: ProfileRadarInput): SafeHtml {
  const values = [
    input.creative ?? 0,
    input.social ?? 0,
    input.judgment ?? 0,
    input.physical ?? 0,
    input.routine ?? 0,
  ];
  if (!values.some((v) => v)) return '' as SafeHtml;

  // Data polygon (filled, orange tint).
  const pts: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const ang = ((-90 + i * 72) * Math.PI) / 180;
    const scale = (values[i] || 0) / 100;
    const x = CX + Math.cos(ang) * R * scale;
    const y = CY + Math.sin(ang) * R * scale;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  // Grid backdrop (4 concentric pentagons).
  let gridLayers = '';
  for (const level of GRID_LEVELS) {
    const layer: string[] = [];
    for (let i = 0; i < 5; i++) {
      const ang = ((-90 + i * 72) * Math.PI) / 180;
      const x = CX + Math.cos(ang) * R * level;
      const y = CY + Math.sin(ang) * R * level;
      layer.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    gridLayers +=
      `<polygon points="${layer.join(' ')}" fill="none" stroke="rgba(36,30,24,0.10)" stroke-width="1"/>`;
  }

  // Axis labels placed just outside R.
  let labelHtml = '';
  for (let i = 0; i < LABELS.length; i++) {
    const ang = ((-90 + i * 72) * Math.PI) / 180;
    const lx = CX + Math.cos(ang) * (R + 22);
    const ly = CY + Math.sin(ang) * (R + 22);
    labelHtml +=
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="middle" ` +
      `font-size="13" font-family="Plus Jakarta Sans, sans-serif" ` +
      `font-weight="600" fill="#7A6F5E" letter-spacing="0.04em">` +
      `${escapeHtml(LABELS[i])}</text>`;
  }

  // Numeric legend underneath the chart.
  let legend = '';
  for (let i = 0; i < LABELS.length; i++) {
    legend += `<dt>${escapeHtml(LABELS[i])}</dt><dd>${Math.trunc(values[i])}</dd>`;
  }

  return (
    `<section class="profile" aria-label="${escapeHtml(H2)}">` +
    `<h2>${escapeHtml(H2)}</h2>` +
    `<div class="radar-wrap">` +
    `<svg class="radar-svg" viewBox="0 0 340 340" role="img" aria-label="${escapeHtml(H2)}">` +
    `${gridLayers}` +
    `<polygon points="${pts.join(' ')}" fill="rgba(217,107,61,0.18)" stroke="#D96B3D" stroke-width="2.5" stroke-linejoin="round"/>` +
    `${labelHtml}` +
    `</svg>` +
    `<dl class="radar-legend">${legend}</dl>` +
    `</div>` +
    `</section>`
  ) as SafeHtml;
}
