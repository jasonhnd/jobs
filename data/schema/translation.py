"""TranslationEN schema — per DATA_ARCHITECTURE.md §2.4.

Source data file: data/translations/<lang>/<padded>.json (one per occupation per language).
Language layer is independent from main occupation source — IPD upgrades and translation
re-runs decouple cleanly.
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class TranslationEN(BaseModel):
    """English translation for one occupation.

    Per §2.4 翻译范围:
        - title_en: from main JSON title_ja
        - summary_en: from description.summary_ja (or full description condensed)
        - aliases_en: from aliases_ja
        - tasks_en: parallel array to tasks[].description_ja

    Standard label translations (skills/knowledge dim names) are NOT here —
    see data/labels/*.ja-en.json (§2.5).
    """
    model_config = ConfigDict(extra="forbid")

    id: int = Field(ge=1, le=999)
    translator: str  # e.g., "claude-opus-4-7"
    translated_at: str  # ISO date YYYY-MM-DD
    source_data_version: str  # what version of main data was translated, e.g., "ipd_v7.00"

    title_en: Optional[str] = None
    summary_en: Optional[str] = None
    aliases_en: list[str] = Field(default_factory=list)
    tasks_en: list[Optional[str]] = Field(default_factory=list)  # parallel to tasks[]; None = not translated

    # ── v1.1.0: long-form description fields (mobile detail page §5.4 / §9.3) ──
    # Run by scripts/translate_descriptions.py. Each may be None if not yet
    # translated; mobile frontend shows i18n key `detail.long_text.ja_only`
    # placeholder when blank. Optional fields so back-compat with legacy files
    # that pre-date v1.1.0 still validate.
    what_it_is_en: Optional[str] = None
    how_to_become_en: Optional[str] = None
    working_conditions_en: Optional[str] = None
