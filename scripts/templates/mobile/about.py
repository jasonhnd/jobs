"""⑩ この企画について — `/m/{ja,en}/about` per MOBILE_DESIGN.md §5.7.

This is the simplest screen — pure static content, no data dependency.
Used as the pipeline-validation screen because if About renders correctly,
the i18n + tokens + navbar + footer infrastructure is all wired right.
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


SCREEN_ID = "about"
PATH = "/about"


def _method_card(dictionary: dict, lang: Lang, key_base: str) -> str:
    """Render one of the 4 methodology cards (AI score / workforce / demand / 5-axis)."""
    return (
        f'<article class="m-card m-card--method">'
        f'<h3 class="m-card__title">{t(dictionary, f"about.method.{key_base}.title", lang)}</h3>'
        f'<p class="m-card__body">{escape(t_plain(dictionary, f"about.method.{key_base}.body", lang))}</p>'
        f'</article>'
    )


def _hero(dictionary: dict, lang: Lang) -> str:
    return (
        f'<section class="m-about__hero">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "brand.eyebrow", lang))}</span>'
        f'<h1 class="m-about__title m-t-h1">{t(dictionary, "about.title", lang)}</h1>'
        f'<p class="m-about__intro m-t-body">{escape(t_plain(dictionary, "about.intro", lang))}</p>'
        f'</section>'
    )


def _methodology(dictionary: dict, lang: Lang) -> str:
    cards = "".join(
        _method_card(dictionary, lang, k)
        for k in ("ai_score", "workers", "demand", "profile")
    )
    return (
        f'<section class="m-about__method">'
        f'<h2 class="m-about__section-title m-t-h2">{t(dictionary, "about.method.title", lang)}</h2>'
        f'<div class="m-card-grid">{cards}</div>'
        f'</section>'
    )


def _sources(dictionary: dict, lang: Lang) -> str:
    items = []
    for k in ("mhlw", "oecd", "census"):
        items.append(f'<li>{escape(t_plain(dictionary, f"about.sources.list.{k}", lang))}</li>')
    return (
        f'<section class="m-about__sources">'
        f'<h2 class="m-about__section-title m-t-h2">{t(dictionary, "about.sources.title", lang)}</h2>'
        f'<ul class="m-about__list">' + "".join(items) + '</ul>'
        f'</section>'
    )


def _caveats(dictionary: dict, lang: Lang) -> str:
    return (
        f'<section class="m-about__caveats">'
        f'<h2 class="m-about__section-title m-t-h2">{t(dictionary, "about.caveats.title", lang)}</h2>'
        f'<p class="m-about__caveat-body m-t-body">{escape(t_plain(dictionary, "about.caveats.body", lang))}</p>'
        f'</section>'
    )


def _team(dictionary: dict, lang: Lang) -> str:
    return (
        f'<section class="m-about__team">'
        f'<h2 class="m-about__section-title m-t-h2">{t(dictionary, "about.team.title", lang)}</h2>'
        f'<p class="m-about__team-body m-t-body">{escape(t_plain(dictionary, "about.team.body", lang))}</p>'
        f'</section>'
    )


def render(dictionary: dict, lang: Lang) -> str:
    """Build the full About page HTML for one language."""
    title = f"{t_plain(dictionary, 'about.title', lang)} — {t_plain(dictionary, 'brand.wordmark', lang)}"
    description = t_plain(dictionary, "about.intro", lang)
    canonical = f"https://mirai-shigoto.com{url_for(lang, PATH)}"

    main_inner = (
        f'<main class="m-frame__main m-about">'
        + _hero(dictionary, lang)
        + _methodology(dictionary, lang)
        + _sources(dictionary, lang)
        + _caveats(dictionary, lang)
        + _team(dictionary, lang)
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
        '<link rel="stylesheet" href="/styles/mobile-screen-about.css">'
    )

    return render_html_shell(
        lang=lang,
        title=title,
        description=description,
        canonical=canonical,
        body_inner=body,
        extra_head=extra_head,
    )
