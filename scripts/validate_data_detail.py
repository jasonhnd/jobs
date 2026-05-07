"""
validate_data_detail.py — verify dist/data.detail/*.json schema integrity.

Phase 1 SEO enrichment validator. Runs over every per-occupation detail
file and checks both the legacy 1.2 schema and the optional Phase 1
enrichment fields.

Per-file checks:
  Required:
    - JSON parses
    - schema_version in {"1.2", "1.3"}
    - id present
    - ai_risk.score numeric (WARN if absent — id 581-584 are known to lack it)
    - ai_risk.rationale_ja non-empty string (WARN if absent)
  Optional Phase 1 enrichment (validated when rationale_long_ja is present):
    - rationale_long_ja:      string, length in [200, 400]
    - horizon_5y_ja:          string, length in [60, 130]
    - displaceable_tasks_ja:  list[str], 3-5 items, each ≤30 chars
    - resilient_tasks_ja:     list[str], 3-5 items, each ≤30 chars
    - no overlap between the two task lists

Exit code:
  0 — no ERROR (WARN-only is acceptable)
  1 — at least one ERROR
  2 — fatal (no detail files found, etc.)

Usage:
    python scripts/validate_data_detail.py
    python scripts/validate_data_detail.py --quiet  # only ERROR + summary
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DETAIL = ROOT / "dist" / "data.detail"

# Constraint constants — single source of truth, edit here to tune the rubric.
ALLOWED_SCHEMA_VERSIONS = {"1.2", "1.3"}
RATIONALE_LONG_MIN = 200
RATIONALE_LONG_MAX = 400
TASK_LIST_MIN = 3
TASK_LIST_MAX = 5
TASK_NAME_MAX_LEN = 30
HORIZON_MIN = 60
HORIZON_MAX = 130


@dataclass
class FileReport:
    path: Path
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    enriched: bool = False  # True when rationale_long_ja is present


def _validate_required(data: dict, report: FileReport) -> None:
    """Check fields that must exist on every file regardless of enrichment state."""
    if "id" not in data:
        report.errors.append("missing required field: id")
    sv = data.get("schema_version")
    if sv not in ALLOWED_SCHEMA_VERSIONS:
        report.errors.append(
            f"schema_version={sv!r} not in {sorted(ALLOWED_SCHEMA_VERSIONS)}"
        )
    ai = data.get("ai_risk")
    if not isinstance(ai, dict):
        # id 581-584 are known to lack ai_risk entirely. WARN, not error.
        report.warnings.append("ai_risk block missing (expected for id=581-584)")
        return
    if "score" not in ai:
        report.warnings.append("ai_risk.score missing (no AI scoring yet)")
    elif not isinstance(ai["score"], (int, float)):
        report.errors.append(
            f"ai_risk.score has non-numeric type: {type(ai['score']).__name__}"
        )
    if not ai.get("rationale_ja"):
        report.warnings.append("ai_risk.rationale_ja missing or empty")


def _validate_enrichment(ai: dict, report: FileReport) -> None:
    """Check Phase 1 enrichment fields. Only invoked if ai_risk is a dict."""
    long_text = ai.get("rationale_long_ja")
    if not long_text:
        report.warnings.append("ai_risk.rationale_long_ja missing (pre-enrichment)")
        return

    report.enriched = True

    if not isinstance(long_text, str):
        report.errors.append(
            f"rationale_long_ja must be str, got {type(long_text).__name__}"
        )
    else:
        n = len(long_text)
        if n < RATIONALE_LONG_MIN or n > RATIONALE_LONG_MAX:
            report.errors.append(
                f"rationale_long_ja length {n} outside [{RATIONALE_LONG_MIN},{RATIONALE_LONG_MAX}]"
            )

    horizon = ai.get("horizon_5y_ja")
    if not horizon:
        report.errors.append("horizon_5y_ja missing while rationale_long_ja is present")
    elif not isinstance(horizon, str):
        report.errors.append(
            f"horizon_5y_ja must be str, got {type(horizon).__name__}"
        )
    else:
        h = len(horizon)
        if h < HORIZON_MIN or h > HORIZON_MAX:
            report.errors.append(
                f"horizon_5y_ja length {h} outside [{HORIZON_MIN},{HORIZON_MAX}]"
            )

    displaceable = ai.get("displaceable_tasks_ja", [])
    resilient = ai.get("resilient_tasks_ja", [])
    _check_task_list(displaceable, "displaceable_tasks_ja", report)
    _check_task_list(resilient, "resilient_tasks_ja", report)

    # Overlap check — strict equality semantics.
    if isinstance(displaceable, list) and isinstance(resilient, list):
        overlap = set(displaceable) & set(resilient)
        if overlap:
            report.errors.append(
                f"displaceable/resilient overlap: {sorted(overlap)}"
            )


def _check_task_list(value, name: str, report: FileReport) -> None:
    if not isinstance(value, list):
        report.errors.append(f"{name} must be list, got {type(value).__name__}")
        return
    n = len(value)
    if n < TASK_LIST_MIN or n > TASK_LIST_MAX:
        report.errors.append(
            f"{name} length {n} outside [{TASK_LIST_MIN},{TASK_LIST_MAX}]"
        )
    for i, item in enumerate(value):
        if not isinstance(item, str):
            report.errors.append(
                f"{name}[{i}] must be str, got {type(item).__name__}"
            )
            continue
        if len(item) > TASK_NAME_MAX_LEN:
            report.errors.append(
                f"{name}[{i}] length {len(item)} > {TASK_NAME_MAX_LEN} ({item!r})"
            )


def validate_file(path: Path) -> FileReport:
    """Validate a single dist/data.detail/<id>.json file."""
    report = FileReport(path=path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        report.errors.append(f"JSON parse error: {exc}")
        return report
    except OSError as exc:
        report.errors.append(f"read error: {exc}")
        return report

    _validate_required(data, report)
    ai = data.get("ai_risk")
    if isinstance(ai, dict):
        _validate_enrichment(ai, report)
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-file WARN output; only print ERROR + final summary.",
    )
    args = ap.parse_args()

    files = sorted(DETAIL.glob("*.json"))
    if not files:
        print(f"[FATAL] no detail files found at {DETAIL}", file=sys.stderr)
        return 2

    error_total = 0
    warn_total = 0
    enriched_count = 0
    files_with_error = 0
    files_with_warn = 0

    for path in files:
        report = validate_file(path)
        error_total += len(report.errors)
        warn_total += len(report.warnings)
        if report.enriched:
            enriched_count += 1
        if report.errors:
            files_with_error += 1
        if report.warnings:
            files_with_warn += 1

        for msg in report.errors:
            print(f"[ERROR] {path.name}: {msg}")
        if not args.quiet:
            for msg in report.warnings:
                print(f"[WARN]  {path.name}: {msg}")

    print()
    print(
        f"Summary: {len(files)} files scanned | "
        f"{enriched_count} enriched | "
        f"{files_with_error} with ERROR ({error_total} total) | "
        f"{files_with_warn} with WARN ({warn_total} total)"
    )
    return 1 if error_total > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
