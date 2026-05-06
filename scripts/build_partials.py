#!/usr/bin/env python3
"""Inject shared HTML partials into static pages between marker comments.

Single source of truth for site-wide footer (and any future shared partial)
lives in `partials/<name>.html`. Each consumer page wraps the injection
target with marker comments:

    <!-- FOOTER:START -->
    <!-- FOOTER:END -->

Running this script replaces everything between the markers (the markers
themselves are preserved) with the current contents of the partial file.

Generated pages (ja/<id>.html, ja/sectors/*.html, ja/rankings/*.html) are
NOT touched here — those are produced by build_occupations.py /
build_sector_hubs.py / build_rankings.py, which load the same partial
directly. So the canonical edit flow is:

    1. Edit partials/footer.html
    2. Run `npm run build:footer`        (this script — updates 5 static pages)
    3. Run `npm run build`               (regenerates detail / sector / ranking)

Or just `npm run build` since the toplevel target depends on this script.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTIALS_DIR = ROOT / "partials"


def get_last_commit_datetime() -> tuple[str, str]:
    """Return (display, iso) of latest git commit datetime, normalized to JST.

    display: 'YYYY/MM/DD/HH:MM' (used for visible footer text)
    iso:     'YYYY-MM-DDTHH:MM:00+09:00' (used in <time datetime="...">)

    Used to bake a visible "最終更新" timestamp into the footer of every page
    on each Vercel build. Falls back to current time if git is unavailable.
    """
    from datetime import datetime, timedelta, timezone
    jst = timezone(timedelta(hours=9))
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI"],  # ISO 8601 strict with TZ
            capture_output=True,
            text=True,
            cwd=ROOT,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            dt = datetime.fromisoformat(result.stdout.strip()).astimezone(jst)
            return dt.strftime("%Y/%m/%d/%H:%M"), dt.isoformat(timespec="seconds")
    except Exception:
        pass
    now = datetime.now(jst)
    return now.strftime("%Y/%m/%d/%H:%M"), now.isoformat(timespec="seconds")

# Static pages that consume the footer partial via marker comments.
# Generated pages handle the partial directly inside their build script.
STATIC_PAGES: list[str] = [
    "index.html",
    "404.html",
    "about.html",
    "compliance.html",
    "privacy.html",
]

# Partials to inject. Add new partials here as they are extracted.
PARTIALS: list[str] = [
    "footer",
]


def load_partial(name: str) -> str:
    path = PARTIALS_DIR / f"{name}.html"
    if not path.exists():
        raise FileNotFoundError(f"Partial not found: {path}")
    raw = path.read_text(encoding="utf-8").rstrip("\n")
    # Substitute {{LAST_UPDATED}} (display) and {{LAST_UPDATED_ISO}} (datetime).
    display, iso = get_last_commit_datetime()
    return (
        raw.replace("{{LAST_UPDATED_ISO}}", iso)
           .replace("{{LAST_UPDATED}}", display)
    )


def inject(html: str, name: str, partial: str) -> tuple[str, bool, bool]:
    """Inject `partial` between <!-- NAME:START --> ... <!-- NAME:END --> markers.

    Returns (new_html, marker_found, content_changed).
    """
    upper = name.upper()
    pattern = re.compile(
        rf"(<!--\s*{re.escape(upper)}:START\s*-->)(.*?)(<!--\s*{re.escape(upper)}:END\s*-->)",
        re.DOTALL,
    )
    match = pattern.search(html)
    if not match:
        return html, False, False
    new_block = f"{match.group(1)}\n      {partial}\n      {match.group(3)}"
    new_html = html[: match.start()] + new_block + html[match.end():]
    return new_html, True, new_html != html


def main() -> int:
    partials_loaded = {name: load_partial(name) for name in PARTIALS}

    total_updated = 0
    total_uptodate = 0
    total_skipped = 0

    for page in STATIC_PAGES:
        path = ROOT / page
        if not path.exists():
            print(f"  - {page}: NOT FOUND, skipping", file=sys.stderr)
            total_skipped += 1
            continue

        html = path.read_text(encoding="utf-8")
        page_changed = False
        page_status = []

        for name, partial in partials_loaded.items():
            new_html, marker_found, content_changed = inject(html, name, partial)
            if not marker_found:
                page_status.append(f"no {name.upper()} marker")
                continue
            html = new_html
            if content_changed:
                page_changed = True
                page_status.append(f"{name} updated")
            else:
                page_status.append(f"{name} up-to-date")

        if page_changed:
            path.write_text(html, encoding="utf-8")
            total_updated += 1
            print(f"  ✓ {page}: {', '.join(page_status)}")
        elif any("no " in s for s in page_status):
            total_skipped += 1
            print(f"  ! {page}: {', '.join(page_status)}")
        else:
            total_uptodate += 1
            print(f"  = {page}: {', '.join(page_status)}")

    print(
        f"\nDone — {total_updated} updated, {total_uptodate} up-to-date, "
        f"{total_skipped} skipped"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
