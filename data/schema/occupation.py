"""SourceOccupationSchema — per DATA_ARCHITECTURE.md §5.1.

Source data file: data/occupations/<padded>.json (one per occupation, 4-digit padded id).
Does NOT contain stats_legacy (that's a separate file, see schema.stats_legacy).
Does NOT contain English translations (those live in data/translations/en/<padded>.json).
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Sub-models ----------

class Classifications(BaseModel):
    """02 名称・分類領域 — classifications block.

    Per §5.5 Classification Fields rules:
        - raw storage only
        - no UI / SEO / filter use until mapping table confirmed
    """
    model_config = ConfigDict(extra="forbid")

    mhlw_main: Optional[str] = None  # e.g., "12_072-06"
    mhlw_all: list[str] = Field(default_factory=list)
    jsoc_main: Optional[str] = None  # e.g., "H533"
    jsoc_all: list[str] = Field(default_factory=list)


class Description(BaseModel):
    """03 解説領域 (text portion) — JA only; EN lives in translations layer."""
    model_config = ConfigDict(extra="forbid")

    summary_ja: Optional[str] = None
    what_it_is_ja: Optional[str] = None
    how_to_become_ja: Optional[str] = None
    working_conditions_ja: Optional[str] = None


class Task(BaseModel):
    """05 タスク領域 — single task entry. Up to 37 per occupation.

    `task_id` is positional within the occupation's task list (1-37).
    `execution_rate` is a fraction 0.0-1.0 (IPD field 実施率).
    `importance` is a 0-5 score (IPD field 重要度).
    """
    model_config = ConfigDict(extra="forbid")

    task_id: int = Field(ge=1, le=37)
    description_ja: str
    execution_rate: Optional[float] = Field(default=None, ge=0, le=1)
    importance: Optional[float] = Field(default=None, ge=0, le=5)


class RelatedOrg(BaseModel):
    """03 関連団体 entry — name + URL pair."""
    model_config = ConfigDict(extra="forbid")

    name_ja: str
    url: Optional[str] = None


class DataSourceVersions(BaseModel):
    """Provenance for this occupation's source data."""
    model_config = ConfigDict(extra="forbid")

    ipd_numeric: str  # e.g., "v7.00"
    ipd_description: str  # e.g., "v7.00"
    ipd_retrieved_at: str  # ISO date YYYY-MM-DD


# ---------- Main model ----------

class Occupation(BaseModel):
    """Top-level occupation record — one per file at data/occupations/<padded>.json.

    Null rules per §5.4:
        - 12 numeric subdivisions (interests..employment_type) integral block:
            - present and complete OR entirely None (not dict with all-None values)
        - tasks: empty list [] when known no tasks; never None
        - tasks_lead_ja: None when IPD タスク_リード文 absent
        - single-field absence within a present block: None (not omit key)
    """
    model_config = ConfigDict(extra="forbid")

    # ----- Identity & meta -----
    id: int = Field(ge=1, le=999)
    ipd_id: str = Field(pattern=r"^IPD_01_01_\d+$")
    schema_version: str = Field(default="7.00")
    ingested_at: str  # ISO date

    # ----- Names & classifications -----
    title_ja: str
    aliases_ja: list[str] = Field(default_factory=list, max_length=25)

    classifications: Classifications
    description: Description

    # ----- Numeric profile (12 subdivisions; whole-block-None per §5.4) -----
    # Each is dict[str, float] mapping label_key → score (0-5 for most, 0-100 for distributions).
    interests: Optional[dict[str, float]] = None
    work_values: Optional[dict[str, float]] = None
    skills: Optional[dict[str, float]] = None
    knowledge: Optional[dict[str, float]] = None
    abilities: Optional[dict[str, float]] = None
    work_characteristics: Optional[dict[str, float]] = None
    work_activities: Optional[dict[str, float]] = None
    education_distribution: Optional[dict[str, float]] = None
    training_pre: Optional[dict[str, float]] = None
    training_post: Optional[dict[str, float]] = None
    experience: Optional[dict[str, float]] = None
    employment_type: Optional[dict[str, float]] = None

    # ----- Tasks -----
    tasks_lead_ja: Optional[str] = None
    tasks: list[Task] = Field(default_factory=list, max_length=37)

    # ----- Related entities -----
    related_orgs: list[RelatedOrg] = Field(default_factory=list, max_length=10)
    related_certs_ja: list[str] = Field(default_factory=list, max_length=35)

    # ----- External link -----
    url: str

    # ----- Provenance -----
    data_source_versions: DataSourceVersions
    last_updated_per_section: dict[str, int] = Field(default_factory=dict)
