"""① ホーム — `/m/{ja,en}/`. DEAD CODE since v1.2.0.

DEAD CODE: v1.1.0 mobile-web template for the retired `/m/*` URL
architecture. Replaced by single-URL responsive design in v1.2.0; no
`/m/` directory has been built or shipped since. Spec doc
`docs/MOBILE_DESIGN.md` deleted 2026-05-06 (current mobile spec lives
in `docs/Design-Mobile.md`, but covers the responsive design, not this
`/m/*` template). Entire `scripts/templates/mobile/` directory is safe
to delete in a follow-up cleanup.


The capstone screen — composes hero, search, featured, insight, top-5
ranking, map teaser, compare teaser, footer.
"""
from __future__ import annotations

import json
from html import escape
from pathlib import Path

from lib.bands import risk_band  # type: ignore[import-not-found]
from lib.i18n import t, t_plain  # type: ignore[import-not-found]
from lib.mobile_render import (  # type: ignore[import-not-found]
    Lang,
    render_footer,
    render_html_shell,
    render_menu,
    render_navbar,
    url_for,
)


SCREEN_ID = "home"
PATH = "/"


# Featured occupation id — handpicked weekly.
# v1.1.x: 33 = 看護師 (clear low-risk story, broad recognition).
FEATURED_ID = 33

# Quick-link chips below hero search.
HOME_CHIPS = [
    ("看護師",   33),
    ("一般事務", None),  # filled by search-by-name lookup at build time below
    ("営業",     None),
    ("介護職",   None),
    ("保育士",   None),
]


def _load_treemap() -> list[dict]:
    repo = Path(__file__).resolve().parent.parent.parent.parent
    return json.loads((repo / "dist" / "data.treemap.json").read_text(encoding="utf-8"))


def _resolve_chip_ids(treemap: list[dict]) -> list[tuple[str, int | None]]:
    resolved: list[tuple[str, int | None]] = []
    for label, fixed_id in HOME_CHIPS:
        if fixed_id is not None:
            resolved.append((label, fixed_id))
            continue
        match = next((r for r in treemap if r.get("name_ja", "").startswith(label)), None)
        resolved.append((label, match["id"] if match else None))
    return resolved


def _hero(dictionary: dict, lang: Lang) -> str:
    eyebrow = escape(t_plain(dictionary, "home.hero.eyebrow", lang))
    return (
        f'<section class="m-home__hero">'
        f'<span class="m-mono-tag m-mono-tag--accent">{eyebrow}</span>'
        f'<h1 class="m-home__title">'
        f'{t(dictionary, "home.hero.title.line1", lang)}<br>'
        f'{t(dictionary, "home.hero.title.line2", lang)}<br>'
        f'{t(dictionary, "home.hero.title.line3", lang)}'
        f'</h1>'
        f'<p class="m-home__subtitle">{escape(t_plain(dictionary, "home.hero.subtitle", lang))}</p>'
        f'</section>'
    )


def _search(dictionary: dict, lang: Lang, chips: list[tuple[str, int | None]]) -> str:
    chip_html = "".join(
        (f'<a class="m-chip" href="{url_for(lang, f"/{occ_id}")}">{escape(label)}</a>'
         if occ_id else
         f'<span class="m-chip" aria-disabled="true">{escape(label)}</span>')
        for label, occ_id in chips
    )
    return (
        f'<section class="m-home__search">'
        f'<form class="m-search__form" action="{url_for(lang, "/search")}" method="get">'
        f'<input class="m-search__input" type="search" name="q" '
        f'placeholder="{escape(t_plain(dictionary, "home.search.placeholder", lang))}" '
        f'aria-label="{escape(t_plain(dictionary, "home.search.placeholder", lang))}">'
        f'<button class="m-search__btn" type="submit">'
        f'{escape(t_plain(dictionary, "home.search.button", lang))}'
        f'</button>'
        f'</form>'
        f'<div class="m-home__chips">{chip_html}</div>'
        f'</section>'
    )


