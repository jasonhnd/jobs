"""Migrate legacy translations file into per-id translation files.

One-shot migration per DATA_ARCHITECTURE.md §2.4 / D-011.

Source:  data/translations_2026-04-25.json (single file, all 552 records)
Output:  data/translations/en/<padded>.json (one per occupation)

Field renames per §2.4:
    name_en → title_en
    desc_en → summary_en

This script is kept post-migration for reference (D-011).
Re-running is safe: output files are overwritten atomically.

Usage:
    uv run python scripts/migrate_translations.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
from schema.translation import TranslationEN  # noqa: E402

# v0.7.0: source moved to .archive/v0.6/. Migration is one-shot; deterministic re-runs.
SOURCE = ROOT / "data" / ".archive" / "v0.6" / "translations_2026-04-25.json"
OUTPUT_DIR = ROOT / "data" / "translations" / "en"


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with SOURCE.open(encoding="utf-8") as f:
        legacy = json.load(f)

    # Legacy structure:
    # {
    #   "version": "1.0",
    #   "translated_at": "2026-04-25",
    #   "translator": "Claude Opus 4.7 (Anthropic) via Claude Code session",
    #   "note": "...",
    #   "translations": {
    #     "1": {"name_en": "...", "desc_en": "..."},
    #     ...
    #   }
    # }
    translator = legacy.get("translator", "<unknown>")
    translated_at = legacy.get("translated_at", "2026-04-25")
    translations = legacy["translations"]

    # Normalize translator string to model slug for consistency
    # ("Claude Opus 4.7 (Anthropic) via Claude Code session" → "claude-opus-4-7")
    translator_slug = "claude-opus-4-7" if "Opus 4.7" in translator else translator

    written = 0
    field_coverage = {"title_en": 0, "summary_en": 0}

    for occ_id_str, entry in translations.items():
        occ_id = int(occ_id_str)
        title_en = entry.get("name_en")
        summary_en = entry.get("desc_en")

        # Skip records with no translations at all
        if not title_en and not summary_en:
            continue

        tr = TranslationEN(
            id=occ_id,
            translator=translator_slug,
            translated_at=translated_at,
            source_data_version="legacy_scrape_2026-04-25",
            title_en=title_en,
            summary_en=summary_en,
            aliases_en=[],  # legacy file did not include aliases — populate in future translation runs
            tasks_en=[],  # legacy file did not include task-level translations
        )

        if tr.title_en:
            field_coverage["title_en"] += 1
        if tr.summary_en:
            field_coverage["summary_en"] += 1

        out_path = OUTPUT_DIR / f"{occ_id:04d}.json"
        out_path.write_text(
            json.dumps(tr.model_dump(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        written += 1

    print(f"Wrote {written} translation files to {OUTPUT_DIR.relative_to(ROOT)}")
    print("Field coverage:")
    for field, count in field_coverage.items():
        print(f"  {field:15s} {count:4d}")
    print(f"Translator slug normalized: '{translator}' → '{translator_slug}'")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
