"""data.search.json projection — per DATA_ARCHITECTURE.md §6.4 (revised v1.1.0).

Status: Planned
Consumer: search page (mobile ③ 検索結果 + desktop), can feed FlexSearch / MiniSearch
Shape: { schema_version, documents: [...] }
Size target: < 200 KB gzipped (v1.0.x ~27 KB; v1.1.0 +sector_id + bands ~+5 KB)

Per-document fields:
    id, title_ja, title_en, aliases_ja, aliases_en,
    sector_id (v1.1.0), risk_band (v1.1.0), workforce_band (v1.1.0),
    category_size (legacy alias kept for backward compat), ai_risk

`workforce_band` and `category_size` are nearly identical (3-bucket worker
counts) but use slightly different thresholds — `workforce_band` uses the
canonical lib.bands thresholds (2万/10万) shared with treemap; `category_size`
preserves the legacy 10万/100万 thresholds the search UI was originally built
against. Both are emitted to allow gradual frontend migration.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import TYPE_CHECKING

from lib.bands import risk_band, workforce_band  # type: ignore[import-not-found]

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


def _bucket_workers_legacy(workers: int | None) -> str | None:
    """Legacy 3-bucket worker count (kept under the name `category_size`).

    Different thresholds from `lib.bands.workforce_band` — preserved verbatim
    for back-compat with existing search consumers. New consumers should prefer
    the v1.1.0 `workforce_band` field.
    """
    if workers is None:
        return None
    if workers < 100_000:
        return "small"
    if workers <= 1_000_000:
        return "medium"
    return "large"


def build(indexes: "Indexes", dist_root: Path) -> dict:
    documents = []
    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]
        trans = indexes.trans_by_id.get(occ_id)
        stats = indexes.stats_by_id.get(occ_id)
        score = indexes.latest_score_by_occ.get(occ_id)
        assignment = indexes.sector_by_occ.get(occ_id)

        documents.append({
            "id": occ_id,
            "title_ja": occ.title_ja,
            "title_en": trans.title_en if trans else None,
            "aliases_ja": occ.aliases_ja,
            "aliases_en": trans.aliases_en if trans else [],

            # v1.1.0 additive — sector + canonical bands
            "sector_id": assignment.sector_id if assignment else None,
            "risk_band": risk_band(score.ai_risk if score else None),
            "workforce_band": workforce_band(stats.workers if stats else None),

            # Legacy
            "category_size": _bucket_workers_legacy(stats.workers if stats else None),
            "ai_risk": score.ai_risk if score else None,
        })

    payload = {
        "schema_version": "1.1",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "document_count": len(documents),
        "documents": documents,
    }
    out = dist_root / "data.search.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {"file": out, "documents": len(documents)}
