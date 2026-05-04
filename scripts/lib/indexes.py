"""Build-time in-memory indexes — per DATA_ARCHITECTURE.md §7.3.

Loaded once by build_data.py; passed to all 9 projection modules.
Replaces the SQL JOIN that a database would do at query time.

Available indexes:
    occ_by_id              dict[int, Occupation]
    trans_by_id            dict[int, TranslationEN]
    stats_by_id            dict[int, StatsLegacy]
    history_by_occ         dict[int, list[ScoreHistEntry]]   sorted by date
    latest_score_by_occ    dict[int, ScoreHistEntry]
    runs_by_model          dict[str, list[ScoreRun]]
    labels_by_dim          dict[str, dict[str, LabelEntry]]  e.g., labels_by_dim["skills"]["reading_comprehension"]
    sectors                list[SectorDef]                    16 consumer-friendly sectors (§6.11)
    sector_overrides       dict[str, str]                     padded_id → sector_id
    sector_by_occ          dict[int, SectorAssignment]        derived per-occupation
"""
from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pydantic import ValidationError

# Inserted into sys.path by build_data.py before importing this module
from schema.labels import LabelEntry, LabelsFile  # type: ignore[import-not-found]
from schema.occupation import Occupation  # type: ignore[import-not-found]
from schema.score_run import ScoreRun  # type: ignore[import-not-found]
from schema.sector import SectorDef, SectorOverrides, SectorsFile  # type: ignore[import-not-found]
from schema.stats_legacy import StatsLegacy  # type: ignore[import-not-found]
from schema.translation import TranslationEN  # type: ignore[import-not-found]

from .score_strategy import pick_latest_score
from .sector_resolver import SectorAssignment, resolve_sector, validate_sector_definitions


@dataclass
class ScoreHistEntry:
    """One score in an occupation's history (flattened from a ScoreRun)."""
    model: str
    date: str
    ai_risk: int
    rationale_ja: str
    rationale_en: str
    confidence: float | None = None


@dataclass
class Indexes:
    occ_by_id: dict[int, Occupation] = field(default_factory=dict)
    trans_by_id: dict[int, TranslationEN] = field(default_factory=dict)
    stats_by_id: dict[int, StatsLegacy] = field(default_factory=dict)
    history_by_occ: dict[int, list[ScoreHistEntry]] = field(default_factory=dict)
    latest_score_by_occ: dict[int, ScoreHistEntry] = field(default_factory=dict)
    runs_by_model: dict[str, list[ScoreRun]] = field(default_factory=lambda: defaultdict(list))
    labels_by_dim: dict[str, dict[str, LabelEntry]] = field(default_factory=dict)
    sectors: list[SectorDef] = field(default_factory=list)
    sector_overrides: dict[str, str] = field(default_factory=dict)
    sector_by_occ: dict[int, SectorAssignment] = field(default_factory=dict)


# ---------- Loaders ----------

