/**
 * Multi-axis band derivations — per docs/DATA_ARCHITECTURE.md §6.11.
 *
 * Pure helpers; no I/O. Used by treemap / search / detail projections to attach
 * non-sector classification axes to each occupation record. All bands share the
 * same shape: a small literal-typed string ('low'/'mid'/'high'-style).
 *
 * Why these specific axes?
 *   - risk_band       : the obvious one — drives the design's sage/sand/terracotta
 *                        three-color visual language.
 *   - workforce_band  : "is this a niche profession or one that hires millions?"
 *                        Useful for ranking weight, treemap area normalization,
 *                        and "you should also know" recommendations.
 *   - demand_band     : "is the labor market hot for this job right now?"
 *                        Drives the "今、求められている" hint and 詳細 page tag.
 *
 * Thresholds are documented constants — don't tune in projection code.
 *
 * ─── Location decision (Phase D/E follow-up, 2026-05-16) ──────────────────
 *
 * Stays in `src/data/lib/` — DELIBERATE despite cross-layer consumers.
 *
 * Consumers split across two layers:
 *   - Data layer (`src/data/projections/{detail,search,treemap}.ts`) —
 *     attaches band strings to each emitted record at build time.
 *   - View layer (`src/views/{ranking,interest,skill,occupation-detail}.ts`)
 *     — re-derives bands at render time when the projection's band string
 *     would be wrong context (e.g., per-page filtered subsets).
 *
 * Naively this looks like it should move up to `src/lib/` for cross-layer
 * reuse. The reason it doesn't:
 *
 *   This file is the *data classifier* (numeric threshold → band string).
 *   Its UI counterpart `src/lib/risk.ts` is the *render mapper* (band
 *   string → Direction C token / icon / aria-label). Splitting "what band
 *   is this number" from "how does this band look on screen" is the same
 *   data/render split the 5-layer architecture enforces everywhere else.
 *
 *   View layer importing this is identical in role to view layer importing
 *   `src/data/schema/*.ts` — reading the data layer's classification rules
 *   without inverting the dependency direction.
 *
 * Do not merge into `src/lib/risk.ts`; the split is the point.
 */

// ───── Risk band ─────
// Aligned with the Direction C design tokens: .risk-low / .risk-mid / .risk-high.
export type RiskBand = 'low' | 'mid' | 'high';
// Half-open intervals (decimal-safe): [0,4.0) low / [4.0,7.0) mid / [7.0,10] high.
// Boundary moved 3.9→4.0 / 6.9→7.0 for one-decimal scores; integer scores unaffected.
export const RISK_LOW_MAX = 4.0; // < 4.0 → low (sage)
export const RISK_MID_MAX = 7.0; // < 7.0 → mid (sand); ≥ 7.0 → high (terracotta)

/** Map ai_risk score (0-10) to design's three-color risk band. */
export function riskBand(aiRisk: number | null | undefined): RiskBand | null {
  if (aiRisk === null || aiRisk === undefined) return null;
  if (aiRisk < RISK_LOW_MAX) return 'low';
  if (aiRisk < RISK_MID_MAX) return 'mid';
  return 'high';
}

// ───── Workforce band ─────
// Tuned against the actual distribution of `stats_legacy.workers`:
//   p33 ≈ 18,000 / p67 ≈ 70,000
// Hard-coded so a single record's classification doesn't depend on what other
// records exist (deterministic across re-builds).
export type WorkforceBand = 'small' | 'mid' | 'large';
export const WORKFORCE_SMALL_MAX = 20_000; // < 2万人 → small / niche
export const WORKFORCE_MID_MAX = 100_000; // 2万-10万人 → mid
//                                              // > 10万人 → large

/** Map total workforce (people) to a 3-bucket size band. */
export function workforceBand(workers: number | null | undefined): WorkforceBand | null {
  if (workers === null || workers === undefined) return null;
  if (workers < WORKFORCE_SMALL_MAX) return 'small';
  if (workers < WORKFORCE_MID_MAX) return 'mid';
  return 'large';
}

// ───── Demand band ─────
// 有効求人倍率 (effective job opening ratio). >1.0 = labor undersupplied.
// 0.0-1.0  = "cold" (more applicants than openings)
// 1.0-2.0  = "normal"
// >2.0     = "hot" (acute labor shortage — careers like 介護 / 建設 are here)
export type DemandBand = 'cold' | 'normal' | 'hot';
export const DEMAND_COLD_MAX = 1.0;
export const DEMAND_NORMAL_MAX = 2.0;

/** Map 有効求人倍率 to 3-bucket demand band. */
export function demandBand(recruitRatio: number | null | undefined): DemandBand | null {
  if (recruitRatio === null || recruitRatio === undefined) return null;
  if (recruitRatio < DEMAND_COLD_MAX) return 'cold';
  if (recruitRatio < DEMAND_NORMAL_MAX) return 'normal';
  return 'hot';
}
