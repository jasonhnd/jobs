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
 * Migrated from scripts/lib/bands.py — keep functions byte-equivalent.
 */

// ───── Risk band ─────
// Aligned with handoff/components.md and tokens.css `.risk-low/.risk-mid/.risk-high`.
export type RiskBand = 'low' | 'mid' | 'high';
export const RISK_LOW_MAX = 3.9; // 0.0–3.9 → low (sage)
export const RISK_MID_MAX = 6.9; // 4.0–6.9 → mid (sand)
//                                  // 7.0–10  → high (terracotta)

/** Map ai_risk score (0-10) to design's three-color risk band. */
export function riskBand(aiRisk: number | null | undefined): RiskBand | null {
  if (aiRisk === null || aiRisk === undefined) return null;
  if (aiRisk <= RISK_LOW_MAX) return 'low';
  if (aiRisk <= RISK_MID_MAX) return 'mid';
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
