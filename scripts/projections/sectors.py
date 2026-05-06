"""data.sectors.json + data.review_queue.json projection — per DATA_ARCHITECTURE.md §6.11.

Status: Planned (new in v1.1.0)
Consumers:
    - mobile frontend (② 職業マップ treemap grouping, ③ 検索 sector chips,
      ④/⑤ 詳細 sector tag, 関連職業 candidate pool)
    - data ops (review_queue.json — surfaces unmatched / ambiguous occupations
      so the operator can edit data/sectors/overrides.json or extend
      data/sectors/sectors.ja-en.json seed_codes)

Shape:
    data.sectors.json
        {
          schema_version: "1.0",
          generated_at:   ISO8601,
          sectors: [
            {id, ja, en, hue, description_ja, occupation_count,
             mean_ai_risk, total_workforce, sample_titles_ja: [...]},
            ...
          ]
        }

    data.review_queue.json
        {
          schema_version: "1.0",
          generated_at: ISO8601,
          summary: {
            total_occupations: int,
            assigned: int,
            uncategorized: int,
            ambiguous: int,
          },
          uncategorized: [
            {id, padded, title_ja, mhlw_main, provenance,
             suggested_sector_ids: []},
            ...
          ],
          ambiguous: [
            {id, padded, title_ja, mhlw_main, winner_sector_id, candidate_sector_ids},
            ...
          ]
        }

Size target:
    data.sectors.json     < 5 KB  (16 entries with stats)
    data.review_queue.json < 50 KB (worst case: every occupation flagged)
"""
from __future__ import annotations

import datetime as dt
import json
from collections import defaultdict
from pathlib import Path
from typing import TYPE_CHECKING

from lib.sector_resolver import SENTINEL_UNCATEGORIZED  # type: ignore[import-not-found]

if TYPE_CHECKING:
    from scripts.lib.indexes import Indexes


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _padded(occ_id: int) -> str:
    return f"{occ_id:04d}"


