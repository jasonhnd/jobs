/**
 * src/templates/SectorPatterns.ts — "データから見えるパターン" block
 * for the sector hub page: an AI-impact distribution bar (3 bands)
 * + a numeric legend + a list of auto-derived observations.
 *
 * Extracted from src/pages/ja/sectors/[sector].astro inline build.
 * Empty `observations` array → empty SafeHtml (no `<section>`).
 *
 * The distribution bar is three `<span>`s with `style="width:N%"`
 * — values come from src/views/sector-meta.computeSectorPatterns.
 * Counts + percentages render with 0-decimal-place rounding to
 * keep the legend chips compact (e.g. "32%").
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** Pre-computed AI-band distribution + observation strings. */
export interface SectorPatternsInput {
  readonly aiLowCount: number;
  readonly aiMidCount: number;
  readonly aiHighCount: number;
  readonly aiLowPct: number;
  readonly aiMidPct: number;
  readonly aiHighPct: number;
  readonly observations: readonly string[];
}

const H2 = 'データから見えるパターン';
const ARIA_LABEL = 'データから見えるパターン';

export function renderSectorPatterns(input: SectorPatternsInput): SafeHtml {
  if (input.observations.length === 0) return '' as SafeHtml;

  const {
    aiLowCount, aiMidCount, aiHighCount,
    aiLowPct, aiMidPct, aiHighPct,
    observations,
  } = input;

  const lowPct = aiLowPct.toFixed(0);
  const midPct = aiMidPct.toFixed(0);
  const highPct = aiHighPct.toFixed(0);

  let obsItems = '';
  for (const obs of observations) obsItems += `<li>${escapeHtml(obs)}</li>`;

  return (
    `<section class="patterns" aria-label="${escapeHtml(ARIA_LABEL)}">\n` +
    `       <h2>${escapeHtml(H2)}</h2>\n` +
    `       <div class="ai-distribution">\n` +
    `         <div class="ai-dist-bar">\n` +
    `           <span class="dist-low" style="width:${lowPct}%" title="AI 影響 低 (3 以下): ${aiLowCount} 職業"></span>\n` +
    `           <span class="dist-mid" style="width:${midPct}%" title="AI 影響 中 (4-6): ${aiMidCount} 職業"></span>\n` +
    `           <span class="dist-high" style="width:${highPct}%" title="AI 影響 高 (7+): ${aiHighCount} 職業"></span>\n` +
    `         </div>\n` +
    `         <div class="ai-dist-legend">\n` +
    `           <span><span class="ldot ldot-low"></span>低 (≤3): <strong>${aiLowCount}</strong> 職業 (${lowPct}%)</span>\n` +
    `           <span><span class="ldot ldot-mid"></span>中 (4-6): <strong>${aiMidCount}</strong> 職業 (${midPct}%)</span>\n` +
    `           <span><span class="ldot ldot-high"></span>高 (≥7): <strong>${aiHighCount}</strong> 職業 (${highPct}%)</span>\n` +
    `         </div>\n` +
    `       </div>\n` +
    `       <ul class="pattern-observations">\n` +
    `         ${obsItems}\n` +
    `       </ul>\n` +
    `     </section>`
  ) as SafeHtml;
}
