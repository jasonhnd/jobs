"""data.profile5.json projection — per DATA_ARCHITECTURE.md §6.11 (v1.1.0+).

Status: Implemented (v1.1.0 phase 2)
Consumer: mobile ④/⑤ 詳細 radar chart, ⑥ 比較 5-axis comparison
Shape:    { id → { creative, social, judgment, physical, routine } }, all 0-100
Size target: < 30 KB gzipped

The 5 axes are derived from existing IPD numeric profile fields. NOT new
data — it's a rollup that the mobile design wants pre-computed instead of
re-derived in browser JS for every render.

Axis definitions (each averaged across N input fields, normalized to 0-100):
    creative  — work_activities.thinking_creatively, abilities.originality,
                 abilities.fluency_of_ideas, skills.active_learning
    social    — skills.{social_perceptiveness, coordination, persuasion,
                 negotiation, instructing, service_orientation},
                 work_characteristics.{contact_with_others, face_to_face_discussions,
                 teamwork}
    judgment  — skills.{critical_thinking, complex_problem_solving,
                 judgment_decision_making, systems_evaluation},
                 work_characteristics.{freedom_to_make_decisions,
                 responsibility_for_outcomes, consequence_of_error}
    physical  — abilities.{static_strength, stamina, gross_body_equilibrium,
                 arm_hand_steadiness, manual_dexterity},
                 work_characteristics.{standing, walking_running,
                 handling_objects_tools, physical_proximity}
    routine   — work_characteristics.{repetitive_tasks, repetition_of_activities,
                 exactness_accuracy, pace_determined_by_machine, regular_schedule}

When a contributing field is None or its parent block is None, it's dropped
from the average (no zero-stuffing). If ALL contributors for an axis are
missing for an occupation, that axis is null (frontend shows dash).

Source field ranges:
    skills / abilities / work_characteristics / work_activities: 0-5 (IPD scale)
    Distributions (education, employment): 0-1 (skipped here)

Output normalization:
    raw_average (0-5)  →  round(raw_average / 5 * 100, 1)  →  0-100 float

This matches what a radar chart needs (each spoke 0-100). Frontend renders
without further math.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


# Axis definitions: each maps to a list of (block_name, field_key) tuples.
# block_name is one of the Occupation numeric blocks; field_key is the en_key.
AXIS_INPUTS: dict[str, list[tuple[str, str]]] = {
    "creative": [
        ("work_activities", "thinking_creatively"),
        ("abilities",       "originality"),
        ("abilities",       "fluency_of_ideas"),
        ("skills",          "active_learning"),
    ],
    "social": [
        ("skills",                "social_perceptiveness"),
        ("skills",                "coordination"),
        ("skills",                "persuasion"),
        ("skills",                "negotiation"),
        ("skills",                "instructing"),
        ("skills",                "service_orientation"),
        ("work_characteristics",  "contact_with_others"),
        ("work_characteristics",  "face_to_face_discussions"),
        ("work_characteristics",  "teamwork"),
    ],
    "judgment": [
        ("skills",                "critical_thinking"),
        ("skills",                "complex_problem_solving"),
        ("skills",                "judgment_decision_making"),
        ("skills",                "systems_evaluation"),
        ("work_characteristics",  "freedom_to_make_decisions"),
        ("work_characteristics",  "responsibility_for_outcomes"),
        ("work_characteristics",  "consequence_of_error"),
    ],
    "physical": [
        ("abilities",             "static_strength"),
        ("abilities",             "stamina"),
        ("abilities",             "gross_body_equilibrium"),
        ("abilities",             "arm_hand_steadiness"),
        ("abilities",             "manual_dexterity"),
        ("work_characteristics",  "standing"),
        ("work_characteristics",  "walking_running"),
        ("work_characteristics",  "handling_objects_tools"),
        ("work_characteristics",  "physical_proximity"),
    ],
    "routine": [
        ("work_characteristics",  "repetitive_tasks"),
        ("work_characteristics",  "repetition_of_activities"),
        ("work_characteristics",  "exactness_accuracy"),
        ("work_characteristics",  "pace_determined_by_machine"),
        ("work_characteristics",  "regular_schedule"),
    ],
}

# Source data is on a 0-5 scale; output is 0-100 for radar rendering.
SOURCE_MAX = 5.0


def _gather_axis(occ, inputs: list[tuple[str, str]]) -> float | None:
    """Average all present input fields for one axis. Returns None if all missing."""
    values: list[float] = []
    for block_name, field in inputs:
        block = getattr(occ, block_name, None)
        if block is None:
            continue
        v = block.get(field)
        if v is None:
            continue
        values.append(v)
    if not values:
        return None
    raw_avg = sum(values) / len(values)
    return round(raw_avg / SOURCE_MAX * 100, 1)


def build(indexes: "Indexes", dist_root: Path) -> dict:
    profiles: dict[str, dict[str, float | None]] = {}
    null_axes: dict[str, int] = {axis: 0 for axis in AXIS_INPUTS}

    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]
        record: dict[str, float | None] = {}
        for axis, inputs in AXIS_INPUTS.items():
            val = _gather_axis(occ, inputs)
            record[axis] = val
            if val is None:
                null_axes[axis] += 1
        profiles[str(occ_id)] = record

    payload = {
        "schema_version": "1.0",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "axis_definitions": {
            axis: [f"{block}.{field}" for block, field in inputs]
            for axis, inputs in AXIS_INPUTS.items()
        },
        "axis_count": len(AXIS_INPUTS),
        "occupation_count": len(profiles),
        "null_axes_per_dimension": null_axes,
        "profiles": profiles,
    }

    out = dist_root / "data.profile5.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {
        "file": out,
        "occupations": len(profiles),
        "axes": list(AXIS_INPUTS.keys()),
        "null_axes": null_axes,
    }
