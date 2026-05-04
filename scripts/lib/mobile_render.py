"""Mobile-web HTML render helpers — per MOBILE_DESIGN.md §4 (Shared Primitives).

Stateless functions that return HTML fragments. Templates in
`scripts/templates/mobile/<screen>.py` import these and assemble
full pages.

Why hand-rolled instead of Jinja2:
    Matches the existing build_occupations.py pattern (no new deps).
    Each helper is small and explicit; easy to grep and edit.

Functions:
    render_logo()           → SVG markup for the brand glyph
    render_navbar()         → sticky header with brand + lang switch + menu button
    render_menu()           → full-viewport overlay menu (initially hidden, JS toggles)
    render_footer()         → long editorial footer with primary CTA
    render_backlink()       → inline ← back link for detail pages
    render_html_shell()     → full <html><head>...<body> wrapper with metadata
"""
from __future__ import annotations

from html import escape
from typing import Iterable, Literal

from lib.i18n import t, t_plain  # type: ignore[import-not-found]

Lang = Literal["ja", "en"]


# ───── Routing helpers ─────

# Each menu item: (key in i18n dict, URL path stem, current_screen_id)
MENU_ITEMS: list[tuple[str, str, str]] = [
    ("menu.home",     "/",          "home"),
    ("menu.map",      "/map",       "explore"),
    ("menu.search",   "/search",    "search"),
    ("menu.compare",  "/compare",   "compare"),
    ("menu.ranking",  "/ranking",   "ranking"),
    ("menu.about",    "/about",     "about"),
]


def url_for(lang: Lang, path: str) -> str:
    """Build a /m/<lang>/<path> URL. Empty `/` path becomes `/m/<lang>/`."""
    if path == "/" or path == "":
        return f"/m/{lang}/"
    return f"/m/{lang}{path}"


def alt_lang_url(current_lang: Lang, path: str) -> tuple[Lang, str]:
    """Return (other_lang, url) for the language switcher."""
    other: Lang = "en" if current_lang == "ja" else "ja"
    return other, url_for(other, path)


# ───── Brand glyph ─────

def render_logo(size: int = 28) -> str:
    """Zigzag stroke + terracotta dot — pure SVG, no asset dependency."""
    return (
        f'<span class="m-logo" aria-hidden="true">'
        f'<svg class="m-logo__svg" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">'
        f'<path d="M3 19 L8 11 L14 17 L20 8 L25 14" stroke="#48705F" stroke-width="2.5" '
        f'fill="none" stroke-linecap="round" stroke-linejoin="round" />'
        f'<circle cx="22" cy="20" r="2.6" fill="#D96B3D" />'
        f'</svg>'
        f'</span>'
    )


# ───── Navbar ─────

def render_navbar(dictionary: dict, lang: Lang, current_path: str = "/") -> str:
    """Sticky 56-px header. Includes brand link, lang switcher, hamburger button.

    `current_path` is the path stem (`/`, `/map`, `/about`...) — used to build
    the alternate-language URL so JA/EN switch lands on the same screen.
    """
    home = url_for(lang, "/")
    other_lang, alt_url = alt_lang_url(lang, current_path)
    wordmark = t_plain(dictionary, "brand.wordmark", lang)

    return (
        f'<header class="m-navbar">'
        f'<a class="m-navbar__brand" href="{home}" aria-label="{wordmark}">'
        f'{render_logo()}'
        f'<span class="m-navbar__wordmark">{escape(wordmark)}</span>'
        f'</a>'
        f'<div class="m-navbar__right">'
        f'<a class="m-navbar__lang" href="{alt_url}" hreflang="{other_lang}" '
        f'aria-label="{t_plain(dictionary, "nav.lang_switch", lang)}">'
        f'{escape(other_lang.upper())}'
        f'</a>'
        f'<button class="m-navbar__menu-btn" type="button" '
        f'data-action="open-menu" aria-label="{t_plain(dictionary, "nav.menu", lang)}">'
        f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
        f'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
        f'<line x1="4" y1="7"  x2="20" y2="7" />'
        f'<line x1="4" y1="12" x2="20" y2="12" />'
        f'<line x1="4" y1="17" x2="20" y2="17" />'
        f'</svg>'
        f'</button>'
        f'</div>'
        f'</header>'
    )


# ───── Menu (full-screen overlay) ─────

def render_menu(dictionary: dict, lang: Lang, current_screen: str = "") -> str:
    """Full-viewport overlay menu. Hidden by default (data-open="false")."""
    items_html: list[str] = []
    for key, path, screen_id in MENU_ITEMS:
        url = url_for(lang, path)
        current_attr = ' aria-current="page"' if screen_id == current_screen else ""
        items_html.append(
            f'<li class="m-menu__item">'
            f'<a class="m-menu__link" href="{url}"{current_attr}>'
            f'<span>{t(dictionary, key, lang)}</span>'
            f'<span class="m-menu__chevron" aria-hidden="true">→</span>'
            f'</a>'
            f'</li>'
        )
    return (
        f'<nav class="m-menu" id="m-menu" data-open="false" '
        f'aria-label="{t_plain(dictionary, "nav.menu", lang)}" hidden>'
        f'<div class="m-menu__top">'
        f'<a class="m-navbar__brand" href="{url_for(lang, "/")}">{render_logo()}'
        f'<span class="m-navbar__wordmark">{escape(t_plain(dictionary, "brand.wordmark", lang))}</span>'
        f'</a>'
        f'<button class="m-menu__close" type="button" data-action="close-menu" '
        f'aria-label="{t_plain(dictionary, "nav.close", lang)}">'
        f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
        f'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
        f'<line x1="6" y1="6" x2="18" y2="18" />'
        f'<line x1="18" y1="6" x2="6" y2="18" />'
        f'</svg>'
        f'</button>'
        f'</div>'
        f'<ul class="m-menu__list">'
        + "".join(items_html)
        + f'</ul>'
        f'<div class="m-menu__footer">'
        f'{escape(t_plain(dictionary, "footer.copyright", lang))}<br>'
        f'{escape(t_plain(dictionary, "footer.sources", lang))}'
        f'</div>'
        f'</nav>'
    )


