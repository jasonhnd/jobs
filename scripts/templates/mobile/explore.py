"""② 職業マップ — `/m/{ja,en}/map`. DEAD CODE since v1.2.0.

DEAD CODE: v1.1.0 mobile-web template for the retired `/m/*` URL
architecture. Replaced by single-URL responsive design in v1.2.0; no
`/m/` directory has been built or shipped since. Spec doc
`docs/MOBILE_DESIGN.md` deleted 2026-05-06 (current mobile spec lives
in `docs/Design-Mobile.md` — note: `Design-Mobile.md §4` describes the
NEW `/map` independent page, which is unrelated to this old `/m/*/map`
template). Entire `scripts/templates/mobile/` directory is safe to
delete in a follow-up cleanup.


Sector-grouped tile layout. Each tile = one of the 16 sectors, sized by
workforce, colored by mean ai_risk. Tap a tile → goes to /m/{lang}/search?sector=<id>
where the search island filters to that sector.

For v1.1.0 we ship a 2-column responsive grid (not a true rect-packed treemap)
because (a) it reads better on a 375px viewport than 16 tightly-packed
rectangles, (b) it ships faster, (c) the existing desktop treemap at
`index.html` already serves the "see all 552 in one figure" use case.

A "→ 全 552 職業マップ（デスクトップ版）" link is included to surface that.
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


SCREEN_ID = "explore"
PATH = "/map"


def _load_sectors() -> list[dict]:
    repo = Path(__file__).resolve().parent.parent.parent.parent
    return json.loads((repo / "dist" / "data.sectors.json").read_text(encoding="utf-8"))["sectors"]


def _format_workforce(total: int, lang: Lang) -> str:
    if lang == "ja":
        return f"{total / 10000:.0f}万人"
    return f"{total / 1000:.0f}k people"


def _sector_card(sector: dict, lang: Lang, dictionary: dict) -> str:
    name = sector["en"] if lang == "en" else sector["ja"]
    count = sector.get("occupation_count", 0)
    mean_risk = sector.get("mean_ai_risk")
    band = risk_band(mean_risk) if mean_risk is not None else "mid"
    workforce = _format_workforce(sector.get("total_workforce", 0), lang)

    samples = sector.get("sample_titles_ja", [])[:3]
    sample_str = "・".join(samples) if samples and lang == "ja" else ""

    href = url_for(lang, f"/search?sector={sector['id']}")
    risk_html = (
        f'<span class="m-sector-card__risk m-risk-{band}">{mean_risk:.1f}<sub>/10</sub></span>'
        if mean_risk is not None
        else '<span class="m-sector-card__risk">–</span>'
    )
    samples_html = (
        f'<div class="m-sector-card__samples">{escape(sample_str)}</div>' if sample_str else ""
    )
    return (
        f'<a class="m-sector-card" href="{href}" data-band="{band}">'
        f'<div class="m-sector-card__head">'
        f'<span class="m-sector-card__name">{escape(name)}</span>'
        f'{risk_html}'
        f'</div>'
        f'<div class="m-sector-card__meta">{count} · {escape(workforce)}</div>'
        f'{samples_html}'
        f'</a>'
    )


def render(dictionary: dict, lang: Lang) -> str:
    sectors = _load_sectors()
    # Filter out _uncategorized; sort by occupation_count desc for visual interest
    sectors = [s for s in sectors if s["id"] != "_uncategorized"]
    sectors.sort(key=lambda s: -s.get("occupation_count", 0))

    title_text = t_plain(dictionary, "explore.title", lang)
    title = f"{title_text} — {t_plain(dictionary, 'brand.wordmark', lang)}"
    desc = t_plain(dictionary, "explore.title", lang)
    canonical = f"https://mirai-shigoto.com{url_for(lang, PATH)}"

    metric_chips = "".join(
        f'<button class="m-chip" data-metric="{m}" data-active="{("true" if m == "risk" else "false")}" '
        f'type="button">{t(dictionary, f"explore.metric.{m}", lang)}</button>'
        for m in ("risk", "salary", "ratio", "education")
    )

    cards = "".join(_sector_card(s, lang, dictionary) for s in sectors)

    main_inner = (
        f'<main class="m-frame__main m-explore">'
        f'<section class="m-explore__hero">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "brand.eyebrow", lang))}</span>'
        f'<h1 class="m-explore__title m-t-h1">{t(dictionary, "explore.title", lang)}</h1>'
        f'<p class="m-explore__caption">{escape(t_plain(dictionary, "explore.legend", lang))}</p>'
        f'</section>'
        f'<div class="m-explore__metrics" role="tablist">{metric_chips}</div>'
        f'<div class="m-explore__grid">{cards}</div>'
        f'<p class="m-explore__hint">{escape(t_plain(dictionary, "explore.tap_hint", lang))}</p>'
        f'<section class="m-explore__legend">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "explore.legend.label", lang))}</span>'
        f'<div class="m-explore__legend-bar" aria-hidden="true"></div>'
        f'<div class="m-explore__legend-labels">'
        f'<span>{t(dictionary, "explore.legend.low", lang)}</span>'
        f'<span>{t(dictionary, "explore.legend.high", lang)}</span>'
        f'</div>'
        f'</section>'
        f'<a class="m-explore__desktop-link" href="/">→ 全 552 職業マップ（デスクトップ版）</a>'
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

    extra_head = '<link rel="stylesheet" href="/styles/mobile-screen-explore.css">'

    return render_html_shell(
        lang=lang, title=title, description=desc,
        canonical=canonical, body_inner=body, extra_head=extra_head,
    )
