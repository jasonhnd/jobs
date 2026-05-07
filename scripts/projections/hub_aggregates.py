"""dist/data.hub_aggregates.json — per-sector and per-ranking-theme derived data.

Purpose
-------
The middle layer (16 sector hubs + ~11 ranking hubs) needs more than a flat
list of occupations to feel like its "own page". This projection produces
per-hub aggregate signals that any v2 hub renderer can ingest:

    counts, distributions, central tendencies, distinctive top-N picks,
    sector-vs-site comparisons, and a few "pattern callout" candidates.

Zero LLM. Pure derivation from dist/data.detail/*.json.

Schema (v0.1)
-------------
{
  "schema_version": "0.1",
  "generated_at": "ISO date",
  "sectors": {
    "<sector_id>": {
      "id": str, "ja": str,
      "n": int,
      "workforce_total": int,
      "ai_risk": {"mean": float, "median": float, "p25": float, "p75": float,
                  "high_count": int, "mid_count": int, "low_count": int,
                  "vs_site_mean_diff": float},
      "salary": {"median": float, "p25": float, "p75": float,
                  "vs_site_median_diff_pct": float},
      "recruit_ratio": {"median": float, "vs_site_median_diff": float},
      "average_age": {"median": float, "vs_site_median_diff": float},
      "monthly_hours": {"median": float},
      "tops": {
        "high_ai_risk": [{"id", "name_ja", "ai_risk", "workers"}, ...top 5],
        "low_ai_risk":  [...top 5],
        "by_workers":   [...top 5],
        "by_salary":    [...top 5],
        "by_recruit":   [...top 5]
      }
    }
  },
  "site": {
    "n": int,
    "ai_risk_median": float,
    "salary_median": float,
    "recruit_ratio_median": float,
    "average_age_median": float
  }
}
"""
from __future__ import annotations

import json
import statistics
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

REPO = Path(__file__).resolve().parent.parent.parent
DETAIL_DIR = REPO / "dist" / "data.detail"
SECTORS_PATH = REPO / "data" / "sectors" / "sectors.ja-en.json"
OUT_PATH = REPO / "dist" / "data.hub_aggregates.json"

SCHEMA_VERSION = "0.1"
TOP_N = 5


@dataclass(frozen=True)
class OccRecord:
    id: int
    name_ja: Optional[str]
    sector_id: Optional[str]
    ai_risk: Optional[float]
    workers: Optional[int]
    salary: Optional[float]
    recruit: Optional[float]
    age: Optional[float]
    hours: Optional[float]