def _load_dir(dir_path: Path, model_cls: type, validation_errors: list[tuple[Path, str]]) -> dict[int, Any]:
    """Load + Pydantic-validate every .json in dir_path. Returns dict keyed by id."""
    out: dict[int, Any] = {}
    for f in sorted(dir_path.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            obj = model_cls.model_validate(data)
            out[obj.id] = obj
        except (json.JSONDecodeError, ValidationError) as e:
            validation_errors.append((f, str(e)))
    return out


def _load_labels(labels_dir: Path, validation_errors: list[tuple[Path, str]]) -> dict[str, dict[str, LabelEntry]]:
    """Load all data/labels/*.ja-en.json. Returns dim → {key → LabelEntry}."""
    out: dict[str, dict[str, LabelEntry]] = {}
    for f in sorted(labels_dir.glob("*.ja-en.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            lf = LabelsFile.model_validate(data)
            out[lf.dimension] = lf.labels
        except (json.JSONDecodeError, ValidationError) as e:
            validation_errors.append((f, str(e)))
    return out


def _load_score_runs(scores_dir: Path, validation_errors: list[tuple[Path, str]]) -> list[ScoreRun]:
    """Load all data/scores/*.json (occupations_*.json + tasks_*.json)."""
    out: list[ScoreRun] = []
    for f in sorted(scores_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            out.append(ScoreRun.model_validate(data))
        except (json.JSONDecodeError, ValidationError) as e:
            validation_errors.append((f, str(e)))
    return out


def _load_sectors(
    sectors_dir: Path, validation_errors: list[tuple[Path, str]]
) -> tuple[list[SectorDef], dict[str, str]]:
    """Load sector definitions + manual overrides.

    Returns ([], {}) if the directory is missing — keeps the build working
    on older snapshots that pre-date the sector subsystem (§6.11).
    """
    sectors: list[SectorDef] = []
    overrides: dict[str, str] = {}

    sectors_file = sectors_dir / "sectors.ja-en.json"
    if sectors_file.exists():
        try:
            data = json.loads(sectors_file.read_text(encoding="utf-8"))
            sectors = SectorsFile.model_validate(data).sectors
        except (json.JSONDecodeError, ValidationError) as e:
            validation_errors.append((sectors_file, str(e)))

    overrides_file = sectors_dir / "overrides.json"
    if overrides_file.exists():
        try:
            data = json.loads(overrides_file.read_text(encoding="utf-8"))
            overrides = SectorOverrides.model_validate(data).overrides
        except (json.JSONDecodeError, ValidationError) as e:
            validation_errors.append((overrides_file, str(e)))

    return sectors, overrides


# ---------- Public API ----------

def build_indexes(data_root: Path) -> tuple[Indexes, list[tuple[Path, str]]]:
    """Load + validate all source data; build all derived indexes.

    Returns:
        (indexes, validation_errors)
        - validation_errors is a list of (file_path, error_message); empty on success.
    """
    errors: list[tuple[Path, str]] = []

    occ_by_id: dict[int, Occupation] = _load_dir(
        data_root / "occupations", Occupation, errors
    )
    trans_by_id: dict[int, TranslationEN] = _load_dir(
        data_root / "translations" / "en", TranslationEN, errors
    )
    stats_by_id: dict[int, StatsLegacy] = _load_dir(
        data_root / "stats_legacy", StatsLegacy, errors
    )
    score_runs = _load_score_runs(data_root / "scores", errors)
    labels_by_dim = _load_labels(data_root / "labels", errors)
    sectors, sector_overrides = _load_sectors(data_root / "sectors", errors)

    # Validate sector definitions (no-op when sectors == []).
    for problem in validate_sector_definitions(sectors):
        errors.append((data_root / "sectors" / "sectors.ja-en.json", problem))

    # Build score history per occupation (only consider scope='occupations' for now)
    history_by_occ: dict[int, list[ScoreHistEntry]] = defaultdict(list)
    runs_by_model: dict[str, list[ScoreRun]] = defaultdict(list)
    for run in score_runs:
        runs_by_model[run.scorer.model].append(run)
        if run.scope != "occupations":
            continue  # task-level scores live in a separate index path (Future work)
        for occ_id_str, entry in run.scores.items():
            try:
                occ_id = int(occ_id_str)
            except ValueError:
                errors.append((data_root / "scores", f"non-int score key '{occ_id_str}' in run {run.run.run_id}"))
                continue
            history_by_occ[occ_id].append(ScoreHistEntry(
                model=run.scorer.model,
                date=run.run.run_date,
                ai_risk=entry.ai_risk,
                rationale_ja=entry.rationale_ja,
                rationale_en=entry.rationale_en,
                confidence=entry.confidence,
            ))

    for occ_id in history_by_occ:
        history_by_occ[occ_id].sort(key=lambda x: x.date)

    latest_score_by_occ: dict[int, ScoreHistEntry] = {}
    for occ_id, hist in history_by_occ.items():
        # pick_latest_score expects list[dict] — our entries are dataclasses; convert via __dict__
        chosen = pick_latest_score([e.__dict__ for e in hist])
        # Reconstruct as ScoreHistEntry
        latest_score_by_occ[occ_id] = ScoreHistEntry(**chosen)

    # Cross-reference sanity: any score for an unknown occupation?
    unknown_score_ids = set(history_by_occ.keys()) - set(occ_by_id.keys())
    if unknown_score_ids:
        errors.append((
            data_root / "scores",
            f"scores reference unknown occupation ids: {sorted(unknown_score_ids)[:5]}{'...' if len(unknown_score_ids) > 5 else ''}",
        ))

    # Derive per-occupation sector assignment. Skipped if no sectors defined
    # (keeps the build green during initial migration).
    sector_by_occ: dict[int, SectorAssignment] = {}
    if sectors:
        for occ_id, occ in occ_by_id.items():
            sector_by_occ[occ_id] = resolve_sector(
                occ_id=occ_id,
                mhlw_main=occ.classifications.mhlw_main,
                sectors=sectors,
                overrides=sector_overrides,
            )

    return Indexes(
        occ_by_id=occ_by_id,
        trans_by_id=trans_by_id,
        stats_by_id=stats_by_id,
        history_by_occ=dict(history_by_occ),
        latest_score_by_occ=latest_score_by_occ,
        runs_by_model=dict(runs_by_model),
        labels_by_dim=labels_by_dim,
        sectors=sectors,
        sector_overrides=sector_overrides,
        sector_by_occ=sector_by_occ,
    ), errors
