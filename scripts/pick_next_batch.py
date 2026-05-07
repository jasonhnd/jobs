"""
pick_next_batch.py — list the next N occupation IDs that need rationale enrichment.

Selection rule:
  - Has ai_risk.score (skip id=581-584 which lack scoring entirely)
  - Lacks ai_risk.rationale_long_ja (skip already-enriched files)
  - Sorted by occupation ID ascending (deterministic resume order)

Output is parseable for downstream pipelines:
    id<TAB>title_ja<TAB>score<TAB>workforce_band<TAB>sector_id

Usage:
    python scripts/pick_next_batch.py            # default: next 10
    python scripts/pick_next_batch.py --n 20
    python scripts/pick_next_batch.py --json     # output as JSON list
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DETAIL = ROOT / "dist" / "data.detail"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--n", type=int, default=10, help="How many IDs to return (default 10).")
    ap.add_argument("--json", action="store_true", help="Emit JSON list instead of TSV.")
    args = ap.parse_args()

    files = sorted(DETAIL.glob("*.json"))
    chosen: list[dict] = []

    for path in files:
        if len(chosen) >= args.n:
            break
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        ai = d.get("ai_risk")
        if not isinstance(ai, dict):
            continue
        if "score" not in ai:
            continue
        if ai.get("rationale_long_ja"):
            continue
        chosen.append(
            {
                "id": d["id"],
                "title_ja": d.get("title", {}).get("ja", "?"),
                "score": ai["score"],
                "workforce_band": d.get("workforce_band"),
                "sector_id": (d.get("sector") or {}).get("id"),
            }
        )

    if args.json:
        json.dump(chosen, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    else:
        for c in chosen:
            print(
                f"{c['id']}\t{c['title_ja']}\t{c['score']}\t"
                f"{c['workforce_band']}\t{c['sector_id']}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
