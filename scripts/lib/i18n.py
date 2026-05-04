"""i18n loader for mobile-web — per MOBILE_DESIGN.md §9.2.

Loads scripts/i18n/mobile_strings.json once and exposes a lightweight
lookup interface for templates:

    from lib.i18n import load, t, has

    dictionary = load()                              # one-time
    t(dictionary, "home.hero.title.line1", "ja")     # → "AIの時代でも、"
    t(dictionary, "home.hero.title.line2", "en", italic=True)  # → "<em>your kind of</em>"

Design choices:
    - Pure functional; no global state. Caller passes the loaded dict.
    - Missing keys return "[[MISSING:key]]" sentinel — visible in dev so we
      catch holes during build, but doesn't crash the page.
    - Per-string `italic` / `color` flags on dict entries are honored; the
      `t()` helper wraps in <em> + spans so templates don't have to repeat.
    - String interpolation: pass kwargs to `t()` and they fill `{name}` in the
      string. Used for "{n} 件" / "{n} results" style.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

Lang = Literal["ja", "en"]
LANGS: tuple[Lang, ...] = ("ja", "en")

DICT_PATH = Path(__file__).resolve().parent.parent / "i18n" / "mobile_strings.json"
MISSING_PREFIX = "[[MISSING:"


def load(path: Path | None = None) -> dict[str, dict[str, Any]]:
    """Load + return the i18n dictionary (drops $meta). Idempotent."""
    target = path or DICT_PATH
    raw = json.loads(target.read_text(encoding="utf-8"))
    return {k: v for k, v in raw.items() if not k.startswith("$")}


def has(dictionary: dict, key: str, lang: Lang = "ja") -> bool:
    """True iff the key exists with a non-empty string for the requested lang."""
    entry = dictionary.get(key)
    if not entry:
        return False
    val = entry.get(lang)
    return isinstance(val, str) and bool(val)


def t(dictionary: dict, key: str, lang: Lang = "ja", **fmt: Any) -> str:
    """Translate a key to the given language.

    Returns the raw string with optional `{name}` interpolation.
    Honors per-entry `italic` / `color` flags by wrapping the string in
    `<em>` and a tinted span. If the entry has no flags, returns the bare
    string.
    """
    entry = dictionary.get(key)
    if not entry:
        return f"{MISSING_PREFIX}{key}]]"

    raw = entry.get(lang)
    if not raw:
        # Fall back to JA if EN is missing (or vice versa) — better than blank
        raw = entry.get("ja" if lang == "en" else "en") or ""
        if not raw:
            return f"{MISSING_PREFIX}{key}]]"

    if fmt:
        try:
            raw = raw.format(**fmt)
        except (KeyError, IndexError):
            # Don't crash the build on a typo; just leave the placeholder.
            pass

    italic = entry.get("italic", False)
    color = entry.get("color")  # one of: 'accent', 'sage', None

    out = raw
    if italic:
        out = f"<em>{out}</em>"
    if color == "accent":
        out = f'<span class="m-color-accent">{out}</span>'
    elif color == "sage":
        out = f'<span class="m-color-sage-deep">{out}</span>'
    return out


def t_plain(dictionary: dict, key: str, lang: Lang = "ja", **fmt: Any) -> str:
    """Like `t()` but never wraps in HTML tags. Use when you need the raw
    string for attributes (alt, title, aria-label, og:title, etc.).
    """
    entry = dictionary.get(key)
    if not entry:
        return f"{MISSING_PREFIX}{key}]]"
    raw = entry.get(lang) or entry.get("ja" if lang == "en" else "en") or ""
    if not raw:
        return f"{MISSING_PREFIX}{key}]]"
    if fmt:
        try:
            raw = raw.format(**fmt)
        except (KeyError, IndexError):
            pass
    return raw


def audit_completeness(dictionary: dict) -> dict[str, list[str]]:
    """Return {lang: [missing_keys, ...]} for build-time gap detection.

    Empty lists mean every key has a translation in that language.
    """
    out: dict[str, list[str]] = {lang: [] for lang in LANGS}
    for key, entry in dictionary.items():
        for lang in LANGS:
            val = entry.get(lang)
            if not isinstance(val, str) or not val:
                out[lang].append(key)
    return out
