"""⑦ ランキング — `/m/{ja,en}/ranking` per MOBILE_DESIGN.md §5.6.

Two pre-rendered numbered lists (high-risk / low-risk), CSS toggle via
data-active. No JS data fetch — values inlined at build time.

Data: dist/data.treemap.json sorted by ai_risk; take top 25 each side.
"""
from __future__ import annotations

import json
from html import escape
from pathlib import Path

from lib.i18n import t, t_plain  # type: ignore[import-not-found]
from lib.mobile_render import (  # type: ignore[import-not-found]
    Lang,
    render_footer,
    render_html_shell,
    render_menu,
    render_navbar,
    url_for,
)


SCREEN_ID = "ranking"
PATH = "/ranking"
TOP_N = 25


def _load_treemap() -> list[dict]:
    """Load and sort treemap records (only those with ai_risk)."""
    repo = Path(__file__).resolve().parent.parent.parent.parent
    data = json.loads((repo / "dist" / "data.treemap.json").read_text(encoding="utf-8"))
    return [d for d in data if d.get("ai_risk") is not None]


def _row(rank: int, occ: dict, lang: Lang, dictionary: dict) -> str:
    name = occ["name_en"] if lang == "en" and occ.get("name_en") else occ["name_ja"]
    workers = occ.get("workers", 0)
    salary = occ.get("salary")
    ratio = occ.get("recruit_ratio")
    risk = occ["ai_risk"]
    band = occ.get("risk_band", "mid")
    occ_id = occ["id"]
    detail_url = url_for(lang, f"/{occ_id}")

    workforce_unit = t_plain(dictionary, "common.unit.workers", lang)
    workforce_str = f"{workers / 10000:.0f}{workforce_unit}" if lang == "ja" else f"{workers / 1000:.0f}k"

    salary_str = ""
    if salary is not None:
        if lang == "ja":
            salary_str = f"¥{salary:.0f}万"
        else:
            salary_str = f"¥{salary / 100:.2f}M"
    ratio_str = f"·  {ratio:.2f}" if ratio is not None else ""

    return (
        f'<li class="m-rank__row">'
        f'<a class="m-rank__link" href="{detail_url}">'
        f'<span class="m-rank__num">{rank:02d}</span>'
        f'<span class="m-rank__body">'
        f'<span class="m-rank__name">{escape(name)}</span>'
        f'<span class="m-rank__meta">{escape(workforce_str)}  ·  {escape(salary_str)}  {escape(ratio_str)}</span>'
        f'</span>'
        f'<span class="m-rank__score m-risk-{band}">{risk}<sub>/10</sub></span>'
        f'</a>'
        f'</li>'
    )


def _list(records: list[dict], lang: Lang, dictionary: dict, *, descending: bool) -> str:
    sorted_recs = sorted(records, key=lambda r: r["ai_risk"], reverse=descending)
    rows = "".join(_row(i + 1, r, lang, dictionary) for i, r in enumerate(sorted_recs[:TOP_N]))
    side = "high" if descending else "low"
    return f'<ol class="m-rank__list" data-side="{side}">{rows}</ol>'


def render(dictionary: dict, lang: Lang) -> str:
    title_text = t_plain(dictionary, "ranking.title", lang)
    title = f"{title_text} — {t_plain(dictionary, 'brand.wordmark', lang)}"
    description = t_plain(dictionary, "ranking.title", lang) + " · 552 occupations ranked by AI exposure."
    canonical = f"https://mirai-shigoto.com{url_for(lang, PATH)}"

    records = _load_treemap()

    main_inner = (
        f'<main class="m-frame__main m-rank">'
        f'<section class="m-rank__hero">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "brand.eyebrow", lang))}</span>'
        f'<h1 class="m-rank__title m-t-h1">{escape(t_plain(dictionary, "ranking.title", lang))}</h1>'
        f'</section>'
        f'<div class="m-rank__tabs" role="tablist">'
        f'<button class="m-rank__tab" type="button" data-target="high" data-active="true" role="tab">'
        f'{t(dictionary, "ranking.tab.high", lang)}'
        f'</button>'
        f'<button class="m-rank__tab" type="button" data-target="low" role="tab">'
        f'{t(dictionary, "ranking.tab.low", lang)}'
        f'</button>'
        f'</div>'
        + _list(records, lang, dictionary, descending=True)
        + _list(records, lang, dictionary, descending=False)
        + f'</main>'
    )

    body = (
        f'<div class="m-frame">'
        + render_navbar(dictionary, lang, current_path=PATH)
        + render_menu(dictionary, lang, current_screen=SCREEN_ID)
        + main_inner
        + render_footer(dictionary, lang)
        + f'</div>'
    )

    extra_head = (
        '<link rel="stylesheet" href="/styles/mobile-screen-ranking.css">'
        '<script defer src="/m/islands/ranking-tabs.js"></script>'
    )

    return render_html_shell(
        lang=lang, title=title, description=description,
        canonical=canonical, body_inner=body, extra_head=extra_head,
    )
