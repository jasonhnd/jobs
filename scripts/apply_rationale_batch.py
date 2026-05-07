"""
apply_rationale_batch.py — merge a batch of LLM-generated rationales into
dist/data.detail/<id>.json files.

The batch JSON format (one file per batch, kept under data/rationales/ for
audit traceability):

    {
        "1": {
            "rationale_long_ja": "...",
            "displaceable_tasks_ja": ["...", "...", ...],
            "resilient_tasks_ja": ["...", "...", ...],
            "horizon_5y_ja": "..."
        },
        "2": { ... },
        ...
    }

Per occupation, this script:
  - Loads dist/data.detail/<id padded>.json
  - Merges 4 LLM fields into ai_risk + adds rationale_generated_at + rationale_model
  - Atomically rewrites the file (compact one-line JSON, matches existing format)

Idempotent: re-running on the same batch overwrites with the same data.

Usage:
    python scripts/apply_rationale_batch.py --input data/rationales/batch_01.json
    python scripts/apply_rationale_batch.py --input data/rationales/batch_01.json --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DETAIL = ROOT / "dist" / "data.detail"

DEFAULT_GENERATED_AT = "2026-05-07"
DEFAULT_MODEL = "claude-opus-4-7"

REQUIRED_FIELDS: tuple[str, ...] = (
    "rationale_long_ja",
    "displaceable_tasks_ja",
    "resilient_tasks_ja",
    "horizon_5y_ja",
)


def _validate_payload(payload: dict) -> list[str]:
    """Return list of structural problems; empty list = OK."""
    problems: list[str] = []
    for key, fields in payload.items():
        try:
            int(key)
        except ValueError:
            problems.append(f"non-integer occupation key: {key!r}")
            continue
        if not isinstance(fields, dict):
            problems.append(f"id={key}: value must be dict, got {type(fields).__name__}")
            continue
        for f in REQUIRED_FIELDS:
            if f not in fields:
                problems.append(f"id={key}: missing field {f!r}")
        if not isinstance(fields.get("displaceable_tasks_ja"), list):
            problems.append(f"id={key}: displaceable_tasks_ja must be list")
        if not isinstance(fields.get("resilient_tasks_ja"), list):
            problems.append(f"id={key}: resilient_tasks_ja must be list")
    return problems


def _apply_one(occ_id: int, fields: dict, generated_at: str, model: str, dry_run: bool) -> tuple[bool, str]:
    """Apply rationale fields to one occupation file. Returns (ok, message)."""
    path = DETAIL / f"{occ_id:04d}.json"
    if not path.exists():
        return False, f"detail file not found: {path}"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return False, f"JSON parse error: {exc}"

    title = data.get("title", {}).get("ja", "?")
    ai = data.setdefault("ai_risk", {})
    ai["rationale_long_ja"] = fields["rationale_long_ja"]
    ai["displaceable_tasks_ja"] = fields["displaceable_tasks_ja"]
    ai["resilient_tasks_ja"] = fields["resilient_tasks_ja"]
    ai["horizon_5y_ja"] = fields["horizon_5y_ja"]
    ai["rationale_generated_at"] = generated_at
    ai["rationale_model"] = model

    long_len = len(fields["rationale_long_ja"])
    horizon_len = len(fields["horizon_5y_ja"])
    summary = (
        f"id={occ_id:>3} {title:<14} "
        f"long={long_len:>3} horizon={horizon_len:>3}"
    )

    if dry_run:
        return True, f"[DRY] {summary}"

    # Compact one-line JSON to match existing format. Atomic write via .tmp swap.
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)
    return True, f"[OK]  {summary}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--input", required=True, help="Path to batch JSON file.")
    ap.add_argument("--generated-at", default=DEFAULT_GENERATED_AT, help="ISO date stamp.")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="Model slug.")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate payload + print what would change, no file writes.",
    )
    args = ap.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[FATAL] input file not found: {input_path}", file=sys.stderr)
        return 2

    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        print(f"[FATAL] input must be JSON object, got {type(payload).__name__}", file=sys.stderr)
        return 2

    problems = _validate_payload(payload)
    if problems:
        print("[FATAL] payload structural problems:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 2

    ok_count = 0
    fail_count = 0
    for key, fields in payload.items():
        occ_id = int(key)
        ok, msg = _apply_one(
            occ_id=occ_id,
            fields=fields,
            generated_at=args.generated_at,
            model=args.model,
            dry_run=args.dry_run,
        )
        print(f"  {msg}")
        if ok:
            ok_count += 1
        else:
            fail_count += 1

    print()
    print(
        f"Applied {ok_count}/{len(payload)} from {input_path.name} "
        f"{'(dry-run)' if args.dry_run else ''}"
    )
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
