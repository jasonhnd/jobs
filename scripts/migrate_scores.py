"""Migrate v1.0 ai_scores file → v2.0 ScoreRun schema.

One-shot migration per DATA_ARCHITECTURE.md §2.3 / §2.3.1 / D-005 / D-011.

Source:  data/ai_scores_2026-04-25.json (v1.0 format)
Output:  data/scores/occupations_claude-opus-4-7_2026-04-25.json (v2.0 format)

Field renames:
    r → ai_risk
    j → rationale_ja
    e → rationale_en

Missing v2.0 metadata fields (model_temperature, durations, hashes, etc.) are filled
with None or "<unknown - migrated from v1.0>" per §2.3.1 末尾.

This script is kept post-migration for reference (D-011).
Re-running is safe: output file is overwritten atomically.

Usage:
    uv run python scripts/migrate_scores.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
from schema.score_run import (  # noqa: E402
    InputMeta,
    PromptMeta,
    RunMeta,
    ScoreEntry,
    ScoreRun,
    Scorer,
)

# v0.7.0: source moved to .archive/v0.6/. Migration is one-shot; deterministic re-runs.
SOURCE = ROOT / "data" / ".archive" / "v0.6" / "ai_scores_2026-04-25.json"
OUTPUT_DIR = ROOT / "data" / "scores"
OUTPUT_FILENAME = "occupations_claude-opus-4-7_2026-04-25.json"
PROMPT_FILE = "data/prompts/prompt.ja.md"
UNKNOWN = "<unknown - migrated from v1.0>"


def sha256_of_file(path: Path) -> str:
    """Compute hex sha256 of a file's bytes."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with SOURCE.open(encoding="utf-8") as f:
        legacy = json.load(f)

    # Convert each score entry: {r, j, e} → {ai_risk, rationale_ja, rationale_en}
    scores = {}
    for occ_id_str, entry in legacy["scores"].items():
        scores[occ_id_str] = ScoreEntry(
            ai_risk=entry["r"],
            rationale_ja=entry["j"],
            rationale_en=entry["e"],
            confidence=None,  # not available in v1.0
        )

    # Compute prompt sha256 if file exists
    prompt_path = ROOT / PROMPT_FILE
    prompt_sha = sha256_of_file(prompt_path) if prompt_path.exists() else None

    run = ScoreRun(
        scope="occupations",
        scorer=Scorer(
            model="claude-opus-4-7",
            model_provider="anthropic",
            model_temperature=None,  # unknown for v1.0 run
            scoring_method="single-pass per occupation",
        ),
        run=RunMeta(
            run_date=legacy.get("scored_at", "2026-04-25"),
            run_id="occ_2026-04-25_v1",
            duration_minutes=None,
            operator=UNKNOWN,
        ),
        input=InputMeta(
            input_data_version="legacy_scrape_2026-04-25 (occupations_full.json)",
            input_data_sha256=None,  # source data composition not hashable retroactively
            occupation_count_scored=len(scores),
            occupation_count_skipped=0,
        ),
        prompt=PromptMeta(
            prompt_version="1.0",
            prompt_file=PROMPT_FILE,
            prompt_sha256=prompt_sha,
            rubric_source=legacy.get(
                "rubric_source",
                "karpathy/jobs 0-10 scale, calibrated for Japan jobtag",
            ),
        ),
        anchors=legacy.get("anchors", {}),
        caveat=legacy.get("caveat", ""),
        scores=scores,
    )

    out_path = OUTPUT_DIR / OUTPUT_FILENAME
    out_path.write_text(
        json.dumps(run.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {out_path.relative_to(ROOT)}")
    print(f"  scope:               {run.scope}")
    print(f"  scorer.model:        {run.scorer.model}")
    print(f"  run.run_date:        {run.run.run_date}")
    print(f"  scored count:        {run.input.occupation_count_scored}")
    print(f"  prompt.sha256:       {prompt_sha[:16] + '...' if prompt_sha else 'not found'}")
    print(f"  ai_risk distribution:")
    by_risk: dict[int, int] = {}
    for entry in run.scores.values():
        by_risk[entry.ai_risk] = by_risk.get(entry.ai_risk, 0) + 1
    for risk in sorted(by_risk):
        bar = "█" * by_risk[risk]
        print(f"    {risk:>2d} {by_risk[risk]:>3d} {bar}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
