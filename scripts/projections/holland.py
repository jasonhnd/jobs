"""data.holland.json projection — per DATA_ARCHITECTURE.md §6.7.

Status: Future (skipped by default)
Consumer: future Holland Code interest matching page
Shape: columnar 6-dim vector (R/I/A/S/E/C)
Size target: < 50 KB gzipped

Only occupations with a non-null `interests` block contribute rows.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


# Map our interests dict keys → Holland Code single-letter columns
HOLLAND_KEYS = [
    ("realistic", "R"),
    ("investigative", "I"),
    ("artistic", "A"),
    ("social", "S"),
    ("enterprising", "E"),
    ("conventional", "C"),
]


def build(indexes: "Indexes", dist_root: Path) -> dict:
    rows = []
    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]
        if occ.interests is None:
            continue
        rows.append([
            occ_id,
            occ.title_ja,
            *(occ.interests.get(key) for key, _ in HOLLAND_KEYS),
        ])

    payload = {
        "schema_version": "1.0",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "row_count": len(rows),
        "cols": ["id", "name_ja", *(letter for _, letter in HOLLAND_KEYS)],
        "rows": rows,
    }
    out = dist_root / "data.holland.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {"file": out, "rows": len(rows)}