def _load_occupations() -> list[OccRecord]:
    out: list[OccRecord] = []
    for f in sorted(DETAIL_DIR.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        sector = d.get("sector") or {}
        stats = d.get("stats") or {}
        ai = d.get("ai_risk") or {}
        out.append(OccRecord(
            id=d["id"],
            name_ja=(d.get("title") or {}).get("ja"),
            sector_id=sector.get("id"),
            ai_risk=ai.get("score"),
            workers=stats.get("workers"),
            salary=stats.get("salary_man_yen"),
            recruit=stats.get("recruit_ratio"),
            age=stats.get("average_age"),
            hours=stats.get("monthly_hours"),
        ))
    return out


def _percentile(values: list[float], pct: float) -> Optional[float]:
    """Simple percentile (no interpolation). pct in [0,1]."""
    if not values:
        return None
    sorted_vals = sorted(values)
    idx = max(0, min(len(sorted_vals) - 1, int(pct * (len(sorted_vals) - 1))))
    return sorted_vals[idx]


def _safe_median(values: list[float]) -> Optional[float]:
    return statistics.median(values) if values else None


def _safe_mean(values: list[float]) -> Optional[float]:
    return statistics.mean(values) if values else None


def _top_n(occs: list[OccRecord], key, reverse: bool, n: int = TOP_N) -> list[dict]:
    filtered = [o for o in occs if key(o) is not None]
    sorted_ = sorted(filtered, key=lambda o: key(o), reverse=reverse)[:n]
    return [
        {"id": o.id, "name_ja": o.name_ja, "ai_risk": o.ai_risk,
         "workers": o.workers, "salary": o.salary, "recruit": o.recruit}
        for o in sorted_
    ]


def _aggregate_sector(occs: list[OccRecord], sector_def: dict, site_baseline: dict) -> dict:
    """Build one sector's aggregate block."""
    if not occs:
        return {
            "id": sector_def["id"], "ja": sector_def["ja"],
            "n": 0, "workforce_total": 0,
            "ai_risk": None, "salary": None, "recruit_ratio": None,
            "average_age": None, "monthly_hours": None, "tops": {},
        }

    risks = [o.ai_risk for o in occs if o.ai_risk is not None]
    salaries = [o.salary for o in occs if o.salary is not None]
    recruits = [o.recruit for o in occs if o.recruit is not None]
    ages = [o.age for o in occs if o.age is not None]
    hours = [o.hours for o in occs if o.hours is not None]
    workforce_total = sum(o.workers or 0 for o in occs)

    site_ai_median = site_baseline["ai_risk_median"]
    site_salary_median = site_baseline["salary_median"]
    site_recruit_median = site_baseline["recruit_ratio_median"]
    site_age_median = site_baseline["average_age_median"]

    ai_block = None
    if risks:
        mean_r = statistics.mean(risks)
        ai_block = {
            "mean": round(mean_r, 2),
            "median": _safe_median(risks),
            "p25": _percentile(risks, 0.25),
            "p75": _percentile(risks, 0.75),
            "high_count": sum(1 for r in risks if r >= 7),
            "mid_count": sum(1 for r in risks if 4 <= r <= 6),
            "low_count": sum(1 for r in risks if r <= 3),
            "vs_site_mean_diff": round(mean_r - (site_ai_median or 0), 2),
        }

    salary_block = None
    if salaries:
        med = _safe_median(salaries)
        salary_block = {
            "median": med,
            "p25": _percentile(salaries, 0.25),
            "p75": _percentile(salaries, 0.75),
            "vs_site_median_diff_pct": round(
                ((med - site_salary_median) / site_salary_median * 100) if (med and site_salary_median) else 0, 1
            ),
        }

    recruit_block = None
    if recruits:
        med = _safe_median(recruits)
        recruit_block = {
            "median": round(med, 2),
            "vs_site_median_diff": round((med - (site_recruit_median or 0)), 2),
        }

    age_block = None
    if ages:
        med = _safe_median(ages)
        age_block = {
            "median": round(med, 1),
            "vs_site_median_diff": round((med - (site_age_median or 0)), 1),
        }

    hours_block = None
    if hours:
        hours_block = {"median": round(_safe_median(hours), 0)}

    tops = {
        "high_ai_risk": _top_n(occs, lambda o: o.ai_risk, reverse=True),
        "low_ai_risk":  _top_n(occs, lambda o: o.ai_risk, reverse=False),
        "by_workers":   _top_n(occs, lambda o: o.workers, reverse=True),
        "by_salary":    _top_n(occs, lambda o: o.salary, reverse=True),
        "by_recruit":   _top_n(occs, lambda o: o.recruit, reverse=True),
    }

    return {
        "id": sector_def["id"],
        "ja": sector_def["ja"],
        "n": len(occs),
        "workforce_total": workforce_total,
        "ai_risk": ai_block,
        "salary": salary_block,
        "recruit_ratio": recruit_block,
        "average_age": age_block,
        "monthly_hours": hours_block,
        "tops": tops,
    }


def build() -> dict:
    """Main entrypoint. Returns the aggregates dict and writes the JSON file."""
    occs = _load_occupations()
    sectors_data = json.loads(SECTORS_PATH.read_text(encoding="utf-8"))
    sectors_list = sectors_data["sectors"]

    # Site-level baseline (used for vs_site comparisons in each sector block)
    all_risks = [o.ai_risk for o in occs if o.ai_risk is not None]
    all_salaries = [o.salary for o in occs if o.salary is not None]
    all_recruits = [o.recruit for o in occs if o.recruit is not None]
    all_ages = [o.age for o in occs if o.age is not None]

    site = {
        "n": len(occs),
        "ai_risk_median": _safe_median(all_risks),
        "ai_risk_mean": round(_safe_mean(all_risks), 2) if all_risks else None,
        "salary_median": _safe_median(all_salaries),
        "recruit_ratio_median": round(_safe_median(all_recruits), 2) if all_recruits else None,
        "average_age_median": round(_safe_median(all_ages), 1) if all_ages else None,
    }

    sector_aggs: dict[str, dict] = {}
    for s in sectors_list:
        sid = s["id"]
        sector_occs = [o for o in occs if o.sector_id == sid]
        sector_aggs[sid] = _aggregate_sector(sector_occs, s, site)

    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": date.today().isoformat(),
        "site": site,
        "sectors": sector_aggs,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return payload


if __name__ == "__main__":
    result = build()
    n_sectors = len(result["sectors"])
    site_n = result["site"]["n"]
    print(f"hub_aggregates: wrote {OUT_PATH.relative_to(REPO)}")
    print(f"  site: {site_n} occupations")
    print(f"  sectors: {n_sectors}")
    print(f"  site ai_risk median: {result['site']['ai_risk_median']}")
    print(f"  site salary median: {result['site']['salary_median']} 万円")
