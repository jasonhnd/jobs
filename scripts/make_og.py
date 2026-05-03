"""Render og-card.html → og.png at exactly 1200x630 via headless Chromium.

Run after editing og-card.html (copy, stats, footer attribution, etc.).

Usage:
    uv run python scripts/make_og.py
"""

from playwright.sync_api import sync_playwright
import pathlib


REPO = pathlib.Path(__file__).resolve().parent.parent
SOURCE = REPO / "scripts" / "templates" / "og-card.html"
OUT = REPO / "og.png"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(f"file://{SOURCE}")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(OUT), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, omit_background=False)
        browser.close()
    size = OUT.stat().st_size
    print(f"Wrote {OUT} ({size:,} bytes)")


if __name__ == "__main__":
    main()
