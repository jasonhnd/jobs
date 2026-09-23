/**
 * src/lib/risk.ts — UI-side risk classifier for CSS-class output.
 *
 * Replaces 5 identical implementations across src/data/lib/ (compare-hub,
 * genre-hub, interests, ranking-renderers, skills-hub). All produced the
 * same 3-bucket classification used for `class="risk-pill {band}"` and
 * similar template hooks.
 *
 * Relationship to src/data/lib/bands.ts:
 *   bands.ts exports `riskBand(): RiskBand | null` — the DATA-layer
 *   classifier used by projections. It returns `null` for missing scores.
 *
 *   This module's `riskClass()` is the UI-layer classifier — it always
 *   returns a concrete band ('mid' default for missing/null). Both classify
 *   the DISPLAYED value (`displayScore()`, one-decimal banker rounding) with
 *   the same cut points, low < 4.0 <= mid < 7.0 <= high: a three-vendor mean
 *   of 3.9666… prints 4.0 and is mid (docs/DATA_ARCHITECTURE.md, owner rule
 *   2026-09-24, #631). The only difference is the defaulting behaviour at the
 *   template boundary.
 *
 *   Keep the two separate intentionally — data layer and UI layer have
 *   different contracts for missing data.
 */
import { displayScore } from '../data/lib/banker-round.js';

export type RiskClass = 'low' | 'mid' | 'high';

/**
 * Map an AI-risk score (0-10) to the CSS-class band of the value the site
 * displays (used by risk-pill / risk-card markup). `null` (occupation not
 * yet scored) defaults to 'mid' so the template still renders a neutral pill
 * rather than collapsing the layout.
 */
export function riskClass(score: number | null): RiskClass {
  if (score === null) return 'mid';
  const shown = Number.isFinite(score) ? displayScore(score) : score;
  if (shown < 4.0) return 'low';
  if (shown < 7.0) return 'mid';
  return 'high';
}
