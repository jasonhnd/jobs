"""⑥ 比較 — `/m/{ja,en}/compare` per MOBILE_DESIGN.md §5.5.

Static shell + compare island. URL params `?a=<id>&b=<id>` select the
two occupations. Island fetches /data.detail/<padded>.json for each
plus /data.profile5.json once for radar data.
"""
from __future__ import annotations

from html import escape

from lib.i18n import t, t_plain  # type: ignore[import-not-found]
from lib.mobile_render import (  # type: ignore[import-not-found]
    Lang,
    render_footer,
    render_html_shell,
    render_menu,
    render_navbar,
    url_for,
)


SCREEN_ID = "compare"
PATH = "/compare"


def render(dictionary: dict, lang: Lang) -> str:
    title_text = t_plain(dictionary, "compare.title", lang)
    title = f"{title_text} — {t_plain(dictionary, 'brand.wordmark', lang)}"
    desc = title_text
    canonical = f"https://mirai-shigoto.com{url_for(lang, PATH)}"

    rows_legend = "".join(
        f'<tr><th class="m-cmp__row-label">{t(dictionary, f"compare.row.{k}", lang)}</th>'
        f'<td data-side="a" data-row="{k}">–</td>'
        f'<td data-side="b" data-row="{k}">–</td></tr>'
        for k in ("ai_score", "salary", "workforce", "ratio")
    )

    profile_axes = "".join(
        f'<tr><th class="m-cmp__row-label">{t(dictionary, f"detail.profile.{k}", lang)}</th>'
        f'<td data-side="a" data-axis="{k}">–</td>'
        f'<td data-side="b" data-axis="{k}">–</td></tr>'
        for k in ("creative", "social", "judgment", "physical", "routine")
    )

    main_inner = (
        f'<main class="m-frame__main m-cmp" data-island="compare">'
        f'<section class="m-cmp__hero">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "brand.eyebrow", lang))}</span>'
        f'<h1 class="m-cmp__title m-t-h1">'
        f'{escape(t_plain(dictionary, "compare.title", lang))}'
        f'</h1>'
        f'</section>'
        f'<div class="m-cmp__pickers">'
        f'<button class="m-cmp__picker" type="button" data-side="a">'
        f'<span class="m-mono-tag">A</span>'
        f'<span class="m-cmp__picker-name" data-role="picker-name-a">'
        f'{escape(t_plain(dictionary, "compare.placeholder.a", lang))}</span>'
        f'</button>'
        f'<span class="m-cmp__vs">vs.</span>'
        f'<button class="m-cmp__picker" type="button" data-side="b">'
        f'<span class="m-mono-tag">B</span>'
        f'<span class="m-cmp__picker-name" data-role="picker-name-b">'
        f'{escape(t_plain(dictionary, "compare.placeholder.b", lang))}</span>'
        f'</button>'
        f'</div>'
        f'<table class="m-cmp__table">'
        f'<colgroup><col class="m-cmp__col-label"><col><col></colgroup>'
        f'<tbody>'
        + rows_legend
        + f'<tr><th colspan="3" class="m-cmp__section-title">'
        f'{t(dictionary, "compare.row.profile", lang)}</th></tr>'
        + profile_axes
        + f'</tbody></table>'
        f'<p class="m-cmp__hint" data-role="hint">'
        f'?a=&lt;id&gt;&amp;b=&lt;id&gt; をURLに追加してください。例: ?a=33&amp;b=183'
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
        '<link rel="stylesheet" href="/styles/mobile-screen-compare.css">'
        f'<script>window.M_LANG = "{lang}";</script>'
        '<script defer src="/m/islands/compare.js"></script>'
    )

    return render_html_shell(
        lang=lang, title=title, description=desc,
        canonical=canonical, body_inner=body, extra_head=extra_head,
    )