def build(indexes: "Indexes", dist_root: Path) -> dict:
    if not indexes.sectors:
        # Sector subsystem not active; emit nothing rather than empty stubs.
        return {"files": [], "skipped": "no sectors defined in data/sectors/sectors.ja-en.json"}

    # ---- Aggregate stats per sector (only for occupations that have stats + score) ----
    counts: dict[str, int] = defaultdict(int)
    risk_sum: dict[str, float] = defaultdict(float)
    risk_n: dict[str, int] = defaultdict(int)
    workforce_sum: dict[str, int] = defaultdict(int)
    sample_titles: dict[str, list[str]] = defaultdict(list)

    for occ_id, occ in indexes.occ_by_id.items():
        assignment = indexes.sector_by_occ.get(occ_id)
        if assignment is None:
            continue
        sid = assignment.sector_id
        counts[sid] += 1
        if len(sample_titles[sid]) < 6:
            sample_titles[sid].append(occ.title_ja)

        score = indexes.latest_score_by_occ.get(occ_id)
        if score is not None:
            risk_sum[sid] += score.ai_risk
            risk_n[sid] += 1

        stats = indexes.stats_by_id.get(occ_id)
        if stats is not None:
            workforce_sum[sid] += stats.workers

    # ---- Build sectors payload (defined order, plus _uncategorized at end if used) ----
    sectors_out: list[dict] = []
    for s in indexes.sectors:
        sectors_out.append({
            "id": s.id,
            "ja": s.ja,
            "hue": s.hue,
            "description_ja": s.description_ja,
            "occupation_count": counts.get(s.id, 0),
            "mean_ai_risk": (
                round(risk_sum[s.id] / risk_n[s.id], 2) if risk_n[s.id] else None
            ),
            "total_workforce": workforce_sum.get(s.id, 0),
            "sample_titles_ja": sample_titles.get(s.id, []),
        })

    if SENTINEL_UNCATEGORIZED in counts:
        sectors_out.append({
            "id": SENTINEL_UNCATEGORIZED,
            "ja": "未分類",
            "hue": "warm",
            "description_ja": "MHLW コードがマッピングに合致しなかった職業（dist/data.review_queue.json で確認）",
            "occupation_count": counts[SENTINEL_UNCATEGORIZED],
            "mean_ai_risk": (
                round(risk_sum[SENTINEL_UNCATEGORIZED] / risk_n[SENTINEL_UNCATEGORIZED], 2)
                if risk_n[SENTINEL_UNCATEGORIZED] else None
            ),
            "total_workforce": workforce_sum.get(SENTINEL_UNCATEGORIZED, 0),
            "sample_titles_ja": sample_titles.get(SENTINEL_UNCATEGORIZED, []),
        })

    sectors_payload = {
        "schema_version": "1.0",
        "generated_at": _now_iso(),
        "sector_count": len(indexes.sectors),
        "sectors": sectors_out,
    }
    sectors_path = dist_root / "data.sectors.json"
    sectors_path.write_text(
        json.dumps(sectors_payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    # ---- Build review_queue (uncategorized + ambiguous) ----
    uncategorized_entries: list[dict] = []
    ambiguous_entries: list[dict] = []
    assigned = 0

    for occ_id in sorted(indexes.occ_by_id):
        occ = indexes.occ_by_id[occ_id]
        a = indexes.sector_by_occ.get(occ_id)
        if a is None:
            continue
        if a.sector_id != SENTINEL_UNCATEGORIZED:
            assigned += 1

        if a.sector_id == SENTINEL_UNCATEGORIZED:
            uncategorized_entries.append({
                "id": occ_id,
                "padded": _padded(occ_id),
                "title_ja": occ.title_ja,
                "mhlw_main": occ.classifications.mhlw_main,
                "jsoc_main": occ.classifications.jsoc_main,
                "provenance": a.provenance,
                "hint": _suggest_sector(occ.classifications.mhlw_main, indexes.sectors),
            })
        elif a.provenance == "auto-ambiguous":
            ambiguous_entries.append({
                "id": occ_id,
                "padded": _padded(occ_id),
                "title_ja": occ.title_ja,
                "mhlw_main": occ.classifications.mhlw_main,
                "winner_sector_id": a.sector_id,
                "candidate_sector_ids": list(a.candidates),
            })

    queue_payload = {
        "schema_version": "1.0",
        "generated_at": _now_iso(),
        "summary": {
            "total_occupations": len(indexes.occ_by_id),
            "assigned": assigned,
            "uncategorized": len(uncategorized_entries),
            "ambiguous": len(ambiguous_entries),
            "override_count": len(indexes.sector_overrides),
        },
        "uncategorized": uncategorized_entries,
        "ambiguous": ambiguous_entries,
        "instructions": (
            "To resolve an entry: edit data/sectors/overrides.json with "
            "{\"<padded>\": \"<sector_id>\"} and rebuild. To resolve many at once, "
            "extend the relevant sector's mhlw_seed_codes in "
            "data/sectors/sectors.ja-en.json."
        ),
    }
    queue_path = dist_root / "data.review_queue.json"
    queue_path.write_text(
        json.dumps(queue_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return {
        "files": [sectors_path, queue_path],
        "sectors": len(indexes.sectors),
        "uncategorized": len(uncategorized_entries),
        "ambiguous": len(ambiguous_entries),
    }


def _suggest_sector(mhlw_main: str | None, sectors) -> str | None:
    """Best-effort hint: which sector LIKELY matches given a partial MHLW code.

    Pure heuristic — strips the trailing parts of the MHLW code one at a time
    and returns the first sector whose seed_codes would match a prefix glob.
    Used only to populate the review_queue 'hint' column for the operator.
    """
    if not mhlw_main:
        return None
    # Try the prefix at increasing granularity.
    parts = mhlw_main.replace("-", "_").split("_")
    candidates: list[str] = []
    for n in range(len(parts), 0, -1):
        prefix = "_".join(parts[:n])
        for s in sectors:
            for seed in s.mhlw_seed_codes:
                # Cheap heuristic: is the seed pattern a prefix-match of this code?
                seed_no_star = seed.rstrip("*")
                if mhlw_main.startswith(seed_no_star) or prefix.startswith(seed_no_star):
                    if s.id not in candidates:
                        candidates.append(s.id)
        if candidates:
            return candidates[0]
    return None
