"""translate_descriptions.py — fill data/translations/en/<id>.json long-form fields.

Per docs/MOBILE_DESIGN.md §9.3 + DATA_ARCHITECTURE.md §2.4 (v1.1.0 extension).

Source       : data/occupations/<padded>.json -> description.{what_it_is_ja,
               how_to_become_ja, working_conditions_ja}
Destination  : data/translations/en/<padded>.json -> {what_it_is_en,
               how_to_become_en, working_conditions_en}

Idempotent: skips occupations whose target field already has content (unless
--force). Writes back the translation file in place; pretty-printed JSON for
git-friendliness; preserves all existing fields.

Cost / time estimate (Sonnet at default rate):
  - 552 occupations × 3 fields × ~500-800 chars per field ≈ 1M input chars
  - ~20-30 USD (rough; Sonnet output is shorter than input)
  - 30-60 min runtime with 8-way concurrency

Safety:
  - --limit N runs only the first N occupations (default: all)
  - --dry-run prints what would happen, no API calls
  - --force overwrites existing translations
  - Per-occupation API errors are caught and logged; the run continues

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    uv run python scripts/translate_descriptions.py --dry-run            # planning
    uv run python scripts/translate_descriptions.py --limit 5            # smoke test
    uv run python scripts/translate_descriptions.py                      # full run
    uv run python scripts/translate_descriptions.py --force --limit 10   # re-translate
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OCC_DIR = ROOT / "data" / "occupations"
EN_DIR = ROOT / "data" / "translations" / "en"

FIELDS = [
    # (source field on Occupation.description, target field on TranslationEN)
    ("what_it_is_ja",          "what_it_is_en"),
    ("how_to_become_ja",       "how_to_become_en"),
    ("working_conditions_ja",  "working_conditions_en"),
]

PROMPT_TEMPLATE = """Translate the following Japanese occupational description into clear, professional English suitable for a career-discovery website. Keep paragraph breaks. Do not add a preamble, summary, or any framing — return ONLY the translation. Preserve technical/industry terms; use standard English equivalents (e.g., "造園工" → "landscaper / arborist"; "公認会計士" → "Certified Public Accountant (CPA)"). Keep tone informative and neutral, not promotional. If a Japanese term has no clean English equivalent, render it as the original term followed by a brief gloss in parentheses on first use. The translation will be read on a mobile webpage by Japanese users practicing English or English-speaking researchers; clarity > literalness.

Occupation: {title_ja}
Section: {field_label}

