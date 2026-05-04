"""build_mobile.py — generate /m/{ja,en}/* mobile-web pages.

Per docs/MOBILE_DESIGN.md §3 (8 screens × 2 languages = 16 pages, plus
1104 detail pages once those templates land).

Inputs:
    scripts/i18n/mobile_strings.json     — UI strings dictionary (§9.2)
    dist/data.treemap.json                — for home/map/ranking
    dist/data.search.json                 — for search island
    dist/data.sectors.json                — for map sector grouping
    dist/data.detail/<padded>.json        — for /m/{lang}/<id>
    dist/data.profile5.json               — for detail 5-axis radar (v1.1.x phase 2)
    dist/data.transfer_paths.json         — for detail "related" grid (v1.1.x phase 2)

Outputs:
    m/ja/index.html      m/en/index.html       (① ホーム)
    m/ja/map.html        m/en/map.html         (② 職業マップ)
    m/ja/search.html     m/en/search.html      (③ 検索結果)
    m/ja/compare.html    m/en/compare.html     (⑥ 比較)
    m/ja/ranking.html    m/en/ranking.html     (⑦ ランキング)
    m/ja/about.html      m/en/about.html       (⑩ この企画について)
    m/ja/<id>.html       m/en/<id>.html        (④/⑤ detail × 1104)

Usage:
    uv run python scripts/build_mobile.py            # all enabled screens
    uv run python scripts/build_mobile.py --screen about
    uv run python scripts/build_mobile.py --langs ja
    uv run python scripts/build_mobile.py --validate-only
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
sys.path.insert(0, str(ROOT / "scripts"))

from lib.i18n import LANGS, audit_completeness, load  # noqa: E402

OUT_ROOT = ROOT / "m"


# ───── Screen registry ─────
# Each screen module exposes:
#   PATH    : URL path stem (e.g. "/about", "/" for home)
#   render(dictionary, lang) -> str

SCREENS_ENABLED: list[str] = [
    "about",
    "ranking",
    "explore",
    "search",
    "compare",
    "home",
]

# Static screen filename map (path → output filename within m/<lang>/).
# Home is special-cased as "index.html".
SCREEN_FILENAME = {
    "/":         "index.html",
    "/map":      "map.html",
    "/search":   "search.html",
    "/compare":  "compare.html",
    "/ranking":  "ranking.html",
    "/about":    "about.html",
}


def _import_screen(name: str):
    """Dynamic import: scripts/templates/mobile/<name>.py"""
    mod = __import__(f"templates.mobile.{name}", fromlist=["render", "PATH"])
    return mod


def _ensure_lang_dir(lang: str) -> Path:
    out = OUT_ROOT / lang
    out.mkdir(parents=True, exist_ok=True)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Build mobile-web HTML under /m/")
    ap.add_argument("--screen", action="append", default=None,
                    help="Build only this screen (repeat to add multiple). Default: all enabled.")
    ap.add_argument("--langs", default="ja,en",
                    help="Comma-separated languages to build (default: ja,en).")
    ap.add_argument("--validate-only", action="store_true",
                    help="Run i18n completeness audit only; do not write any HTML.")
    args = ap.parse_args()

    print("=" * 70)
    print("build_mobile.py — mobile-web (Direction C: Warm Editorial)")
    print(f"  out root : {OUT_ROOT.relative_to(ROOT)}")
    print(f"  langs    : {args.langs}")
    print(f"  screens  : {args.screen or SCREENS_ENABLED}")
    print(f"  mode     : {'validate-only' if args.validate_only else 'build'}")
    print(f"  started  : {dt.datetime.now().isoformat(timespec='seconds')}")
    print("=" * 70)

    # ── 1. Load + validate i18n dictionary ──
    print("\n[i18n] loading dictionary …")
    dictionary = load()
    holes = audit_completeness(dictionary)
    total_keys = len(dictionary)
    for lang, missing in holes.items():
        print(f"  {lang}: {total_keys - len(missing)}/{total_keys} translated"
              + (f"  ⚠ missing: {missing[:5]}{'...' if len(missing) > 5 else ''}" if missing else "  ✅"))

    requested_langs = [l.strip() for l in args.langs.split(",") if l.strip()]
    bad_langs = [l for l in requested_langs if l not in LANGS]
    if bad_langs:
        print(f"FATAL: unknown lang(s): {bad_langs}", file=sys.stderr)
        return 1

    if args.validate_only:
        print("\n[validate-only] no HTML written; exiting 0")
        return 0

    # ── 2. Determine screens to build ──
    requested = args.screen or SCREENS_ENABLED
    unknown = [s for s in requested if s not in SCREENS_ENABLED]
    if unknown:
        print(f"FATAL: unknown screen(s): {unknown}", file=sys.stderr)
        print(f"  Enabled screens: {SCREENS_ENABLED}", file=sys.stderr)
        return 1

    # ── 3. Render + write each (screen, lang) pair ──
    written = 0
    print(f"\n[build] {len(requested)} screen(s) × {len(requested_langs)} lang(s)")
    for screen_name in requested:
        try:
            mod = _import_screen(screen_name)
        except Exception as e:
            print(f"  ❌ failed to import templates.mobile.{screen_name}: {e}", file=sys.stderr)
            return 2

        path = getattr(mod, "PATH", None)
        if path is None or path not in SCREEN_FILENAME:
            print(f"  ❌ screen {screen_name} has unknown PATH: {path!r}", file=sys.stderr)
            return 1
        filename = SCREEN_FILENAME[path]

        for lang in requested_langs:
            out_dir = _ensure_lang_dir(lang)
            out_path = out_dir / filename
            try:
                html = mod.render(dictionary, lang)
            except Exception as e:
                print(f"  ❌ {screen_name} [{lang}] render failed: {type(e).__name__}: {e}",
                      file=sys.stderr)
                return 2
            out_path.write_text(html + "\n", encoding="utf-8")
            size_kb = out_path.stat().st_size / 1024
            print(f"  ✅ {screen_name:10s} [{lang}] → {out_path.relative_to(ROOT)} ({size_kb:.1f} KB)")
            written += 1

    print("\n" + "=" * 70)
    print(f"BUILD OK at {dt.datetime.now().isoformat(timespec='seconds')}")
    print(f"  files written: {written}")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
