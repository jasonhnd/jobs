"""data.detail/<padded>.json projection — per DATA_ARCHITECTURE.md §6.2 (revised v1.2.0).

Status: Planned
Consumer: build_occupations.py, api/og.tsx, mobile ④/⑤ 詳細 drill-down fetch
Shape: nested object — main occupation + stats + latest score + top-N skills
Size target: < 5 KB gzipped per file

`*_top_N` rule per §6.2:
    Sort by the occupation's score descending; take first N.
    When the parent block is None (no numeric profile), the top_N field is also None.
    N: skills=10, knowledge=5, abilities=5.

v1.2.0 — EN UI removal:
    All `*_en` / `.en` fields dropped from the payload. Source occupation files
    and translation backups still carry the EN data; this projection just stops
    emitting them.

v1.1.0 additive — `sector` block:
    {
      id           : sector slug (or "_uncategorized")
      ja           : display label
      hue          : 'safe'|'mid'|'warm'|'risk' fallback tint
      provenance   : 'override'|'auto'|'auto-ambiguous'|'unmatched'|'no-mhlw'
    }
    Plus `risk_band` / `workforce_band` / `demand_band` at the top level for
    consistency with treemap + search.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from lib.bands import demand_band, risk_band, workforce_band  # type: ignore[import-not-found]

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


def _top_n(block: dict[str, float] | None, labels_dim: dict, n: int) -> list[dict] | None:
    """Sort block by score desc, take top N. Return None if block is None.

    Each item: {"key", "label_ja", "score"}
    """
    if block is None:
        return None
    sorted_items = sorted(block.items(), key=lambda kv: kv[1], reverse=True)[:n]
    out = []
    for key, score in sorted_items:
        label = labels_dim.get(key)
        out.append({
            "key": key,
            "label_ja": label.ja if label else key,
            "score": score,
        })
    return out


def build(indexes: "Indexes", dist_root: Path) -> dict:
    out_dir = dist_root / "data.detail"
    out_dir.mkdir(parents=True, exist_ok=True)

    skills_labels = indexes.labels_by_dim.get("skills", {})
    knowledge_labels = indexes.labels_by_dim.get("knowledge", {})
    abilities_labels = indexes.labels_by_dim.get("abilities", {})
    sector_by_id = {s.id: s for s in indexes.sectors}

    written = 0
    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]
        trans = indexes.trans_by_id.get(occ_id)
        stats = indexes.stats_by_id.get(occ_id)
        score = indexes.latest_score_by_occ.get(occ_id)
        assignment = indexes.sector_by_occ.get(occ_id)
        sector_def = sector_by_id.get(assignment.sector_id) if assignment else None

        sector_block: dict | None = None
        if assignment is not None:
            sector_block = {
                "id": assignment.sector_id,
                "ja": sector_def.ja if sector_def else None,
                "hue": sector_def.hue if sector_def else None,
                "provenance": assignment.provenance,
            }

        payload = {
            "id": occ_id,
            "schema_version": "1.2",
            "title": {
                "ja": occ.title_ja,
                "aliases_ja": occ.aliases_ja,
            },
            "classifications": occ.classifications.model_dump(),
            # v1.1.0 additive — sector + bands for the mobile detail page
            "sector": sector_block,
            "risk_band": risk_band(score.ai_risk if score else None),
            "workforce_band": workforce_band(stats.workers if stats else None),
            "demand_band": demand_band(stats.recruit_ratio if stats else None),
            "description": {
                "summary_ja": occ.description.summary_ja,
                "what_it_is_ja": occ.description.what_it_is_ja,
                "how_to_become_ja": occ.description.how_to_become_ja,
                "working_conditions_ja": occ.description.working_conditions_ja,
            },
            "ai_risk": {
                "score": score.ai_risk,
                "model": score.model,
                "scored_at": score.date,
                "rationale_ja": score.rationale_ja,
            } if score else None,
            "stats": stats.model_dump(exclude={"id", "schema_version"}) if stats else None,
            "skills_top10": _top_n(occ.skills, skills_labels, 10),
            "knowledge_top5": _top_n(occ.knowledge, knowledge_labels, 5),
            "abilities_top5": _top_n(occ.abilities, abilities_labels, 5),
            "tasks_count": len(occ.tasks),
            "tasks_lead_ja": occ.tasks_lead_ja,
            "related_orgs": [o.model_dump() for o in occ.related_orgs],
            "related_certs_ja": occ.related_certs_ja,
            "url": occ.url,
            "data_source_versions": occ.data_source_versions.model_dump(),
        }

        out = out_dir / f"{occ_id:04d}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written += 1

    return {"dir": out_dir, "files": written}
