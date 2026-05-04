"""data.transfer_paths.json projection — per DATA_ARCHITECTURE.md §6.11 (v1.1.0+).

Status: Implemented (v1.1.0 phase 2)
Consumer: mobile ④/⑤ 詳細 関連職業 grid (3 cards), future ⑨ 診断 結果
Shape:    { source_id → [ {id, similarity, sector_id, ai_risk}, ... ] up to 4 entries }
Size target: < 50 KB gzipped

Recommendation rule (declarative — see also D-014):
    For each source occupation S, candidates are occupations C where:
      1. C.sector_id == S.sector_id  (same broad domain — enables genuine transfer)
      2. C.ai_risk < S.ai_risk - MIN_RISK_DROP
         (recommend SAFER alternatives — destination must be meaningfully less
         exposed; "data-schema.md" enforces this rule by hand in the prototype)
      3. C != S
    Rank candidates by cosine similarity over their `skills` vector
    (IPD skills block, ~39 dims). Take top N (default 4).

When source has no qualifying candidates (every same-sector peer has
higher or equal AI risk), we fall back to:
    - Same sector, ANY ai_risk (sorted by cosine similarity, with a
      `fallback: "no_safer_in_sector"` flag) — top 3.

When source has no skills vector at all (rare — IPD outliers), we emit
an empty list with `fallback: "no_skills"`.

Cosine similarity:
    cos(u, v) = (u·v) / (|u| * |v|)
    Range: -1 to 1 (real-world output: 0.5–0.99 since skill scores are non-negative).
    Threshold: candidates with cosine < 0.3 are filtered out (too dissimilar).
"""
from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


TOP_N = 4
MIN_RISK_DROP = 1.0       # destination ai_risk must be ≥1 lower than source
MIN_SIMILARITY = 0.3      # discard candidates more dissimilar than this


def _cosine(u: dict[str, float], v: dict[str, float]) -> float:
    """Cosine similarity over the union of keys. None values dropped."""
    keys = set(u.keys()) & set(v.keys())  # intersection — only compare on shared dims
    if not keys:
        return 0.0
    dot = sum(u[k] * v[k] for k in keys if u[k] is not None and v[k] is not None)
    nu = math.sqrt(sum(u[k] ** 2 for k in keys if u[k] is not None))
    nv = math.sqrt(sum(v[k] ** 2 for k in keys if v[k] is not None))
    if nu == 0 or nv == 0:
        return 0.0
    return dot / (nu * nv)


def build(indexes: "Indexes", dist_root: Path) -> dict:
    # Build a quick (id → ai_risk) index from latest_score_by_occ
    risk_by_id: dict[int, int] = {
        occ_id: entry.ai_risk for occ_id, entry in indexes.latest_score_by_occ.items()
    }

    # (id → sector_id) from sector_by_occ
    sector_by_id: dict[int, str] = {
        occ_id: a.sector_id for occ_id, a in indexes.sector_by_occ.items()
    }

    # (id → skills dict) — drop occupations with no skills block
    skills_by_id: dict[int, dict[str, float]] = {}
    for occ_id, occ in indexes.occ_by_id.items():
        if occ.skills is not None:
            skills_by_id[occ_id] = occ.skills

    out_paths: dict[str, dict] = {}
    fallback_counts = {"no_safer_in_sector": 0, "no_skills": 0, "primary": 0}
    no_candidates_at_all = 0

    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]
        source_sector = sector_by_id.get(occ_id)
        source_risk = risk_by_id.get(occ_id)
        source_skills = skills_by_id.get(occ_id)

        if source_skills is None or source_sector is None or source_risk is None:
            out_paths[str(occ_id)] = {
                "source_id": occ_id,
                "candidates": [],
                "fallback": "no_skills",
            }
            fallback_counts["no_skills"] += 1
            continue

        # Pool: same sector, different occupation, has skills
        pool: list[tuple[int, dict, int]] = []
        for cand_id, cand_skills in skills_by_id.items():
            if cand_id == occ_id:
                continue
            if sector_by_id.get(cand_id) != source_sector:
                continue
            if cand_id not in risk_by_id:
                continue
            pool.append((cand_id, cand_skills, risk_by_id[cand_id]))

        # Primary: prefer SAFER candidates
        safer = [
            (cid, sk, r) for cid, sk, r in pool if r <= source_risk - MIN_RISK_DROP
        ]

        chosen_pool = safer
        fallback_label: str | None = None
        if not safer:
            chosen_pool = pool  # any same-sector peer
            fallback_label = "no_safer_in_sector"

        # Score by cosine; drop too dissimilar; sort desc; take top N
        scored: list[tuple[int, float, int]] = []
        for cand_id, cand_skills, cand_risk in chosen_pool:
            sim = round(_cosine(source_skills, cand_skills), 4)
            if sim < MIN_SIMILARITY:
                continue
            scored.append((cand_id, sim, cand_risk))
        scored.sort(key=lambda x: x[1], reverse=True)
        top = scored[:TOP_N]

        if not top:
            no_candidates_at_all += 1
            out_paths[str(occ_id)] = {
                "source_id": occ_id,
                "candidates": [],
                "fallback": fallback_label or "no_similar_in_sector",
            }
            continue

        candidates = []
        for cand_id, sim, cand_risk in top:
            cand_occ = indexes.occ_by_id.get(cand_id)
            candidates.append({
                "id": cand_id,
                "title_ja": cand_occ.title_ja if cand_occ else None,
                "ai_risk": cand_risk,
                "similarity": sim,
                "sector_id": sector_by_id.get(cand_id),
            })

        out_paths[str(occ_id)] = {
            "source_id": occ_id,
            "candidates": candidates,
            **({"fallback": fallback_label} if fallback_label else {}),
        }
        if fallback_label:
            fallback_counts[fallback_label] += 1
        else:
            fallback_counts["primary"] += 1

    payload = {
        "schema_version": "1.0",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "rule": {
            "top_n": TOP_N,
            "min_risk_drop": MIN_RISK_DROP,
            "min_similarity": MIN_SIMILARITY,
            "ranking_metric": "cosine_similarity_over_skills",
            "candidate_pool": "same_sector_id",
        },
        "summary": {
            "total_sources": len(out_paths),
            "primary": fallback_counts["primary"],
            "fallback_no_safer_in_sector": fallback_counts["no_safer_in_sector"],
            "fallback_no_skills": fallback_counts["no_skills"],
            "no_candidates": no_candidates_at_all,
        },
        "paths": out_paths,
    }

    out = dist_root / "data.transfer_paths.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {"file": out, "sources": len(out_paths), "summary": payload["summary"]}
