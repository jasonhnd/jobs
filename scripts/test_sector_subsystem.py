#!/usr/bin/env python3
"""test_sector_subsystem.py — unit tests for sector_resolver + bands (§6.11).

Pure-function tests, no I/O. Run alongside test_data_consistency.py:
    uv run python scripts/test_sector_subsystem.py
    uv run python -m unittest scripts.test_sector_subsystem
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
sys.path.insert(0, str(ROOT / "scripts"))

from lib.bands import (  # noqa: E402
    DEMAND_COLD_MAX,
    DEMAND_NORMAL_MAX,
    RISK_LOW_MAX,
    RISK_MID_MAX,
    WORKFORCE_MID_MAX,
    WORKFORCE_SMALL_MAX,
    demand_band,
    risk_band,
    workforce_band,
)
from lib.sector_resolver import (  # noqa: E402
    SENTINEL_UNCATEGORIZED,
    resolve_sector,
    validate_sector_definitions,
)
from schema.sector import SectorDef  # noqa: E402


# ───── Bands ─────

class RiskBandTests(unittest.TestCase):
    def test_none_returns_none(self):
        self.assertIsNone(risk_band(None))

    def test_low_boundary(self):
        self.assertEqual(risk_band(0), "low")
        self.assertEqual(risk_band(RISK_LOW_MAX), "low")

    def test_mid_boundary(self):
        self.assertEqual(risk_band(RISK_LOW_MAX + 0.1), "mid")
        self.assertEqual(risk_band(RISK_MID_MAX), "mid")

    def test_high_boundary(self):
        self.assertEqual(risk_band(RISK_MID_MAX + 0.1), "high")
        self.assertEqual(risk_band(10), "high")

    def test_int_input(self):
        self.assertEqual(risk_band(2), "low")
        self.assertEqual(risk_band(5), "mid")
        self.assertEqual(risk_band(8), "high")


class WorkforceBandTests(unittest.TestCase):
    def test_none_returns_none(self):
        self.assertIsNone(workforce_band(None))

    def test_small_below_threshold(self):
        self.assertEqual(workforce_band(0), "small")
        self.assertEqual(workforce_band(WORKFORCE_SMALL_MAX - 1), "small")

    def test_mid_at_threshold(self):
        self.assertEqual(workforce_band(WORKFORCE_SMALL_MAX), "mid")
        self.assertEqual(workforce_band(WORKFORCE_MID_MAX - 1), "mid")

    def test_large_at_or_above(self):
        self.assertEqual(workforce_band(WORKFORCE_MID_MAX), "large")
        self.assertEqual(workforce_band(5_000_000), "large")


class DemandBandTests(unittest.TestCase):
    def test_none_returns_none(self):
        self.assertIsNone(demand_band(None))

    def test_cold_below_one(self):
        self.assertEqual(demand_band(0.0), "cold")
        self.assertEqual(demand_band(0.99), "cold")

    def test_normal_one_to_two(self):
        self.assertEqual(demand_band(DEMAND_COLD_MAX), "normal")
        self.assertEqual(demand_band(1.5), "normal")

    def test_hot_above_two(self):
        self.assertEqual(demand_band(DEMAND_NORMAL_MAX), "hot")
        self.assertEqual(demand_band(4.44), "hot")  # 豆腐製造 in real data


# ───── Sector resolver ─────

def _sectors() -> list[SectorDef]:
    """Minimal fixture covering the resolution branches."""
    return [
        SectorDef(id="iryo", ja="医療・保健", en="Medical & Health",
                  hue="safe", mhlw_seed_codes=["04_*"]),
        SectorDef(id="seizo", ja="製造", en="Manufacturing",
                  hue="mid", mhlw_seed_codes=["12_069*", "12_072*"]),
        SectorDef(id="creative", ja="クリエイティブ", en="Creative",
                  hue="warm", mhlw_seed_codes=["12_080*"]),
        SectorDef(id="overlap", ja="重複用", en="Overlap",
                  hue="warm", mhlw_seed_codes=["12_080-03"]),  # ambiguous with creative
    ]


class ResolveSectorTests(unittest.TestCase):

    def test_override_wins(self):
        a = resolve_sector(
            occ_id=123, mhlw_main="04_001-01",
            sectors=_sectors(),
            overrides={"0123": "creative"},
        )
        self.assertEqual(a.sector_id, "creative")
        self.assertEqual(a.provenance, "override")

    def test_no_mhlw(self):
        a = resolve_sector(
            occ_id=999, mhlw_main=None,
            sectors=_sectors(), overrides={},
        )
        self.assertEqual(a.sector_id, SENTINEL_UNCATEGORIZED)
        self.assertEqual(a.provenance, "no-mhlw")

    def test_unmatched_code(self):
        a = resolve_sector(
            occ_id=42, mhlw_main="99_999-99",
            sectors=_sectors(), overrides={},
        )
        self.assertEqual(a.sector_id, SENTINEL_UNCATEGORIZED)
        self.assertEqual(a.provenance, "unmatched")

    def test_single_match_simple(self):
        a = resolve_sector(
            occ_id=1, mhlw_main="04_001-01",
            sectors=_sectors(), overrides={},
        )
        self.assertEqual(a.sector_id, "iryo")
        self.assertEqual(a.provenance, "auto")
        self.assertEqual(a.matched_seeds, ("04_*",))

    def test_single_match_specific_prefix(self):
        a = resolve_sector(
            occ_id=2, mhlw_main="12_072-06",  # 豆腐製造
            sectors=_sectors(), overrides={},
        )
        self.assertEqual(a.sector_id, "seizo")
        self.assertEqual(a.provenance, "auto")

    def test_ambiguous_first_wins(self):
        # 12_080-03 matches both "creative" (12_080*) and "overlap" (12_080-03).
        # creative comes first in fixture order → wins, but provenance is flagged.
        a = resolve_sector(
            occ_id=3, mhlw_main="12_080-03",
            sectors=_sectors(), overrides={},
        )
        self.assertEqual(a.sector_id, "creative")
        self.assertEqual(a.provenance, "auto-ambiguous")
        self.assertIn("creative", a.candidates)
        self.assertIn("overlap", a.candidates)

    def test_padded_id_lookup(self):
        # Override key uses 4-digit padded id even for low ids.
        a = resolve_sector(
            occ_id=7, mhlw_main="04_001-01",
            sectors=_sectors(),
            overrides={"0007": "seizo"},
        )
        self.assertEqual(a.sector_id, "seizo")
        self.assertEqual(a.provenance, "override")


class ValidateSectorDefinitionsTests(unittest.TestCase):

    def test_clean_definitions_pass(self):
        problems = validate_sector_definitions(_sectors())
        self.assertEqual(problems, [])

    def test_duplicate_id_flagged(self):
        sects = _sectors()
        sects.append(SectorDef(id="iryo", ja="X", en="X", hue="safe", mhlw_seed_codes=["09_*"]))
        problems = validate_sector_definitions(sects)
        self.assertTrue(any("duplicate" in p for p in problems))

    def test_empty_seed_codes_flagged(self):
        sects = [SectorDef(id="orphan", ja="X", en="X", hue="safe", mhlw_seed_codes=[])]
        problems = validate_sector_definitions(sects)
        self.assertTrue(any("orphan" in p and "no mhlw_seed_codes" in p for p in problems))

    def test_sentinel_id_blocked_by_pydantic(self):
        # The sentinel "_uncategorized" begins with "_", which the SectorDef
        # id pattern (`^[a-z][a-z0-9_]*$`) forbids. This is defense-in-depth:
        # the schema layer already prevents the collision validate_sector_definitions
        # also guards against, so no malformed sectors.ja-en.json can ship a
        # colliding entry.
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            SectorDef(id=SENTINEL_UNCATEGORIZED, ja="X", en="X",
                      hue="safe", mhlw_seed_codes=["09_*"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
