"""data.score-history/<padded>.json projection — per DATA_ARCHITECTURE.md §6.9.

Status: Future (skipped by default)
Consumer: future "score evolution" page (how AI risk changes across model upgrades)
Shape: { id, history: [{date, model, score, rationale_ja}] }
Size target: < 3 KB per file

Only occupations with >=1 score entry get a file. With a single score run, each
file has exactly one history entry — that's expected; the projection becomes
useful once >=2 model versions have been scored.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


def build(indexes: "Indexes", dist_root: Path) -> dict:
    out_dir = dist_root / "data.score-history"
    out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    for occ_id, hist in indexes.history_by_occ.items():
        if not hist:
            continue
        payload = {
            "id": occ_id,
            "schema_version": "1.0",
            "history": [
                {
                    "date": e.date,
                    "model": e.model,
                    "score": e.ai_risk,
                    "rationale_ja": e.rationale_ja,
                }
                for e in hist  # already sorted ascending by date in indexes.py
            ],
        }
        out = out_dir / f"{occ_id:04d}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written += 1

    return {"dir": out_dir, "files": written}
