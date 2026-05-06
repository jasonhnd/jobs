"""data.skills/<skill_key>.json + _index.json projections — per DATA_ARCHITECTURE.md §6.5 / §6.6.

Status: Future (skipped by default in build_data.py)
Consumer: future "find jobs by skill" page
Shape:
    _index.json: {"skills": [{"key", "label_ja"}]}
    <key>.json: {"skill_key", "label_ja", "occupations": [{"id", "name_ja", "score"}]}
Size target: < 15 KB per per-skill file

`occupations` is sorted by score descending; only occupations with non-null skills block participate.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


def build(indexes: "Indexes", dist_root: Path) -> dict:
    out_dir = dist_root / "data.skills"
    out_dir.mkdir(parents=True, exist_ok=True)

    skills_labels = indexes.labels_by_dim.get("skills", {})

    # Per-skill ranking files
    written = 0
    for skill_key, label in skills_labels.items():
        ranked: list[dict] = []
        for occ_id, occ in indexes.occ_by_id.items():
            if occ.skills is None:
                continue
            score = occ.skills.get(skill_key)
            if score is None:
                continue
            ranked.append({"id": occ_id, "name_ja": occ.title_ja, "score": score})
        ranked.sort(key=lambda x: x["score"], reverse=True)

        payload = {
            "skill_key": skill_key,
            "label_ja": label.ja,
            "occupations": ranked,
        }
        out = out_dir / f"{skill_key}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written += 1

    # _index.json
    index_payload = {
        "schema_version": "1.0",
        "skills": [
            {"key": k, "label_ja": v.ja}
            for k, v in skills_labels.items()
        ],
    }
    index_path = out_dir / "_index.json"
    index_path.write_text(json.dumps(index_payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    return {"dir": out_dir, "skill_files": written, "index": index_path}