JAPANESE TEXT:
{ja_text}
""".strip()

FIELD_LABELS = {
    "what_it_is_ja":         "What this work is",
    "how_to_become_ja":      "How to enter the profession",
    "working_conditions_ja": "Working conditions",
}


def _load_occupation(padded: str) -> dict:
    return json.loads((OCC_DIR / f"{padded}.json").read_text(encoding="utf-8"))


def _load_translation(padded: str) -> dict | None:
    path = EN_DIR / f"{padded}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save_translation(padded: str, data: dict) -> None:
    path = EN_DIR / f"{padded}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _needs_translation(translation: dict, force: bool) -> list[str]:
    """Return list of source field names that need translating for this occupation."""
    if force:
        return [src for src, _ in FIELDS]
    pending: list[str] = []
    for src, dest in FIELDS:
        existing = translation.get(dest)
        if not isinstance(existing, str) or not existing.strip():
            pending.append(src)
    return pending


def _translate_one(client, model: str, title_ja: str, src_field: str, ja_text: str) -> str:
    """Single translation call. Returns the translated string or raises on failure."""
    msg = client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": PROMPT_TEMPLATE.format(
                title_ja=title_ja,
                field_label=FIELD_LABELS.get(src_field, src_field),
                ja_text=ja_text,
            ),
        }],
    )
    # Concatenate all text blocks (defensive: usually 1 block)
    parts: list[str] = []
    for block in msg.content:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "".join(parts).strip()


def _process_one(client, model: str, padded: str, force: bool, dry_run: bool) -> tuple[str, str, list[str]]:
    """Translate all pending fields for one occupation. Returns (padded, status, fields_done)."""
    occ = _load_occupation(padded)
    title_ja = occ.get("title_ja", "(unknown)")
    description = occ.get("description", {}) or {}

    translation = _load_translation(padded)
    if translation is None:
        return padded, "skip:no-translation-file", []

    pending = _needs_translation(translation, force)
    if not pending:
        return padded, "skip:complete", []

    done: list[str] = []
    for src in pending:
        ja_text = description.get(src)
        if not isinstance(ja_text, str) or not ja_text.strip():
            continue  # source side is empty
        if dry_run:
            done.append(src)
            continue
        try:
            en_text = _translate_one(client, model, title_ja, src, ja_text)
        except Exception as e:
            return padded, f"error:{type(e).__name__}:{e}", done
        # Map src → dest field name
        dest = next(d for s, d in FIELDS if s == src)
        translation[dest] = en_text
        done.append(src)

    if not dry_run and done:
        translation["translated_at"] = dt.date.today().isoformat()
        _save_translation(padded, translation)

    return padded, "ok", done


def main() -> int:
    ap = argparse.ArgumentParser(description="Translate IPD long-form descriptions JA → EN")
    ap.add_argument("--limit", type=int, default=None, help="Process only the first N occupations.")
    ap.add_argument("--ids", default=None, help="Comma-separated padded ids (e.g. 0001,0033). Overrides --limit.")
    ap.add_argument("--force", action="store_true", help="Re-translate fields even if already populated.")
    ap.add_argument("--dry-run", action="store_true", help="Print plan; no API calls, no writes.")
    ap.add_argument("--model", default="claude-sonnet-4-5", help="Anthropic model.")
    ap.add_argument("--workers", type=int, default=8, help="Parallel API calls.")
    args = ap.parse_args()

    # Build the work list
    if args.ids:
        padded_list = [s.strip().zfill(4) for s in args.ids.split(",") if s.strip()]
    else:
        padded_list = sorted(p.stem for p in OCC_DIR.glob("*.json"))
        if args.limit is not None:
            padded_list = padded_list[: args.limit]

    print("=" * 70)
    print("translate_descriptions.py — JA → EN long-form")
    print(f"  occupations    : {len(padded_list)}")
    print(f"  model          : {args.model}")
    print(f"  workers        : {args.workers}")
    print(f"  mode           : {'DRY RUN' if args.dry_run else 'live'}")
    print(f"  force          : {args.force}")
    print("=" * 70)

    # Lazy import — keeps the script importable for tests/dry-runs without the dep
    if not args.dry_run:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("FATAL: ANTHROPIC_API_KEY not set. Export it or use --dry-run.", file=sys.stderr)
            return 1
        try:
            from anthropic import Anthropic  # type: ignore[import-not-found]
        except ImportError:
            print("FATAL: `anthropic` package not installed. Run: uv pip install anthropic", file=sys.stderr)
            return 1
        client = Anthropic()
    else:
        client = None

    counts = {"ok": 0, "skip:complete": 0, "skip:no-translation-file": 0, "error": 0}
    total_fields = 0

    if args.workers > 1 and not args.dry_run:
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {
                ex.submit(_process_one, client, args.model, p, args.force, args.dry_run): p
                for p in padded_list
            }
            for i, fut in enumerate(as_completed(futures), 1):
                padded, status, done = fut.result()
                counts[status if status.startswith("skip") or status == "ok" else "error"] += 1
                total_fields += len(done)
                print(f"  [{i:4d}/{len(padded_list)}] {padded}: {status}  ({len(done)} field(s))")
    else:
        for i, padded in enumerate(padded_list, 1):
            padded_, status, done = _process_one(client, args.model, padded, args.force, args.dry_run)
            counts[status if status.startswith("skip") or status == "ok" else "error"] += 1
            total_fields += len(done)
            print(f"  [{i:4d}/{len(padded_list)}] {padded}: {status}  ({len(done)} field(s))")

    print("\n" + "=" * 70)
    print("Summary:")
    for k, v in counts.items():
        print(f"  {k:30s} {v}")
    print(f"  total fields translated/planned: {total_fields}")
    print("=" * 70)
    return 0 if counts["error"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