def _featured(dictionary: dict, lang: Lang, treemap: list[dict]) -> str:
    occ = next((r for r in treemap if r["id"] == FEATURED_ID), None)
    if not occ:
        return ""
    name = occ["name_en"] if lang == "en" and occ.get("name_en") else occ["name_ja"]
    risk = occ["ai_risk"]
    band = risk_band(risk)
    workers = occ.get("workers", 0)
    salary = occ.get("salary")
    ratio = occ.get("recruit_ratio")
    detail_url = url_for(lang, f"/{occ['id']}")

    workforce_str = f"{workers / 10000:.0f}万人" if lang == "ja" else f"{workers / 1000:.0f}k"
    salary_str = (f"¥{salary:.2f}M" if lang == "en" and salary else (f"¥{salary:.0f}万" if salary else "–"))
    ratio_str = f"{ratio:.2f}" if ratio else "–"

    return (
        f'<section class="m-home__featured">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "home.featured.eyebrow", lang))}</span>'
        f'<a class="m-featured-card" href="{detail_url}">'
        f'<div class="m-featured-card__head">'
        f'<div>'
        f'<h2 class="m-featured-card__name">{escape(name)}</h2>'
        f'<span class="m-featured-card__sub">{escape(occ.get("name_en") or "")}</span>'
        f'</div>'
        f'<span class="m-featured-card__score m-risk-{band}">{risk}<sub>/10</sub></span>'
        f'</div>'
        f'<div class="m-featured-card__stats">'
        f'<div><span>{escape(workforce_str)}</span><label>就業者</label></div>'
        f'<div><span>{escape(salary_str)}</span><label>中央年収</label></div>'
        f'<div><span>{escape(ratio_str)}</span><label>求人倍率</label></div>'
        f'</div>'
        f'<div class="m-featured-card__more">{t(dictionary, "home.featured.read_more", lang)}</div>'
        f'</a>'
        f'</section>'
    )


def _insight(dictionary: dict, lang: Lang) -> str:
    return (
        f'<section class="m-home__insight">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "home.insight.eyebrow", lang))}</span>'
        f'<h3 class="m-home__insight-headline">'
        f'<em class="m-color-accent">{escape(t_plain(dictionary, "home.insight.headline", lang))}</em>'
        f'</h3>'
        f'<p class="m-home__insight-body">{escape(t_plain(dictionary, "home.insight.body", lang))}</p>'
        f'<p class="m-home__insight-meta">{escape(t_plain(dictionary, "home.insight.next_update", lang))}</p>'
        f'</section>'
    )


def _top5(dictionary: dict, lang: Lang, treemap: list[dict]) -> str:
    sorted_recs = sorted(
        [r for r in treemap if r.get("ai_risk") is not None],
        key=lambda r: r["ai_risk"],
    )[:5]
    rows = ""
    for i, r in enumerate(sorted_recs, 1):
        name = r["name_en"] if lang == "en" and r.get("name_en") else r["name_ja"]
        url = url_for(lang, f"/{r['id']}")
        risk = r["ai_risk"]
        band = risk_band(risk)
        workers = r.get("workers", 0)
        salary = r.get("salary")
        meta = f"{workers / 10000:.0f}万人" if lang == "ja" else f"{workers / 1000:.0f}k"
        if salary:
            meta += f"  ·  " + (f"¥{salary:.2f}M" if lang == "en" else f"¥{salary:.0f}万")
        rows += (
            f'<li class="m-rank__row"><a class="m-rank__link" href="{url}">'
            f'<span class="m-rank__num">{i:02d}</span>'
            f'<span class="m-rank__body">'
            f'<span class="m-rank__name">{escape(name)}</span>'
            f'<span class="m-rank__meta">{escape(meta)}</span>'
            f'</span>'
            f'<span class="m-rank__score m-risk-{band}">{risk}<sub>/10</sub></span>'
            f'</a></li>'
        )
    see_all_url = url_for(lang, "/ranking")
    return (
        f'<section class="m-home__top5">'
        f'<div class="m-home__section-head">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "home.top5.eyebrow", lang))}</span>'
        f'<a class="m-home__see-all" href="{see_all_url}">{t(dictionary, "home.top5.see_all", lang)}</a>'
        f'</div>'
        f'<h3 class="m-home__top5-title">{t(dictionary, "home.top5.title", lang)}</h3>'
        f'<ol class="m-rank__list" data-side="low" style="display:block">{rows}</ol>'
        f'</section>'
    )


