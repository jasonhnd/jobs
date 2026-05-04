"""build_data.py — orchestrator for the IPD-era build pipeline.

Per DATA_ARCHITECTURE.md §7.1 / §7.2 / §7.6.

Inputs (sources, all under data/):
    occupations/<padded>.json    × 556  Source occupation records
    translations/en/<padded>.json × 552  English translations
    stats_legacy/<padded>.json   × 552  Salary / workers / ... patch layer
    scores/*.json                ×  N   AI score runs (永不删)
    labels/*.ja-en.json          ×  7   Standard label dictionaries

Outputs (projections, all under dist/):
    Per §6.0 总表 — 9 families / 10 file types.
    By default this run emits ONLY the 4 Planned families:
        data.treemap.json, data.detail/, data.search.json, data.labels/
    Future families (tasks/skills/holland/featured/score-history) require
        --enable-future to emit.

Validation policy (§7.6):
    L1 schema:        Pydantic validation on every source file (in indexes.py)
    L2 consistency:   cross-references checked in indexes.py
    L3 projection sanity: post-build assertions in this file
    Exit code:
        0 = all good
        1 = source validation or projection sanity failure
        2 = unexpected exception

Atomic build (§7.6.3):
    Outputs are written to dist.next/, then swapped atomically. On any failure,
    existing dist/ is left untouched.

Usage:
    uv run python scripts/build_data.py                  # default: 4 Planned projections
    uv run python scripts/build_data.py --enable-future  # also emit 5 Future projections
    uv run python scripts/build_data.py --validate-only  # L1 + L2 only, no dist/ write
    uv run python scripts/build_data.py --dist-root build/dist  # custom output dir
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))      # for `from schema.* import ...`
sys.path.insert(0, str(ROOT / "scripts"))    # for `from lib.* import ...` and `from projections.* import ...`

from lib.atomic_write import AtomicDist  # noqa: E402
from lib.indexes import Indexes, build_indexes  # noqa: E402
from projections import (  # noqa: E402
    detail,
    featured,
    holland,
    labels,
    profile5,
    score_history,
    search,
    sectors,
    skills,
    tasks,
    transfer_paths,
    treemap,
)

DATA_ROOT = ROOT / "data"
DEFAULT_DIST_ROOT = ROOT / "dist"

# Planned projections — always emitted.
# Order matters: `sectors` runs first so downstream projections (treemap, detail,
# search, transfer_paths) can attach sector_id to each record without re-resolving.
# `profile5` runs before `transfer_paths` (latter does not depend on former,
# but keeps the "structural derivations first, recommendation algos last" order).
PLANNED_PROJECTIONS: dict[str, Callable] = {
    "sectors": sectors.build,
    "treemap": treemap.build,
    "detail": detail.build,
    "search": search.build,
    "labels": labels.build,
    "profile5": profile5.build,
    "transfer_paths": transfer_paths.build,
}

# Future projections — emitted only with --enable-future
FUTURE_PROJECTIONS: dict[str, Callable] = {
    "tasks": tasks.build,
    "skills": skills.build,
    "holland": holland.build,
    "featured": featured.build,
    "score_history": score_history.build,
}


# ---------- L3: post-build sanity checks ----------

def run_projection_sanity(indexes: Indexes, dist_root: Path, enabled_keys: set[str]) -> list[str]:
    """Return list of human-readable failure messages; empty list = all green."""
    failures: list[str] = []

    if "treemap" in enabled_keys:
        f = dist_root / "data.treemap.json"
        if not f.exists():
            failures.append(f"missing {f.name}")
        else:
            import json
            data = json.loads(f.read_text())
            if not isinstance(data, list):
                failures.append("treemap must be a top-level array")
            else:
                # treemap filters to occupations with both stats AND ai_risk
                expected = sum(
                    1 for oid in indexes.occ_by_id
                    if oid in indexes.stats_by_id and oid in indexes.latest_score_by_occ
                )
                if len(data) != expected:
                    failures.append(
                        f"treemap record count ({len(data)}) != filtered occupations ({expected})"
                    )
                # Spot-check schema on first record
                if data and not all(k in data[0] for k in ("id", "name_ja", "ai_risk", "salary", "workers")):
                    failures.append(f"treemap record schema missing required keys: {sorted(data[0].keys())}")

    if "detail" in enabled_keys:
        d = dist_root / "data.detail"
        if not d.exists():
            failures.append("missing data.detail/")
        else:
            count = len(list(d.glob("*.json")))
            if count != len(indexes.occ_by_id):
                failures.append(f"detail file count ({count}) != occupations ({len(indexes.occ_by_id)})")

    if "search" in enabled_keys:
        f = dist_root / "data.search.json"
        if not f.exists():
            failures.append("missing data.search.json")
        else:
            import json
            data = json.loads(f.read_text())
            if data["document_count"] != len(indexes.occ_by_id):
                failures.append(
                    f"search document_count ({data['document_count']}) != occupations ({len(indexes.occ_by_id)})"
                )

    if "labels" in enabled_keys:
        for lang in ("ja", "en"):
            f = dist_root / "data.labels" / f"{lang}.json"
            if not f.exists():
                failures.append(f"missing data.labels/{lang}.json")

    if "sectors" in enabled_keys and indexes.sectors:
        # Sectors projection emits two files; review_queue is informational
        # but data.sectors.json is the contract.
        f = dist_root / "data.sectors.json"
        if not f.exists():
            failures.append("missing data.sectors.json")
        else:
            import json
            data = json.loads(f.read_text())
            sectors_out = data.get("sectors", [])
            if len(sectors_out) < len(indexes.sectors):
                failures.append(
                    f"data.sectors.json has {len(sectors_out)} entries, "
                    f"expected at least {len(indexes.sectors)}"
                )
            # Sanity: every defined sector should be present (even if 0 occupations)
            present_ids = {s["id"] for s in sectors_out}
            missing = [s.id for s in indexes.sectors if s.id not in present_ids]
            if missing:
                failures.append(f"data.sectors.json missing sector ids: {missing}")

    if "skills" in enabled_keys:
        d = dist_root / "data.skills"
        skill_files = len(list(d.glob("*.json"))) - 1  # minus _index.json
        expected = len(indexes.labels_by_dim.get("skills", {}))
        if skill_files != expected:
            failures.append(f"skills per-skill file count ({skill_files}) != skills labels ({expected})")
        if not (d / "_index.json").exists():
            failures.append("missing data.skills/_index.json")

    return failures


# ---------- main ----------

def main() -> int:
    ap = argparse.ArgumentParser(description="Build dist/ projections from data/")
    ap.add_argument("--validate-only", action="store_true",
                    help="Run L1 + L2 validation only; do not write dist/")
    ap.add_argument("--enable-future", action="store_true",
                    help="Also emit Future projections (tasks/skills/holland/featured/score_history)")
    ap.add_argument("--dist-root", type=Path, default=DEFAULT_DIST_ROOT,
                    help=f"Output directory (default: {DEFAULT_DIST_ROOT.relative_to(ROOT)})")
    args = ap.parse_args()

    print("=" * 70)
    print("build_data.py — IPD pipeline")
    print(f"  data root:    {DATA_ROOT.relative_to(ROOT)}")
    print(f"  dist root:    {args.dist_root.relative_to(ROOT) if args.dist_root.is_relative_to(ROOT) else args.dist_root}")
    print(f"  mode:         {'validate-only' if args.validate_only else 'build'}")
    print(f"  future:       {'enabled' if args.enable_future else 'disabled (default)'}")
    print(f"  started at:   {dt.datetime.now().isoformat(timespec='seconds')}")
    print("=" * 70)

    # ----- L1 + L2: load + validate everything -----
    print("\n[L1+L2] Loading + validating sources …")
    try:
        indexes, errors = build_indexes(DATA_ROOT)
    except Exception as e:
        print(f"FATAL: build_indexes raised: {e}", file=sys.stderr)
        return 2

    if errors:
        print(f"\n  ❌ {len(errors)} validation error(s):")
        for path, msg in errors[:10]:
            try:
                rel = path.relative_to(ROOT)
            except ValueError:
                rel = path
            print(f"    {rel}: {msg[:200]}")
        if len(errors) > 10:
            print(f"    … and {len(errors) - 10} more")
        return 1
    print(f"  ✅ all source files valid")
    print(f"     occupations:        {len(indexes.occ_by_id)}")
    print(f"     translations:       {len(indexes.trans_by_id)}")
    print(f"     stats_legacy:       {len(indexes.stats_by_id)}")
    print(f"     score histories:    {len(indexes.history_by_occ)}")
    print(f"     latest scores:      {len(indexes.latest_score_by_occ)}")
    print(f"     labels dimensions:  {len(indexes.labels_by_dim)}")

    if args.validate_only:
        print("\n[validate-only] no dist/ write; exiting 0")
        return 0

    # ----- Build all enabled projections atomically -----
    enabled = dict(PLANNED_PROJECTIONS)
    if args.enable_future:
        enabled.update(FUTURE_PROJECTIONS)

    print(f"\n[build] {len(enabled)} projection family/families enabled: {', '.join(enabled)}")
    print(f"        atomic stage: {args.dist_root.name}.next/")

    try:
        with AtomicDist(args.dist_root) as staging:
            for name, build_fn in enabled.items():
                t0 = dt.datetime.now()
                result = build_fn(indexes, staging)
                dt_ms = int((dt.datetime.now() - t0).total_seconds() * 1000)
                print(f"  ✅ {name:18s} {dt_ms:>5d} ms  {_summarize(result)}")
    except Exception as e:
        print(f"\nFATAL during build: {type(e).__name__}: {e}", file=sys.stderr)
        return 2

    # ----- L3: projection sanity -----
    print(f"\n[L3] projection sanity checks …")
    failures = run_projection_sanity(indexes, args.dist_root, set(enabled))
    if failures:
        print(f"  ❌ {len(failures)} failure(s):")
        for f in failures:
            print(f"    {f}")
        return 1
    print(f"  ✅ all sanity checks passed")

    # ----- Footer -----
    print("\n" + "=" * 70)
    print(f"BUILD OK at {dt.datetime.now().isoformat(timespec='seconds')}")
    print(f"  dist root: {args.dist_root.relative_to(ROOT) if args.dist_root.is_relative_to(ROOT) else args.dist_root}")
    print("=" * 70)
    return 0


def _summarize(result) -> str:
    """Short one-line summary of a projection result dict."""
    if not isinstance(result, dict):
        return ""
    parts = []
    for k in ("rows", "files", "documents", "skill_files", "picked"):
        if k in result:
            parts.append(f"{k}={result[k]}")
    return " ".join(parts)


if __name__ == "__main__":
    raise SystemExit(main())
