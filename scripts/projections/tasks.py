"""data.tasks/<padded>.json projection — per DATA_ARCHITECTURE.md §6.3.

Status: Future (skipped by default in build_data.py)
Consumer: future "task-level AI risk map" page
Shape: { id, title_ja, tasks: [{task_id, description_ja, execution_rate, importance, ai_risk, ai_rationale_ja, scored_by, scored_at}] }
Size target: < 3 KB gzipped per file

When task-level AI scoring hasn't run yet:
    Each task's ai_risk / ai_rationale_ja / scored_by / scored_at are null.
    The remaining task fields (description, execution_rate, importance) are still emitted.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


def build(indexes: "Indexes", dist_root: Path) -> dict:
    out_dir = dist_root / "data.tasks"
    out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]

        tasks_payload = []
        for task in occ.tasks:
            # Task-level AI scores are not yet wired (see indexes.py: only scope='occupations' loaded)
            # When tasks_<model>_<date>.json files appear, load via runs_by_model and join here by (occ_id, task_id).
            tasks_payload.append({
                "task_id": task.task_id,
                "description_ja": task.description_ja,
                "execution_rate": task.execution_rate,
                "importance": task.importance,
                "ai_risk": None,
                "ai_rationale_ja": None,
                "scored_by": None,
                "scored_at": None,
            })

        payload = {
            "id": occ_id,
            "title_ja": occ.title_ja,
            "tasks_lead_ja": occ.tasks_lead_ja,
            "tasks": tasks_payload,
        }
        out = out_dir / f"{occ_id:04d}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written += 1

    return {"dir": out_dir, "files": written}
