#!/usr/bin/env python3
"""
test_data_consistency.py — sanity checks for data.json after each pipeline run.

Run:  npm run test:data    (or)    python3 scripts/test_data_consistency.py

Catches the kind of bug Audit CODE-004 surfaced: missing fields silently
collapsed to 0, broken risk distributions, suspicious workforce sums.
Returns exit code 1 if any check fails, 0 if everything looks good.
"""
from __future__ import annotations
import json
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data.json"

REQUIRED = {"id", "name_ja", "ai_risk"}
TIER_BUCKETS = ("low", "mid", "high")


def main() -> int:
    if not DATA.exists():
        print(f"FAIL: {DATA} not found.", file=sys.stderr)
        return 1
    raw = json.loads(DATA.read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(raw, list) or len(raw) == 0:
        errors.append("data.json must be a non-empty list of occupation records.")
        return _report(errors, warnings)

    seen_ids: set[int] = set()
    risk_counts: Counter = Counter()
    workers_total = 0
    salary_present = 0
    age_present = 0
    workers_present = 0

    for i, rec in enumerate(raw):
        for f in REQUIRED:
            if f not in rec or rec[f] is None:
                errors.append(f"record[{i}] missing required field {f!r} (id={rec.get('id')})")
        rid = rec.get("id")
        if rid in seen_ids:
            errors.append(f"duplicate id: {rid}")
        seen_ids.add(rid)
        risk = rec.get("ai_risk")
        if risk is not None:
            if not (0 <= risk <= 10):
                errors.append(f"id={rid} ai_risk out of range: {risk}")
            tier = "low" if risk < 5 else ("mid" if risk < 7 else "high")
            risk_counts[tier] += 1
        if rec.get("salary"):
            salary_present += 1
        if rec.get("age"):
            age_present += 1
        if rec.get("workers"):
            workers_present += 1
            workers_total += rec["workers"]

    n = len(raw)

    # Coverage warnings — not failures, just visibility.
    salary_cov = salary_present / n
    age_cov = age_present / n
    workers_cov = workers_present / n
    if salary_cov < 0.8:
        warnings.append(f"low salary coverage: {salary_present}/{n} ({salary_cov:.0%})")
    if age_cov < 0.8:
        warnings.append(f"low age coverage: {age_present}/{n} ({age_cov:.0%})")
    if workers_cov < 0.8:
        warnings.append(f"low workers coverage: {workers_present}/{n} ({workers_cov:.0%})")

    # Plausibility — total workforce should not exceed Japan's working pop (~67M).
    if workers_total > 70_000_000:
        errors.append(f"workforce total {workers_total:,} exceeds Japan's ~67M — normalization probably broken")
    if workers_total < 10_000_000:
        warnings.append(f"workforce total {workers_total:,} suspiciously low")

    # Risk distribution should be non-degenerate.
    for tier in TIER_BUCKETS:
        if risk_counts[tier] == 0:
            warnings.append(f"zero records in risk tier {tier!r} — distribution degenerate?")

    print(f"data.json: {n} records, {len(seen_ids)} unique ids")
    print(f"  salary coverage:  {salary_present}/{n} ({salary_cov:.0%})")
    print(f"  age coverage:     {age_present}/{n} ({age_cov:.0%})")
    print(f"  workers coverage: {workers_present}/{n} ({workers_cov:.0%})")
    print(f"  workforce total:  {workers_total:,}")
    print(f"  risk tiers:       low={risk_counts['low']} mid={risk_counts['mid']} high={risk_counts['high']}")

    return _report(errors, warnings)


def _report(errors: list[str], warnings: list[str]) -> int:
    if warnings:
        print()
        print("WARNINGS:")
        for w in warnings:
            print(f"  ⚠ {w}")
    if errors:
        print()
        print("ERRORS:")
        for e in errors:
            print(f"  ✗ {e}")
        return 1
    print("\n✓ data.json passes consistency checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