def _map_teaser(dictionary: dict, lang: Lang) -> str:
    map_url = url_for(lang, "/map")
    return (
        f'<section class="m-home__map-teaser">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "home.map_teaser.eyebrow", lang))}</span>'
        f'<h3 class="m-home__teaser-title">{t(dictionary, "home.map_teaser.title", lang)}</h3>'
        f'<p class="m-home__teaser-caption">{escape(t_plain(dictionary, "home.map_teaser.caption", lang))}</p>'
        f'<div class="m-home__teaser-thumb" aria-hidden="true">'
        # Inline SVG mini-treemap (16 sectors as rectangles by approximate size)
        f'<svg viewBox="0 0 320 200" width="100%" preserveAspectRatio="none">'
        f'<rect x="0"   y="0"   width="120" height="80"  fill="#D96B3D" />'
        f'<rect x="120" y="0"   width="100" height="80"  fill="#E8843E" />'
        f'<rect x="220" y="0"   width="100" height="60"  fill="#F2A33C" />'
        f'<rect x="220" y="60"  width="100" height="60"  fill="#D9A53D" />'
        f'<rect x="0"   y="80"  width="80"  height="120" fill="#E8843E" />'
        f'<rect x="80"  y="80"  width="80"  height="60"  fill="#9CB05A" />'
        f'<rect x="160" y="80"  width="60"  height="60"  fill="#6E9B89" />'
        f'<rect x="220" y="120" width="100" height="80"  fill="#48705F" />'
        f'<rect x="80"  y="140" width="80"  height="60"  fill="#6E9B89" />'
        f'<rect x="160" y="140" width="60"  height="60"  fill="#9CB05A" />'
        f'</svg>'
        f'</div>'
        f'<a class="m-home__cta" href="{map_url}">{t(dictionary, "home.map_teaser.cta", lang)}</a>'
        f'</section>'
    )


def _compare_teaser(dictionary: dict, lang: Lang) -> str:
    cmp_url = url_for(lang, "/compare?a=33&b=183")  # 看護師 vs 一般事務 (approx)
    return (
        f'<section class="m-home__compare-teaser">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "home.compare_teaser.eyebrow", lang))}</span>'
        f'<a class="m-cmp-teaser" href="{cmp_url}">'
        f'<span class="m-cmp-teaser__a">看護師</span>'
        f'<span class="m-cmp-teaser__vs"><em>vs.</em></span>'
        f'<span class="m-cmp-teaser__b">一般事務</span>'
        f'<span class="m-cmp-teaser__arrow">→</span>'
        f'</a>'
        f'</section>'
    )


def render(dictionary: dict, lang: Lang) -> str:
    treemap = _load_treemap()
    chips = _resolve_chip_ids(treemap)

    title = (
        "未来の仕事 — 552 職業 × AI影響度"
        if lang == "ja" else
        "MIRAI NO SHIGOTO — 552 occupations × AI impact"
    )
    desc = t_plain(dictionary, "home.hero.subtitle", lang)
    canonical = f"https://mirai-shigoto.com{url_for(lang, '/')}"

    main_inner = (
        f'<main class="m-frame__main m-home">'
        + _hero(dictionary, lang)
        + _search(dictionary, lang, chips)
        + _featured(dictionary, lang, treemap)
        + _insight(dictionary, lang)
        + _top5(dictionary, lang, treemap)
        + _map_teaser(dictionary, lang)
        + _compare_teaser(dictionary, lang)
        + f'</main>'
    )

    body = (
        f'<div class="m-frame">'
        + render_navbar(dictionary, lang, current_path="/")
        + render_menu(dictionary, lang, current_screen=SCREEN_ID)
        + main_inner
        + render_footer(dictionary, lang)
        + f'</div>'
    )

    extra_head = (
        '<link rel="stylesheet" href="/styles/mobile-screen-home.css">'
        '<link rel="stylesheet" href="/styles/mobile-screen-ranking.css">'  # for top-5 list reuse
        '<link rel="stylesheet" href="/styles/mobile-screen-search.css">'  # for search form reuse
    )

    return render_html_shell(
        lang=lang, title=title, description=desc,
        canonical=canonical, body_inner=body, extra_head=extra_head,
    )
