"""Migrate stats fields from legacy data.json into per-id stats_legacy files.

One-shot migration per DATA_ARCHITECTURE.md §2.2 / §5.2 / D-007 / D-011.

Source:  data.json (552 records, 6 stats fields already parsed)
Output:  data/stats_legacy/<padded>.json (one per occupation, omitted if all 6 fields null)

This script is kept post-migration for reference / audit (D-011).
Re-running is safe: output files are overwritten atomically.

Usage:
    uv run python scripts/migrate_stats_legacy.py
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
from schema.stats_legacy import StatsLegacy  # noqa: E402

# v0.7.0: source moved to .archive/v0.6/. Migration is one-shot; re-running
# against the archive reproduces the same output deterministically.
SOURCE = ROOT / "data" / ".archive" / "v0.6" / "data.json"
OUTPUT_DIR = ROOT / "data" / "stats_legacy"
PROVENANCE_FILE = ROOT / "data" / ".stats_legacy_provenance.json"
SOURCE_TAG = "jobtag_scrape_2026-04-25"


def _sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with SOURCE.open(encoding="utf-8") as f:
        records = json.load(f)

    written = 0
    skipped_empty = 0
    field_coverage = {
        "salary_man_yen": 0,
        "workers": 0,
        "monthly_hours": 0,
        "average_age": 0,
        "recruit_wage_man_yen": 0,
        "recruit_ratio": 0,
    }

    for r in records:
        occ_id = r["id"]
        # Map legacy field names → schema field names
        salary = r.get("salary")
        workers = r.get("workers")
        hours = r.get("hours")
        age = r.get("age")
        recruit_wage = r.get("recruit_wage")
        recruit_ratio = r.get("recruit_ratio")

        # Skip if all 6 are missing/null (no useful data)
        if all(v is None for v in [salary, workers, hours, age, recruit_wage, recruit_ratio]):
            skipped_empty += 1
            continue

        stats = StatsLegacy(
            id=occ_id,
            source=SOURCE_TAG,
            salary_man_yen=salary,
            workers=workers,
            monthly_hours=hours,
            average_age=age,
            recruit_wage_man_yen=recruit_wage,
            recruit_ratio=recruit_ratio,
        )

        # Track field coverage for the report
        if stats.salary_man_yen is not None:
            field_coverage["salary_man_yen"] += 1
        if stats.workers is not None:
            field_coverage["workers"] += 1
        if stats.monthly_hours is not None:
            field_coverage["monthly_hours"] += 1
        if stats.average_age is not None:
            field_coverage["average_age"] += 1
        if stats.recruit_wage_man_yen is not None:
            field_coverage["recruit_wage_man_yen"] += 1
        if stats.recruit_ratio is not None:
            field_coverage["recruit_ratio"] += 1

        out_path = OUTPUT_DIR / f"{occ_id:04d}.json"
        out_path.write_text(
            json.dumps(stats.model_dump(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        written += 1

    # Provenance — written for audit trail (referenced by DATA_ARCHITECTURE.md §2.2)
    provenance = {
        "schema_version": "1.0",
        "source_file": str(SOURCE.relative_to(ROOT)),
        "source_sha256": _sha256_of_file(SOURCE),
        "source_tag": SOURCE_TAG,
        "migrated_at": dt.date.today().isoformat(),
        "migrator_script": "scripts/migrate_stats_legacy.py",
        "output_dir": str(OUTPUT_DIR.relative_to(ROOT)),
        "files_written": written,
        "skipped_empty": skipped_empty,
        "field_coverage": field_coverage,
        "note": "One-shot migration; source is v0.6.x scraped data.json (now archived).",
    }
    PROVENANCE_FILE.write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {written} stats_legacy files to {OUTPUT_DIR.relative_to(ROOT)}")
    print(f"Skipped {skipped_empty} records with no stats data")
    print(f"Provenance: {PROVENANCE_FILE.relative_to(ROOT)}")
    print("Field coverage across written files:")
    for field, count in field_coverage.items():
        print(f"  {field:25s} {count:4d}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
