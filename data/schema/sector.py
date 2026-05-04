"""Sector taxonomy schema — per DATA_ARCHITECTURE.md §6.11 (new in v1.1.0).

Two source files at `data/sectors/`:

  sectors.ja-en.json     — sector definitions (id, ja, en, hue, mhlw_seed_codes).
                           Single source of truth for what sectors exist and
                           which MHLW codes each one auto-claims.

  overrides.json         — per-occupation manual overrides:
                              { "<occ_id>": "<sector_id>" }
                           Used only for occupations whose mhlw_main does not
                           uniquely match a sector (multi-match or no-match
                           cases land in dist/data.review_queue.json and the
                           operator resolves them by editing this file).

Resolution rule (`sector_resolver.resolve_sector`):
  1. If overrides has the occ_id → that sector_id wins (provenance: 'override').
  2. Else match occ.mhlw_main against every sector's seed_codes (glob match):
       - exactly 1 sector matches → that sector wins (provenance: 'auto').
       - 0 matches               → '_uncategorized' + review_queue entry
                                     (provenance: 'unmatched').
       - >1 matches              → first match wins, but flagged in
                                     review_queue (provenance: 'auto-ambiguous').
  3. If occ has no mhlw_main at all → '_uncategorized' (provenance: 'no-mhlw').

Seed code grammar (matched against full mhlw_main string like "12_072-06"):
  - Exact match:   "12_072-06"
  - Trailing star: "12_*"            (any code starting with "12_")
  - Prefix slash:  "12_072*"          (any code starting with "12_072")
  - Multiple seeds OR'd together inside one sector.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


HueBand = Literal["safe", "mid", "warm", "risk"]
"""Visual tint band — used by treemap as a *fallback* color hint when the
specific occupation's ai_risk is not yet known. Real per-tile color in the
treemap always comes from ai_risk; this is just the sector's "default mood".
  - safe  : low-risk territory (e.g., 医療, 介護)
  - mid   : sand / mixed         (e.g., 事務, 販売)
  - warm  : leaning automatable  (e.g., 軽作業, メンテ)
  - risk  : highest-risk default (rarely used; most sectors land in low/mid)
"""


class SectorDef(BaseModel):
    """One sector in the taxonomy.

    Fields:
        id              : stable slug, never changes (e.g., "iryo", "kaigo").
                          URL-safe, lowercase, ASCII.
        ja / en         : display labels — may evolve, do not break links.
        hue             : visual tint band (see HueBand).
        description_ja  : 1-line internal description for editor reference.
        mhlw_seed_codes : list of glob patterns matched against
                          `occupation.classifications.mhlw_main`.
                          Order does not affect resolution unless multi-match —
                          first match wins (then flagged).
    """
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=32, pattern=r"^[a-z][a-z0-9_]*$")
    ja: str = Field(min_length=1, max_length=24)
    en: str = Field(min_length=1, max_length=48)
    hue: HueBand
    description_ja: Optional[str] = None
    mhlw_seed_codes: list[str] = Field(default_factory=list)


class SectorsFile(BaseModel):
    """Top-level structure of `data/sectors/sectors.ja-en.json`."""
    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(default="1.0")
    description: str
    sectors: list[SectorDef] = Field(min_length=1, max_length=32)


class SectorOverrides(BaseModel):
    """Top-level structure of `data/sectors/overrides.json`.

    Maps padded occupation id (string) → sector_id (string).
    Padded id format `0001`-`9999` matches the on-disk file naming so manual
    edits can be done by glancing at the occupations directory.
    """
    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(default="1.0")
    description: str
    overrides: dict[str, str] = Field(default_factory=dict)
