"""data.treemap.json projection — per DATA_ARCHITECTURE.md §6.1 (revised v1.0.8 + v1.1.0).

Status: Implemented
Consumer: index.html (desktop + mobile treemap canvas + per-tile tooltip),
          mobile-web ② 職業マップ + ⑦ ランキング (sector grouping + bands).
Shape:    array of objects (one per occupation) — NOT columnar.
          The columnar form (v1.0.3-v1.0.7) was insufficient for index.html, which
          shows rich per-tile tooltips (salary / age / hours / education %, etc.).
          Switching to array-of-objects makes treemap.json a near-drop-in for the
          legacy data.json so index.html only needs the fetch URL changed.
Size target: < 120 KB gzipped (legacy data.json was ~275 KB gz; v1.0.8 was ~80 KB gz;
              v1.1.0 added sector + 3 band fields — ~+5 KB).

Filtering:
    Emit only occupations that have BOTH stats_legacy and a latest AI score.
    The 4 new IPD occupations (581-584) have neither and are excluded from the
    treemap (they still appear in data.search.json and data.detail/).

Legacy compat (v1.0.8):
    `education_pct` and `employment_type` are converted from the source's
    English snake_case keys + 0.0-1.0 fractions back to Japanese keys + 0-100
    percentages, matching the legacy data.json shape index.html consumes.
    The "わからない" / unknown bucket from IPD is intentionally dropped to match
    legacy education_pct (which omitted it).

Sector + multi-axis (v1.1.0, additive — index.html does not read these but mobile does):
    sector_id        : 16 consumer-friendly sectors (§6.11), or "_uncategorized" sentinel.
    sector_ja        : display name (mirror; saves the mobile a labels lookup).
    hue              : sector's default visual tint band ('safe'|'mid'|'warm'|'risk').
    risk_band        : 'low'|'mid'|'high' from ai_risk (lib.bands).
    workforce_band   : 'small'|'mid'|'large' from workers (lib.bands).
    demand_band      : 'cold'|'normal'|'hot' from recruit_ratio (lib.bands).
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import TYPE_CHECKING

from lib.bands import demand_band, risk_band, workforce_band  # type: ignore[import-not-found]

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


# en_key → JA-key reverse maps (only for fields index.html expects in JA-key form).
EDU_KEY_EN_TO_JA: dict[str, str] = {
    "below_high_school": "高卒未満",
    "high_school": "高卒",
    "vocational_school": "専門学校卒",
    "junior_college": "短大卒",
    "technical_college": "高専卒",
    "university": "大卒",
    "masters": "修士課程卒（修士と同等の専門職学位を含む）",
    "doctorate": "博士課程卒",
    # "unknown" (わからない) intentionally excluded — matches legacy data.json shape.
}

EMP_KEY_EN_TO_JA: dict[str, str] = {
    "regular_employee": "正規の職員、従業員",
    "part_time": "パートタイマー",
    "dispatched": "派遣社員",
    "contract": "契約社員、期間従業員",
    "self_employed_freelance": "自営、フリーランス",
    "executive": "経営層（役員等）",
    "casual_non_student": "アルバイト（学生以外）",
    "casual_student": "アルバイト（学生）",
    "unknown": "わからない",
    "other": "その他",
}


def _convert_to_legacy_pct(en_dict: dict[str, float] | None,
                            mapping: dict[str, str]) -> dict[str, float] | None:
    """Convert {en_key: 0.0-1.0} → {ja_key: 0-100}, dropping keys not in mapping."""
    if en_dict is None:
        return None
    out: dict[str, float] = {}
    for en_key, frac in en_dict.items():
        ja_key = mapping.get(en_key)
        if ja_key is None:
            continue
        # Round to 1 decimal place for cleaner display (legacy used 1 dp).
        out[ja_key] = round(frac * 100, 1)
    return out


def build(indexes: "Indexes", dist_root: Path) -> dict:
    # Pre-build a sector_id → SectorDef lookup so we can attach ja + hue
    # without re-resolving per occupation.
    sector_by_id = {s.id: s for s in indexes.sectors}

    records: list[dict] = []
    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]
        stats = indexes.stats_by_id.get(occ_id)
        score = indexes.latest_score_by_occ.get(occ_id)
        # Filter: treemap needs both stats AND ai_risk to render meaningfully.
        if stats is None or score is None:
            continue

        trans = indexes.trans_by_id.get(occ_id)

        # Sector enrichment (additive in v1.1.0). Falls back to None if the
        # sector subsystem is not yet active (no sectors.ja-en.json present).
        assignment = indexes.sector_by_occ.get(occ_id)
        sector_id: str | None = assignment.sector_id if assignment else None
        sector_def = sector_by_id.get(sector_id) if sector_id else None

        records.append({
            "id": occ_id,
            "name_ja": occ.title_ja,
            "name_en": trans.title_en if trans else None,

            # Stats — flat fields, legacy field names preserved
            "salary": stats.salary_man_yen,
            "workers": stats.workers,
            "hours": stats.monthly_hours,
            "age": stats.average_age,
            "recruit_wage": stats.recruit_wage_man_yen,
            "recruit_ratio": stats.recruit_ratio,
            "hourly_wage": None,  # legacy had it from a different scrape; IPD doesn't carry it

            # AI risk
            "ai_risk": score.ai_risk,
            "ai_rationale_ja": score.rationale_ja,
            "ai_rationale_en": score.rationale_en,

            # Distributions — converted to legacy JA-key + percentage form
            "education_pct": _convert_to_legacy_pct(occ.education_distribution, EDU_KEY_EN_TO_JA),
            "employment_type": _convert_to_legacy_pct(occ.employment_type, EMP_KEY_EN_TO_JA),

            # ── v1.1.0 additive: sector + multi-axis bands ──
            # All 5 fields are nullable to preserve back-compat with builds that
            # don't have the sector subsystem active.
            "sector_id": sector_id,
            "sector_ja": sector_def.ja if sector_def else None,
            "hue": sector_def.hue if sector_def else None,
            "risk_band": risk_band(score.ai_risk),
            "workforce_band": workforce_band(stats.workers),
            "demand_band": demand_band(stats.recruit_ratio),

            "url": occ.url,
        })

    # Top-level array for drop-in compatibility with legacy data.json.
    # Metadata (schema_version, generated_at) lives in a sidecar to keep the
    # primary file array-shaped — index.html `data = await res.json()` works
    # without an unwrap step.
    out = dist_root / "data.treemap.json"
    out.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    meta_out = dist_root / "data.treemap.meta.json"
    meta = {
        "schema_version": "2.0",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "record_count": len(records),
        "filter": "occupations with stats_legacy AND latest ai score",
    }
    meta_out.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {"file": out, "rows": len(records)}
