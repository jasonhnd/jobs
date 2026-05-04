"""Resolve occupation → sector — per DATA_ARCHITECTURE.md §6.11.

Pure functional core; no I/O. Loaded once by build_indexes(); used by
both sector_assign.py (which writes data.sectors.json + review_queue) and
treemap.py (which decorates each tile with sector_id / sector_ja / hue).

Resolution rule (see also data/schema/sector.py docstring):
    1. overrides[padded_id] wins, if present.
    2. Glob-match occ.classifications.mhlw_main against every sector's
       seed_codes:
         - 1 match → that sector wins.
         - 0 matches → "_uncategorized".
         - >1 matches → first match wins, ambiguous flag set.
    3. No mhlw_main on the occupation → "_uncategorized".

The resolver is deterministic: given the same (sectors_def, overrides,
occupations) input it always produces the same output. This is what
lets dist/data.sectors.json + dist/data.review_queue.json be committed
to git and CI-checked for drift.
"""
from __future__ import annotations

import fnmatch
from dataclasses import dataclass
from typing import Iterable, Literal

from schema.sector import SectorDef  # type: ignore[import-not-found]


SENTINEL_UNCATEGORIZED = "_uncategorized"
"""Sector id assigned to occupations that match no seed and have no override.
Treated as a real sector in projections (so 関連職業 etc. don't crash) but
flagged in review_queue for the operator to either (a) add an override or
(b) extend a sector's seed_codes."""


Provenance = Literal["override", "auto", "auto-ambiguous", "unmatched", "no-mhlw"]


@dataclass(frozen=True)
class SectorAssignment:
    """Result of resolving one occupation to a sector.

    Fields:
        sector_id     : sector slug or SENTINEL_UNCATEGORIZED.
        provenance    : how the assignment was derived (for audit / review).
        matched_seeds : list of seed glob patterns that matched (debug aid).
        candidates    : if multi-match, all sector_ids that matched
                        (first one is the winner, others are runners-up).
    """
    sector_id: str
    provenance: Provenance
    matched_seeds: tuple[str, ...] = ()
    candidates: tuple[str, ...] = ()


def _match(seed: str, code: str) -> bool:
    """Glob-match a seed pattern against an mhlw_main code.

    Uses fnmatch (`*` = any chars, `?` = single char). Codes contain `_` and
    `-`; we treat them as literal — fnmatch handles that correctly because
    those are not special in fnmatch.
    """
    return fnmatch.fnmatchcase(code, seed)


def _find_matching_sectors(
    code: str, sectors: Iterable[SectorDef]
) -> list[tuple[str, str]]:
    """Return [(sector_id, matched_seed), ...] for all sectors whose any seed matches."""
    matches: list[tuple[str, str]] = []
    for s in sectors:
        for seed in s.mhlw_seed_codes:
            if _match(seed, code):
                matches.append((s.id, seed))
                break  # one match per sector is enough for the "did any match?" question
    return matches


def resolve_sector(
    occ_id: int,
    mhlw_main: str | None,
    sectors: list[SectorDef],
    overrides: dict[str, str],
) -> SectorAssignment:
    """Resolve a single occupation to its sector.

    Args:
        occ_id     : numeric id (1-9999).
        mhlw_main  : the occupation's classifications.mhlw_main, or None.
        sectors    : sector definitions in priority order (first-match-wins on ties).
        overrides  : dict of padded_id_string → sector_id.

    Returns:
        SectorAssignment with sector_id and provenance.
    """
    padded = f"{occ_id:04d}"
    if padded in overrides:
        return SectorAssignment(
            sector_id=overrides[padded],
            provenance="override",
        )

    if not mhlw_main:
        return SectorAssignment(
            sector_id=SENTINEL_UNCATEGORIZED,
            provenance="no-mhlw",
        )

    matches = _find_matching_sectors(mhlw_main, sectors)
    if not matches:
        return SectorAssignment(
            sector_id=SENTINEL_UNCATEGORIZED,
            provenance="unmatched",
        )

    if len(matches) == 1:
        sector_id, seed = matches[0]
        return SectorAssignment(
            sector_id=sector_id,
            provenance="auto",
            matched_seeds=(seed,),
            candidates=(sector_id,),
        )

    # Multi-match: first one wins, but record all candidates so operator can
    # decide whether to (a) tighten a seed pattern or (b) add an override.
    winner_id, winner_seed = matches[0]
    return SectorAssignment(
        sector_id=winner_id,
        provenance="auto-ambiguous",
        matched_seeds=(winner_seed,),
        candidates=tuple(s_id for s_id, _ in matches),
    )


def validate_sector_definitions(sectors: list[SectorDef]) -> list[str]:
    """Return a list of human-readable problems with the sector definitions.

    Empty list = OK. Caller decides whether to fail the build or just warn.
    """
    problems: list[str] = []
    seen_ids: set[str] = set()
    for s in sectors:
        if s.id == SENTINEL_UNCATEGORIZED:
            problems.append(
                f"sector id '{s.id}' collides with the SENTINEL_UNCATEGORIZED "
                f"value reserved by the resolver"
            )
        if s.id in seen_ids:
            problems.append(f"duplicate sector id: {s.id}")
        seen_ids.add(s.id)
        if not s.mhlw_seed_codes:
            problems.append(
                f"sector '{s.id}' has no mhlw_seed_codes — it can only ever "
                f"be reached via overrides"
            )
    return problems
