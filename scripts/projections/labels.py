"""data.labels/ja.json projection — per DATA_ARCHITECTURE.md §6.10.

Status: Planned
Consumer: all frontend code rendering labels
Shape: flat dict per language: {dim: {key: label_str}}
Size target: < 30 KB (gzipped)

Source: data/labels/<dim>.ja-en.json × 7

Note: EN labels were dropped in v1.4.0 when the English UI was removed.
The source dictionaries remain bilingual; only the JA projection is emitted.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


def build(indexes: "Indexes", dist_root: Path) -> dict:
    out_dir = dist_root / "data.labels"
    out_dir.mkdir(parents=True, exist_ok=True)

    ja_payload: dict = {
        "schema_version": "1.0",
        "lang": "ja",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }

    for dim, labels in indexes.labels_by_dim.items():
        ja_payload[dim] = {key: entry.ja for key, entry in labels.items()}

    ja_path = out_dir / "ja.json"
    ja_path.write_text(json.dumps(ja_payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {"files": [ja_path], "dimensions": len(indexes.labels_by_dim)}
