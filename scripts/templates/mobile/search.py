"""③ 検索結果 — `/m/{ja,en}/search` per MOBILE_DESIGN.md §5.3.

Static shell + search island (vanilla JS) that loads /data.search.json
on demand and renders a result list. Supports `?q=<query>` and
`?sector=<id>` URL params for deep linking from the home page chips
and from the map sector cards.
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


SCREEN_ID = "search"
PATH = "/search"


def _load_sectors() -> list[dict]:
    repo = Path(__file__).resolve().parent.parent.parent.parent
    return json.loads((repo / "dist" / "data.sectors.json").read_text(encoding="utf-8"))["sectors"]


def render(dictionary: dict, lang: Lang) -> str:
    sectors = [s for s in _load_sectors() if s["id"] != "_uncategorized"]

    title_text = t_plain(dictionary, "search.title", lang)
    title = f"{title_text} — {t_plain(dictionary, 'brand.wordmark', lang)}"
    desc = title_text
    canonical = f"https://mirai-shigoto.com{url_for(lang, PATH)}"

    # Sector chip filter (initial UI; JS reads ?sector=<id> on load)
    sector_chips = "".join(
        f'<button class="m-chip" type="button" data-sector="{s["id"]}">'
        f'{escape(s["en"] if lang == "en" else s["ja"])}'
        f'</button>'
        for s in sectors
    )

    sort_options = "".join(
        f'<option value="{key}">{t_plain(dictionary, f"search.sort.{key}", lang)}</option>'
        for key in ("popular", "salary", "risk_low", "risk_high")
    )

    main_inner = (
        f'<main class="m-frame__main m-search">'
        f'<section class="m-search__hero">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "brand.eyebrow", lang))}</span>'
        f'<h1 class="m-search__title m-t-h1">{escape(title_text)}</h1>'
        f'</section>'
        f'<form class="m-search__form" data-island="search" role="search">'
        f'<input class="m-search__input" type="search" name="q" autocomplete="off" '
        f'placeholder="{escape(t_plain(dictionary, "search.placeholder", lang))}" '
        f'aria-label="{escape(t_plain(dictionary, "search.placeholder", lang))}">'
        f'<button class="m-search__btn" type="submit">'
        f'{escape(t_plain(dictionary, "search.sort.popular", lang))}'
        f'</button>'
        f'</form>'
        f'<div class="m-search__sectors" role="group" aria-label="sector filter">'
        f'<button class="m-chip" type="button" data-sector="all" data-active="true">All</button>'
        f'{sector_chips}'
        f'</div>'
        f'<div class="m-search__sort">'
        f'<label class="m-search__sort-label" for="m-search-sort">Sort:</label>'
        f'<select class="m-search__sort-select" id="m-search-sort">{sort_options}</select>'
        f'<span class="m-search__count" data-role="count"></span>'
        f'</div>'
        f'<ul class="m-search__results" data-role="results"></ul>'
        f'<p class="m-search__empty" data-role="empty" hidden>'
        f'{escape(t_plain(dictionary, "search.no_results", lang))}'
        f'</p>'
        f'</main>'
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
        '<link rel="stylesheet" href="/styles/mobile-screen-search.css">'
        f'<script>window.M_LANG = "{lang}";</script>'
        '<script defer src="/m/islands/search.js"></script>'
    )

    return render_html_shell(
        lang=lang, title=title, description=desc,
        canonical=canonical, body_inner=body, extra_head=extra_head,
    )