# ───── Footer ─────

def render_footer(dictionary: dict, lang: Lang) -> str:
    """Long editorial footer with primary CTA → ② Map (replaces 診断 CTA per v1.1.x)."""
    map_url = url_for(lang, "/map")

    nav_links = [
        ("menu.map",      "/map"),
        ("menu.search",   "/search"),
        ("menu.compare",  "/compare"),
        ("menu.ranking",  "/ranking"),
        ("menu.about",    "/about"),
    ]
    nav_html = "".join(
        f'<a href="{url_for(lang, path)}">{t(dictionary, key, lang)} →</a>'
        for key, path in nav_links
    )

    # Legal links point to existing static pages (not part of mobile redesign)
    legal_html = (
        f'<a href="/about">{t(dictionary, "footer.legal.about", lang)}</a>'
        f'<a href="/privacy">{t(dictionary, "footer.legal.privacy", lang)}</a>'
        f'<a href="/compliance">{t(dictionary, "footer.legal.terms", lang)}</a>'
    )

    sns_html = (
        f'<a href="https://x.com/jasonhnd" rel="me noopener" aria-label="X">X</a>'
        f'<a href="https://note.com/jasonhnd" rel="me noopener" aria-label="note">note</a>'
        f'<a href="https://instagram.com/" rel="me noopener" aria-label="Instagram">IG</a>'
    )

    return (
        f'<footer class="m-footer">'
        f'<a class="m-footer__cta" href="{map_url}">{t(dictionary, "footer.cta.primary", lang)}</a>'
        f'<div class="m-footer__brand">'
        f'{render_logo()} <span class="m-navbar__wordmark">{escape(t_plain(dictionary, "brand.wordmark", lang))}</span>'
        f'<p class="m-footer__tagline">{escape(t_plain(dictionary, "brand.tagline", lang))}</p>'
        f'</div>'
        f'<div class="m-footer__nav">{nav_html}</div>'
        f'<div class="m-footer__legal">{legal_html}</div>'
        f'<div class="m-footer__sns">{sns_html}</div>'
        f'<div class="m-footer__copyright">{escape(t_plain(dictionary, "footer.copyright", lang))}</div>'
        f'<div class="m-footer__sources">{escape(t_plain(dictionary, "footer.sources", lang))}</div>'
        f'</footer>'
    )


# ───── BackLink (inline, used at top of detail pages) ─────

def render_backlink(dictionary: dict, lang: Lang, href: str) -> str:
    return (
        f'<a class="m-backlink" href="{escape(href)}">'
        f'{escape(t_plain(dictionary, "nav.back", lang))}'
        f'</a>'
    )


# ───── HTML shell ─────

FONTS_LINK = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?'
    'family=Noto+Serif+JP:wght@400;500;600;700;900&'
    'family=Plus+Jakarta+Sans:wght@400;500;600;700;800&'
    'family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">'
)

MENU_TOGGLE_JS = """
<script>
(function () {
  var menu = document.getElementById('m-menu');
  if (!menu) return;
  function setOpen(open) {
    menu.setAttribute('data-open', open ? 'true' : 'false');
    if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    var open = t.closest('[data-action="open-menu"]');
    var close = t.closest('[data-action="close-menu"]');
    if (open) { setOpen(true); e.preventDefault(); }
    if (close) { setOpen(false); e.preventDefault(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
})();
</script>
""".strip()


def render_html_shell(
    *,
    lang: Lang,
    title: str,
    description: str,
    canonical: str,
    body_inner: str,
    extra_head: str = "",
    body_class: str = "m-page",
    og_image: str = "https://mirai-shigoto.com/og.png",
) -> str:
    """Wrap a screen body in <html>/<head>/<body>.

    `body_inner` should already contain navbar + menu + main + footer.
    """
    return (
        f'<!DOCTYPE html>'
        f'<html lang="{lang}">'
        f'<head>'
        f'<meta charset="UTF-8">'
        f'<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{escape(title)}</title>'
        f'<meta name="description" content="{escape(description)}">'
        f'<link rel="canonical" href="{escape(canonical)}">'
        f'<meta property="og:title" content="{escape(title)}">'
        f'<meta property="og:description" content="{escape(description)}">'
        f'<meta property="og:image" content="{escape(og_image)}">'
        f'<meta property="og:type" content="website">'
        f'<meta name="twitter:card" content="summary_large_image">'
        f'<link rel="stylesheet" href="/styles/mobile-tokens.css">'
        f'<link rel="stylesheet" href="/styles/mobile-components.css">'
        f'{FONTS_LINK}'
        f'{extra_head}'
        f'</head>'
        f'<body class="{body_class}">'
        f'{body_inner}'
        f'{MENU_TOGGLE_JS}'
        f'</body>'
        f'</html>'
    )
