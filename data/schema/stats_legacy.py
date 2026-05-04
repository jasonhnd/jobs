"""StatsLegacySchema — per DATA_ARCHITECTURE.md §5.2.

Source data file: data/stats_legacy/<padded>.json (one per occupation).
Independent from SourceOccupationSchema (§1 separation principle).
File absence = no stats (e.g., 4 new IPD occupations 581-584).
Field None within present file = partial data.
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class StatsLegacy(BaseModel):
    """Six labor-market statistics for one occupation.

    Sources (per §2.2):
        salary_man_yen / monthly_hours / average_age → 賃金構造基本統計調査
        workers → 労働力調査
        recruit_wage_man_yen / recruit_ratio → ハローワーク求人統計

    All converged into jobtag.mhlw.go.jp page; this file freezes the scrape.
    """
    model_config = ConfigDict(extra="forbid")

    id: int = Field(ge=1, le=999)
    schema_version: str = Field(default="1.0")
    source: str  # e.g., "jobtag_scrape_2026-04-25"

    salary_man_yen: Optional[float] = Field(default=None, ge=0)  # 万円/year
    workers: Optional[int] = Field(default=None, ge=0)  # 人
    monthly_hours: Optional[int] = Field(default=None, ge=0)  # 時間/month
    average_age: Optional[float] = Field(default=None, ge=0, le=100)  # 歳
    recruit_wage_man_yen: Optional[float] = Field(default=None, ge=0)  # 万円/month
    recruit_ratio: Optional[float] = Field(default=None, ge=0)  # 倍 (effective opening ratio)
