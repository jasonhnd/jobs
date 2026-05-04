"""ScoreRun v2.0 schema — per DATA_ARCHITECTURE.md §2.3.1.

Source data file: data/scores/<scope>_<model-slug>_<run-date>.json
  - scope ∈ {occupations, tasks}
  - one file per scoring run, NEVER overwritten or deleted

Migration from v1.0 (data/ai_scores_<date>.json):
  - Old fields r/j/e → new ai_risk/rationale_ja/rationale_en
  - Missing metadata fields (input_*, prompt_*, model_temperature, etc.):
        - Optional[str] fields: "<unknown - migrated from v1.0>"
        - Optional[float/int] fields: None
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ScoreEntry(BaseModel):
    """One scored unit (occupation or task)."""
    model_config = ConfigDict(extra="forbid")

    ai_risk: int = Field(ge=0, le=10)
    rationale_ja: str
    rationale_en: str
    confidence: Optional[float] = Field(default=None, ge=0, le=1)


class Scorer(BaseModel):
    """Which model did the scoring."""
    model_config = ConfigDict(extra="forbid")

    model: str  # e.g., "claude-opus-4-7"
    model_provider: str  # e.g., "anthropic"
    model_temperature: Optional[float] = Field(default=None, ge=0, le=2)
    scoring_method: str  # e.g., "single-pass per occupation"


class RunMeta(BaseModel):
    """When and how this run executed."""
    model_config = ConfigDict(extra="forbid")

    run_date: str  # ISO date YYYY-MM-DD
    run_id: str  # human-readable identifier, e.g., "occ_2026-04-25_v1"
    duration_minutes: Optional[float] = Field(default=None, ge=0)
    operator: Optional[str] = None  # GitHub username or similar


class InputMeta(BaseModel):
    """Source data the scoring was run against."""
    model_config = ConfigDict(extra="forbid")

    input_data_version: str  # e.g., "ipd_v7.00" or legacy descriptor
    input_data_sha256: Optional[str] = None  # joined source data hash at scoring time
    occupation_count_scored: int = Field(ge=0)
    occupation_count_skipped: int = Field(ge=0)


class PromptMeta(BaseModel):
    """Prompt / rubric used."""
    model_config = ConfigDict(extra="forbid")

    prompt_version: str  # e.g., "1.0"
    prompt_file: str  # path relative to repo root, e.g., "data/prompts/prompt.ja.md"
    prompt_sha256: Optional[str] = None
    rubric_source: str  # e.g., "karpathy/jobs 0-10 scale, calibrated for Japan jobtag"


class ScoreRun(BaseModel):
    """A complete AI scoring run record."""
    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(default="2.0")
    scope: str = Field(pattern=r"^(occupations|tasks)$")
    scorer: Scorer
    run: RunMeta
    input: InputMeta
    prompt: PromptMeta
    anchors: dict[str, str]  # e.g., {"0-1": "Minimal: ...", ...}
    caveat: str
    scores: dict[str, ScoreEntry]  # key: occupation_id (or "<occ_id>:<task_id>" for task scope) as string
