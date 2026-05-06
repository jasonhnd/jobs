#!/usr/bin/env python3
"""
build_image_sitemap.py — generate image-sitemap.xml for Google Image Search.

Each of the 556 occupation pages has a dynamic OG image at /api/og?id=<id>.
These images are not discoverable by crawlers (only referenced in <meta> tags).
An image sitemap explicitly tells Google about them.

Output:
  image-sitemap.xml

Usage:
  python3 scripts/build_image_sitemap.py
"""
from __future__ import annotations
import json
from html import escape as xml_escape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DETAIL_DIR = REPO / "dist" / "data.detail"
OUT_PATH = REPO / "image-sitemap.xml"
SITE = "https://mirai-shigoto.com"


def main() -> int:
    entries: list[str] = []

    for f in sorted(DETAIL_DIR.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        occ_id = d["id"]
        title_ja = (d.get("title") or {}).get("ja", "")
        ai_risk = (d.get("ai_risk") or {}).get("score")
        risk_str = f"AI影響 {ai_risk}/10" if ai_risk is not None else ""

        page_url = f"{SITE}/ja/{occ_id}"
        image_url = f"{SITE}/api/og?id={occ_id}"
        image_title = f"{title_ja} — {risk_str}" if risk_str else title_ja

        entries.append(
            f"  <url>\n"
            f"    <loc>{xml_escape(page_url)}</loc>\n"
            f"    <image:image>\n"
            f"      <image:loc>{xml_escape(image_url)}</image:loc>\n"
            f"      <image:title>{xml_escape(image_title)}</image:title>\n"
            f"    </image:image>\n"
            f"  </url>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )

    OUT_PATH.write_text(xml, encoding="utf-8")
    print(f"Generated image sitemap: {OUT_PATH} ({len(entries)} images)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
