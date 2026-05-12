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
 *   classifier used by projections. It returns `null` for missing scores
 *   and uses fractional thresholds (≤3.9 / ≤6.9) because the projection
 *   layer normalises pre-round.
 *
 *   This module's `riskClass()` is the UI-layer classifier — it always
 *   returns a concrete band ('mid' default for missing/null) and uses
 *   integer thresholds (≤3 / ≤6). Since ai_risk is an integer 0-10 in
 *   practice, the thresholds are equivalent; the difference is the
 *   defaulting behaviour at the template boundary.
 *
 *   Keep the two separate intentionally — data layer and UI layer have
 *   different contracts for missing data.
 */

export type RiskClass = 'low' | 'mid' | 'high';

/**
 * Map an AI-risk score (0-10, integer) to the CSS-class band used by
 * risk-pill / risk-card markup. `null` (occupation not yet scored)
 * defaults to 'mid' so the template still renders a neutral pill
 * rather than collapsing the layout.
 */
export function riskClass(score: number | null): RiskClass {
  if (score === null) return 'mid';
  if (score <= 3) return 'low';
  if (score <= 6) return 'mid';
  return 'high';
}
