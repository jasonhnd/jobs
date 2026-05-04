"""Multi-axis band derivations — per DATA_ARCHITECTURE.md §6.11.

Pure helpers; no I/O. Used by treemap / search / detail projections to attach
non-sector classification axes to each occupation record. All bands share the
same shape: a small literal-typed string ('low'/'mid'/'high'-style).

Why these specific axes?
  - risk_band       : the obvious one — drives the design's sage/sand/terracotta
                       three-color visual language.
  - workforce_band  : "is this a niche profession or one that hires millions?"
                       Useful for ranking weight, treemap area normalization,
                       and "you should also know" recommendations.
  - demand_band     : "is the labor market hot for this job right now?"
                       Drives the "今、求められている" hint and 詳細 page tag.

Thresholds are documented constants — don't tune in projection code.
"""
from __future__ import annotations

from typing import Literal


# ───── Risk band ─────
# Aligned with handoff/components.md and tokens.css `.risk-low/.risk-mid/.risk-high`.
RiskBand = Literal["low", "mid", "high"]
RISK_LOW_MAX = 3.9    # 0.0–3.9 → low (sage)
RISK_MID_MAX = 6.9    # 4.0–6.9 → mid (sand)
                      # 7.0–10  → high (terracotta)


def risk_band(ai_risk: int | float | None) -> RiskBand | None:
    """Map ai_risk score (0-10) to design's three-color risk band."""
    if ai_risk is None:
        return None
    if ai_risk <= RISK_LOW_MAX:
        return "low"
    if ai_risk <= RISK_MID_MAX:
        return "mid"
    return "high"


# ───── Workforce band ─────
# Tuned against the actual distribution of `stats_legacy.workers`:
#   p33 ≈ 18,000 / p67 ≈ 70,000 (recomputed lazily in tests; see test_data_consistency)
# Hard-coded so a single record's classification doesn't depend on what other
# records exist (deterministic across re-builds).
WorkforceBand = Literal["small", "mid", "large"]
WORKFORCE_SMALL_MAX = 20_000   # < 2万人 → small / niche
WORKFORCE_MID_MAX = 100_000    # 2万-10万人 → mid
                                # > 10万人 → large


def workforce_band(workers: int | None) -> WorkforceBand | None:
    """Map total workforce (people) to a 3-bucket size band."""
    if workers is None:
        return None
    if workers < WORKFORCE_SMALL_MAX:
        return "small"
    if workers < WORKFORCE_MID_MAX:
        return "mid"
    return "large"


# ───── Demand band ─────
# 有効求人倍率 (effective job opening ratio). >1.0 = labor undersupplied.
# 0.0-1.0  = "cold" (more applicants than openings)
# 1.0-2.0  = "normal"
# >2.0     = "hot" (acute labor shortage — careers like 介護 / 建設 are here)
DemandBand = Literal["cold", "normal", "hot"]
DEMAND_COLD_MAX = 1.0
DEMAND_NORMAL_MAX = 2.0


def demand_band(recruit_ratio: float | None) -> DemandBand | None:
    """Map 有効求人倍率 to 3-bucket demand band."""
    if recruit_ratio is None:
        return None
    if recruit_ratio < DEMAND_COLD_MAX:
        return "cold"
    if recruit_ratio < DEMAND_NORMAL_MAX:
        return "normal"
    return "hot"
