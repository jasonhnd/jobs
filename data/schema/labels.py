"""Label dictionary schema — per DATA_ARCHITECTURE.md §2.5.

Source data file: data/labels/<dimension>.ja-en.json
  - dimension ∈ {skills, knowledge, abilities, work_characteristics,
                 work_activities, interests, work_values}

Each file: shared global labels for all 556 occupations (avoid storing 556 times).
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LabelEntry(BaseModel):
    """One label: JA name (from IPD 細目) + EN name (from O*NET) + optional metadata."""
    model_config = ConfigDict(extra="forbid")

    ja: str
    en: str
    onet_id: Optional[str] = None  # O*NET reference if applicable, e.g., "1.A.1.a.1"
    note: Optional[str] = None


class LabelsFile(BaseModel):
    """Top-level structure of one labels file (e.g., skills.ja-en.json)."""
    model_config = ConfigDict(extra="forbid")

    dimension: str  # e.g., "skills"
    source: str  # e.g., "O*NET 28.x + IPD 細目 v7.00"
    license: str  # e.g., "O*NET data is in the public domain"
    count: int = Field(ge=1)
    labels: dict[str, LabelEntry]  # key → entry
