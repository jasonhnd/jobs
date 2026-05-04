"""data.featured.json projection — per DATA_ARCHITECTURE.md §6.8.

Status: Future (skipped by default)
Consumer: mobile homepage hero ("today's pick" / "high AI risk occupations")
Shape: { generated_at, strategy, occupations: [{...full detail...}] }
Size target: < 10 KB gzipped

Strategy is configurable; default 'top_ai_risk_with_workforce' picks 12 records:
    - ai_risk >= 7 AND workers >= 50_000
    - sorted by ai_risk desc, then workers desc

Each entry inlines the full detail (avoid second fetch on mobile first paint).
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


STRATEGY = "top_ai_risk_with_workforce"
PICK_COUNT = 12


def _candidate(indexes: "Indexes", occ_id: int) -> dict | None:
    occ = indexes.occ_by_id[occ_id]
    score = indexes.latest_score_by_occ.get(occ_id)
    stats = indexes.stats_by_id.get(occ_id)
    if not score or not stats or stats.workers is None:
        return None
    if score.ai_risk < 7 or stats.workers < 50_000:
        return None
    trans = indexes.trans_by_id.get(occ_id)
    return {
        "id": occ_id,
        "title_ja": occ.title_ja,
        "title_en": trans.title_en if trans else None,
        "ai_risk": score.ai_risk,
        "workers": stats.workers,
        "salary_man_yen": stats.salary_man_yen,
        "rationale_ja": score.rationale_ja,
        "summary_ja": occ.description.summary_ja,
        "summary_en": trans.summary_en if trans else None,
        "url": occ.url,
    }


def build(indexes: "Indexes", dist_root: Path) -> dict:
    candidates = [c for c in (_candidate(indexes, oid) for oid in indexes.occ_by_id) if c]
    candidates.sort(key=lambda x: (-x["ai_risk"], -(x["workers"] or 0)))
    picks = candidates[:PICK_COUNT]

    payload = {
        "schema_version": "1.0",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "strategy": STRATEGY,
        "occupations": picks,
    }
    out = dist_root / "data.featured.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {"file": out, "picked": len(picks), "candidate_pool": len(candidates)}
