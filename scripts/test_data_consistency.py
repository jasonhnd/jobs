#!/usr/bin/env python3
"""test_data_consistency.py — L3 projection sanity per DATA_ARCHITECTURE.md §7.6.

This script validates the BUILT projections in dist/ (post `npm run build:data`).
Source-data L1 + L2 validation is done inside build_data.py.

Checks:
    - Required Planned projection files exist
    - Counts match: treemap rows == search documents == detail file count
    - ID consistency: every detail file id is in source occupations
    - Field-level: required cols present in treemap; required keys in detail
    - Plausibility: ai_risk in [0, 10]; workforce reasonable; non-degenerate distribution

Usage:
    npm run test:data
    uv run python scripts/test_data_consistency.py
    uv run python scripts/test_data_consistency.py --dist-root path/to/dist
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Per §6.1 (revised v1.0.8 + v1.4.0) — treemap is array of objects, not columnar.
# These are the fields index.html consumes; missing any = projection bug.
# v1.4.0: name_en / ai_rationale_en dropped when the English UI was removed.
TREEMAP_REQUIRED_KEYS = {
    "id", "name_ja",
    "salary", "workers", "hours", "age", "recruit_wage", "recruit_ratio", "hourly_wage",
    "ai_risk", "ai_rationale_ja",
    "education_pct", "employment_type",
    "url",
}
RISK_TIERS = ("low", "mid", "high")
JAPAN_WORKFORCE_LIMIT = 70_000_000  # ~67M working population, leave headroom


@dataclass
class Report:
    errors: list[str]
    warnings: list[str]
    info: list[str]

    def fail(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def note(self, msg: str) -> None:
        self.info.append(msg)


# ---------- Individual checks ----------

def check_planned_files_exist(dist_root: Path, r: Report) -> None:
    required = [
        dist_root / "data.treemap.json",
        dist_root / "data.search.json",
        dist_root / "data.labels" / "ja.json",
        dist_root / "data.detail",
        dist_root / "data.sectors.json",       # v1.1.0
        dist_root / "data.review_queue.json",  # v1.1.0
    ]
    for path in required:
        if not path.exists():
            r.fail(f"missing required projection: {path.relative_to(REPO)}")


def check_treemap(dist_root: Path, r: Report) -> list[dict]:
    """Returns parsed treemap records for downstream checks (or [] on failure)."""
    f = dist_root / "data.treemap.json"
    if not f.exists():
        return []
    try:
        data = json.loads(f.read_text())
    except json.JSONDecodeError as e:
        r.fail(f"data.treemap.json is invalid JSON: {e}")
        return []

    if not isinstance(data, list):
        r.fail(f"data.treemap.json must be a top-level array (got {type(data).__name__})")
        return []

    seen_ids: set[int] = set()
    risk_counts: Counter[str] = Counter()
    workforce = 0
    salary_present = age_present = workers_present = 0
    n_with_score = 0
    schema_drift_reported = False

    for i, rec in enumerate(data):
        if not isinstance(rec, dict):
            r.fail(f"treemap[{i}] is not an object")
            continue
        # Schema spot-check (only complain once)
        if not schema_drift_reported:
            missing = TREEMAP_REQUIRED_KEYS - set(rec.keys())
            if missing:
                r.fail(f"treemap record missing required keys: {sorted(missing)}")
                schema_drift_reported = True

        rid = rec.get("id")
        if rid in seen_ids:
            r.fail(f"duplicate id in treemap: {rid}")
        seen_ids.add(rid)
        if not isinstance(rec.get("name_ja"), str) or not rec.get("name_ja"):
            r.fail(f"id={rid} treemap name_ja empty/non-string")

        ai_risk = rec.get("ai_risk")
        if ai_risk is not None:
            if not (0 <= ai_risk <= 10):
                r.fail(f"id={rid} ai_risk out of range: {ai_risk}")
            tier = "low" if ai_risk < 5 else ("mid" if ai_risk < 7 else "high")
            risk_counts[tier] += 1
            n_with_score += 1
        if rec.get("salary") is not None:
            salary_present += 1
        if rec.get("workers") is not None:
            workers_present += 1
            workforce += rec["workers"]

    n = len(data)
    r.note(f"treemap: {n} records, {len(seen_ids)} unique ids")
    r.note(f"  ai_risk coverage:  {n_with_score}/{n} ({n_with_score / n:.0%})")
    r.note(f"  salary coverage:   {salary_present}/{n} ({salary_present / n:.0%})")
    r.note(f"  workers coverage:  {workers_present}/{n} ({workers_present / n:.0%})")
    r.note(f"  workforce total:   {workforce:,}")
    r.note(f"  risk tiers:        low={risk_counts['low']} mid={risk_counts['mid']} high={risk_counts['high']}")

    if workforce > JAPAN_WORKFORCE_LIMIT:
        r.fail(f"workforce total {workforce:,} exceeds Japan's ~67M ceiling — normalization broken?")
    if workforce < 10_000_000:
        r.warn(f"workforce total {workforce:,} suspiciously low")

    for tier in RISK_TIERS:
        if risk_counts[tier] == 0 and n_with_score > 0:
            r.warn(f"zero records in risk tier {tier!r} — distribution degenerate?")

    return data


def check_search(dist_root: Path, r: Report, expected_count: int) -> None:
    """Search projection covers ALL occupations (not just those filtered into treemap)."""
    f = dist_root / "data.search.json"
    if not f.exists():
        return
    try:
        data = json.loads(f.read_text())
    except json.JSONDecodeError as e:
        r.fail(f"data.search.json is invalid JSON: {e}")
        return

    docs = data.get("documents", [])
    if expected_count and len(docs) != expected_count:
        r.fail(f"search document_count ({len(docs)}) != total source occupations ({expected_count})")

    seen: set[int] = set()
    for d in docs:
        rid = d.get("id")
        if rid in seen:
            r.fail(f"duplicate id in search: {rid}")
        seen.add(rid)
        if not d.get("title_ja"):
            r.fail(f"id={rid} search missing title_ja")


def check_detail_files(dist_root: Path, r: Report, expected_ids: set[int]) -> None:
    """Detail projection covers ALL source occupations (one file per id, 4-digit padded)."""
    d = dist_root / "data.detail"
    if not d.exists():
        return
    files = sorted(d.glob("*.json"))
    if len(files) != len(expected_ids):
        r.fail(f"detail file count ({len(files)}) != total source occupations ({len(expected_ids)})")

    file_ids: set[int] = set()
    for f in files:
        try:
            stem_id = int(f.stem)
        except ValueError:
            r.fail(f"detail file with non-int name: {f.name}")
            continue
        # Check stem matches inner id
        try:
            data = json.loads(f.read_text())
        except json.JSONDecodeError as e:
            r.fail(f"detail/{f.name} invalid JSON: {e}")
            continue
        if data.get("id") != stem_id:
            r.fail(f"detail/{f.name} inner id {data.get('id')} != filename stem {stem_id}")
        if not data.get("title", {}).get("ja"):
            r.fail(f"detail/{f.name} missing title.ja")
        # Padding check (per §3A.4): filename must be 4-digit zero-padded
        if len(f.stem) != 4:
            r.fail(f"detail/{f.name} filename must be 4-digit zero-padded")
        file_ids.add(stem_id)

    missing = expected_ids - file_ids
    extra = file_ids - expected_ids
    if missing:
        r.fail(f"detail/ missing ids present in source occupations: {sorted(missing)[:5]}")
    if extra:
        r.fail(f"detail/ has ids not in source occupations: {sorted(extra)[:5]}")


def check_labels(dist_root: Path, r: Report) -> None:
    for lang in ("ja", "en"):
        f = dist_root / "data.labels" / f"{lang}.json"
        if not f.exists():
            continue
        try:
            data = json.loads(f.read_text())
        except json.JSONDecodeError as e:
            r.fail(f"data.labels/{lang}.json invalid JSON: {e}")
            continue
        if data.get("lang") != lang:
            r.fail(f"data.labels/{lang}.json has wrong lang field: {data.get('lang')}")
        # Expect 7 dimensions per §2.5
        dims = [k for k in data if k not in {"schema_version", "lang", "generated_at"}]
        if len(dims) != 7:
            r.warn(f"data.labels/{lang}.json has {len(dims)} dimensions, expected 7")


# ───── v1.1.0 sector subsystem checks (per §6.11) ─────

VALID_HUE = {"safe", "mid", "warm", "risk"}
VALID_RISK_BAND = {"low", "mid", "high", None}
VALID_WORKFORCE_BAND = {"small", "mid", "large", None}
VALID_DEMAND_BAND = {"cold", "normal", "hot", None}

# Minimum bound per sector — guards against a sector becoming an orphan after
# a future seed_codes / overrides edit. Tune as needed.
MIN_OCCUPATIONS_PER_SECTOR = 5


def check_sectors(dist_root: Path, r: Report) -> set[str] | None:
    """Validate data.sectors.json + return the set of valid sector_ids
    (used by check_treemap_v110 and check_review_queue)."""
    f = dist_root / "data.sectors.json"
    if not f.exists():
        return None
    try:
        data = json.loads(f.read_text())
    except json.JSONDecodeError as e:
        r.fail(f"data.sectors.json invalid JSON: {e}")
        return None

    sectors = data.get("sectors", [])
    if not sectors:
        r.fail("data.sectors.json has no sectors")
        return None

    sector_ids: set[str] = set()
    seen_ids: set[str] = set()
    for s in sectors:
        sid = s.get("id")
        if not sid:
            r.fail("sector entry missing id")
            continue
        if sid in seen_ids:
            r.fail(f"duplicate sector id: {sid}")
        seen_ids.add(sid)
        sector_ids.add(sid)

        if s.get("hue") not in VALID_HUE:
            r.fail(f"sector {sid} has invalid hue: {s.get('hue')}")
        count = s.get("occupation_count", 0)
        # _uncategorized may legitimately be empty; everything else has a floor.
        if sid != "_uncategorized" and count < MIN_OCCUPATIONS_PER_SECTOR:
            r.warn(f"sector {sid} has only {count} occupations (min {MIN_OCCUPATIONS_PER_SECTOR})")
        if not isinstance(s.get("ja"), str) or not s.get("ja"):
            r.fail(f"sector {sid} missing ja label")

    r.note(f"sectors: {len(sectors)} entries, {sum(s.get('occupation_count', 0) for s in sectors)} occupations covered")
    return sector_ids


def check_review_queue(dist_root: Path, r: Report) -> None:
    f = dist_root / "data.review_queue.json"
    if not f.exists():
        return
    try:
        data = json.loads(f.read_text())
    except json.JSONDecodeError as e:
        r.fail(f"data.review_queue.json invalid JSON: {e}")
        return

    summary = data.get("summary", {})
    uncat = summary.get("uncategorized", 0)
    ambig = summary.get("ambiguous", 0)
    r.note(f"review_queue: uncategorized={uncat} ambiguous={ambig} overrides={summary.get('override_count', 0)}")
    # Hard floor: uncategorized/ambiguous = 0 is the goal but not a build blocker.
    if uncat > 0:
        r.warn(f"{uncat} occupation(s) uncategorized — extend sectors.ja-en.json or overrides.json")
    if ambig > 0:
        r.warn(f"{ambig} occupation(s) ambiguous — disambiguate via overrides.json")


def check_treemap_v110(treemap_records: list[dict], sector_ids: set[str] | None, r: Report) -> None:
    """v1.1.0 additive checks — sector + 3 bands present and valid on every record."""
    if not treemap_records:
        return
    # Sample-check first record + count band coverage.
    sample = treemap_records[0]
    for k in ("sector_id", "sector_ja", "hue", "risk_band", "workforce_band", "demand_band"):
        if k not in sample:
            r.fail(f"treemap[0] missing v1.1.0 field: {k}")

    risk_bands: Counter[str] = Counter()
    wf_bands: Counter[str] = Counter()
    demand_bands: Counter[str] = Counter()
    bad_sectors: list[int] = []
    for rec in treemap_records:
        rid = rec.get("id")
        sid = rec.get("sector_id")
        if sector_ids is not None and sid not in sector_ids:
            # Allow the sentinel for legacy parity but flag everything else.
            if sid != "_uncategorized":
                bad_sectors.append(rid)
        if rec.get("hue") not in VALID_HUE | {None}:
            r.fail(f"id={rid} treemap hue invalid: {rec.get('hue')}")
        if rec.get("risk_band") not in VALID_RISK_BAND:
            r.fail(f"id={rid} risk_band invalid: {rec.get('risk_band')}")
        if rec.get("workforce_band") not in VALID_WORKFORCE_BAND:
            r.fail(f"id={rid} workforce_band invalid: {rec.get('workforce_band')}")
        if rec.get("demand_band") not in VALID_DEMAND_BAND:
            r.fail(f"id={rid} demand_band invalid: {rec.get('demand_band')}")
        risk_bands[rec.get("risk_band") or "null"] += 1
        wf_bands[rec.get("workforce_band") or "null"] += 1
        demand_bands[rec.get("demand_band") or "null"] += 1

    if bad_sectors:
        r.fail(f"treemap has unknown sector_id values for ids: {bad_sectors[:5]}")

    r.note(f"  risk_band:         low={risk_bands['low']} mid={risk_bands['mid']} high={risk_bands['high']}")
    r.note(f"  workforce_band:    small={wf_bands['small']} mid={wf_bands['mid']} large={wf_bands['large']}")
    r.note(f"  demand_band:       cold={demand_bands['cold']} normal={demand_bands['normal']} hot={demand_bands['hot']}")


# ---------- Orchestrator ----------

def main() -> int:
    ap = argparse.ArgumentParser(description="L3 projection sanity for dist/")
    ap.add_argument("--dist-root", type=Path, default=REPO / "dist",
                    help="Path to built dist/ (default: ./dist)")
    args = ap.parse_args()

    r = Report(errors=[], warnings=[], info=[])

    if not args.dist_root.exists():
        r.fail(f"dist root does not exist: {args.dist_root}")
        return _report(r)

    print(f"Checking projections in {args.dist_root.relative_to(REPO) if args.dist_root.is_relative_to(REPO) else args.dist_root}")
    print()

    check_planned_files_exist(args.dist_root, r)
    treemap_records = check_treemap(args.dist_root, r)
    # detail/ + search/ are supersets of treemap (they include the 4 new IPD occupations
    # which lack stats/ai_risk and are filtered out of treemap). Use the source occ count
    # for the supersets.
    occ_dir = REPO / "data" / "occupations"
    all_occ_ids = {int(f.stem) for f in occ_dir.glob("*.json")}
    check_search(args.dist_root, r, len(all_occ_ids))
    check_detail_files(args.dist_root, r, all_occ_ids)
    check_labels(args.dist_root, r)

    # v1.1.0 sector subsystem
    sector_ids = check_sectors(args.dist_root, r)
    check_review_queue(args.dist_root, r)
    check_treemap_v110(treemap_records, sector_ids, r)

    return _report(r)


def _report(r: Report) -> int:
    for line in r.info:
        print(line)
    if r.warnings:
        print()
        print("WARNINGS:")
        for w in r.warnings:
            print(f"  ⚠ {w}")
    if r.errors:
        print()
        print("ERRORS:")
        for e in r.errors:
            print(f"  ✗ {e}")
        return 1
    print()
    print("✓ projections pass L3 consistency checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
