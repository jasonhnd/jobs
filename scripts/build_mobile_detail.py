"""build_mobile_detail.py — generate /m/{ja,en}/<id>.html for all 556 occupations.

Per docs/MOBILE_DESIGN.md §6 (mobile detail URLs + canonical strategy).

Reads:
    dist/data.detail/<padded>.json     × 556  (per-occupation full record)
    dist/data.profile5.json            × 1    (5-axis radar values)
    dist/data.transfer_paths.json      × 1    (related candidates)
    scripts/i18n/mobile_strings.json   × 1    (UI strings)

Writes:
    m/ja/<id>.html      × 556
    m/en/<id>.html      × 556
    Total: 1112 files

Each emitted page has:
    - <link rel="canonical" href="/{lang}/<id>"> → SEO weight stays with desktop
    - "← デスクトップ版で詳しく見る" small link at top → escape hatch
    - Mobile sticky header + menu + footer (shared S1NavBar/S1Menu/S1Footer)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
sys.path.insert(0, str(ROOT / "scripts"))

from lib.i18n import LANGS, load  # noqa: E402
from templates.mobile.detail import render  # noqa: E402

DIST = ROOT / "dist"
OUT = ROOT / "m"


def main() -> int:
    ap = argparse.ArgumentParser(description="Build /m/{ja,en}/<id>.html mobile detail pages")
    ap.add_argument("--limit", type=int, default=None,
                    help="Build only the first N occupations (after sort by id).")
    ap.add_argument("--ids", default=None,
                    help="Comma-separated padded ids (e.g. 0001,0033). Overrides --limit.")
    ap.add_argument("--langs", default="ja,en",
                    help="Comma-separated languages (default: ja,en).")
    args = ap.parse_args()

    langs = [l.strip() for l in args.langs.split(",") if l.strip()]
    bad = [l for l in langs if l not in LANGS]
    if bad:
        print(f"FATAL: unknown lang(s): {bad}", file=sys.stderr)
        return 1

    print("=" * 70)
    print("build_mobile_detail.py")
    print(f"  out      : {OUT.relative_to(ROOT)}/{{{','.join(langs)}}}/<id>.html")
    print(f"  started  : {dt.datetime.now().isoformat(timespec='seconds')}")
    print("=" * 70)

    # ── Load shared data ──
    print("\n[load] dictionaries + projections …")
    dictionary = load()
    profile5 = json.loads((DIST / "data.profile5.json").read_text(encoding="utf-8")).get("profiles", {})
    transfer = json.loads((DIST / "data.transfer_paths.json").read_text(encoding="utf-8")).get("paths", {})

    # ── Determine target id list ──
    detail_dir = DIST / "data.detail"
    if args.ids:
        padded_list = [s.strip().zfill(4) for s in args.ids.split(",") if s.strip()]
    else:
        padded_list = sorted(p.stem for p in detail_dir.glob("*.json"))
        if args.limit:
            padded_list = padded_list[: args.limit]

    print(f"  occupations    : {len(padded_list)}")
    print(f"  languages      : {langs}")
    print(f"  total files    : {len(padded_list) * len(langs)}")

    # ── Ensure output dirs ──
    for lang in langs:
        (OUT / lang).mkdir(parents=True, exist_ok=True)

    # ── Render loop ──
    print("\n[build] rendering …")
    written = 0
    total_size = 0
    errors = 0
    for padded in padded_list:
        try:
            detail = json.loads((detail_dir / f"{padded}.json").read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  ❌ {padded}: failed to load detail: {e}", file=sys.stderr)
            errors += 1
            continue

        occ_id = detail["id"]
        profile = profile5.get(str(occ_id))
        transfer_entry = transfer.get(str(occ_id))

        for lang in langs:
            try:
                html = render(dictionary, lang, detail, profile, transfer_entry)
            except Exception as e:
                print(f"  ❌ {padded} [{lang}] render failed: {type(e).__name__}: {e}", file=sys.stderr)
                errors += 1
                continue
            out_path = OUT / lang / f"{occ_id}.html"
            out_path.write_text(html + "\n", encoding="utf-8")
            written += 1
            total_size += out_path.stat().st_size

        if written % 200 == 0 and written > 0:
            print(f"    ... {written}/{len(padded_list) * len(langs)} written")

    print("\n" + "=" * 70)
    print("BUILD OK" if errors == 0 else f"BUILD WITH {errors} ERROR(S)")
    print(f"  files written  : {written}")
    print(f"  avg size       : {total_size / max(written, 1) / 1024:.1f} KB")
    print(f"  total size     : {total_size / 1024 / 1024:.1f} MB")
    print(f"  finished       : {dt.datetime.now().isoformat(timespec='seconds')}")
    print("=" * 70)
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
