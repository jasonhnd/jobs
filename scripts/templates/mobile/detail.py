"""④/⑤ 職業詳細 — `/m/{ja,en}/<id>`. DEAD CODE since v1.2.0.

DEAD CODE: v1.1.0 mobile-web template for the retired `/m/*` URL
architecture. Replaced by single-URL responsive design in v1.2.0; no
`/m/` directory has been built or shipped since. Spec doc
`docs/MOBILE_DESIGN.md` deleted 2026-05-06 (current mobile spec lives
in `docs/Design-Mobile.md`, but covers the responsive design, not this
`/m/*` template). Entire `scripts/templates/mobile/` directory is safe
to delete in a follow-up cleanup. Note: `scripts/build_occupations.py`
copied an algorithm from this file in v1.2.0 convergence (see comment at
that file's line ~258); the copy is independent and won't break.


Per-occupation page generated for each id × language. Loaded statically
(not as an island) — all data inlined at build time. Rendered by
`scripts/build_mobile_detail.py` which iterates all 556 occupations.

Sections (after navbar + back link):
    1. Hero header — sector tag, name, EN subtitle
    2. AIスコア dial — gauge 0-10
    3. 「人にしかできない仕事」要素 — pull-quote (per-sector hardcoded)
    4. 5次元プロファイル — radar SVG (data from data.profile5.json)
    5. 数字で見る — 3 stat blocks (年収 / 求人倍率 / 平均年齢)
    6. 関連職業 — 3-up grid from data.transfer_paths.json
    7. CTA "比較に追加 →" — adds to localStorage, links to /m/{lang}/compare?b=<id>

Long-form description: rendered if `*_en` translation exists. Otherwise
shows i18n key `detail.long_text.ja_only` placeholder.
"""
from __future__ import annotations

from html import escape

from lib.bands import risk_band  # type: ignore[import-not-found]
from lib.i18n import t, t_plain  # type: ignore[import-not-found]
from lib.mobile_render import (  # type: ignore[import-not-found]
    Lang,
    render_backlink,
    render_footer,
    render_html_shell,
    render_menu,
    render_navbar,
    url_for,
)


# Hardcoded "人にしかできない仕事" sentence per sector (v1.1.x — DEAD CODE since v1.2.0; spec doc MOBILE_DESIGN.md deleted 2026-05-06).
QUOTE_BY_SECTOR_JA: dict[str, str] = {
    "iryo":     "観察と判断、患者との信頼関係 — 人の手と心が、医療の核心。",
    "fukushi":  "尊厳に寄り添う仕事は、効率化されないからこそ価値がある。",
    "kyoiku":   "教えるとは、伝わるまで待つこと。AI には教えにくい時間の使い方。",
    "hoan":     "現場での即時判断と勇気。マニュアル化しきれない領域。",
    "noringyo": "土地・気候・生命との対話。デジタル化されない経験知。",
    "senmon":   "新しい問いを立てる力。AI は答えを出すが、問いは人が立てる。",
    "it":       "AI 時代に AI を作る側に立てる人材。リスクと裏返しの強みでもある。",
    "shigyo":   "不確実性下での意思決定と責任。AI が補助はするが代行はできない。",
    "creative": "オリジナリティと文化的文脈。模倣は AI が、創造は人が。",
    "jimu":     "標準化された業務ほど自動化が進む。役割の再定義が鍵。",
    "hanbai":   "対面の信頼と、提案の機微。リアル接客の価値が再評価される。",
    "service":  "もてなしと体験設計。人が人にしかできない、最も古くて新しい仕事。",
    "seizo":    "手の感覚と微調整。AI ではなく職人の手で完成する領域は今も多い。",
    "maint":    "現場での点検・修理は身体性が鍵。完全自動化までは時間がかかる。",
    "kensetu":  "現場の不確実性に対応する身体能力と判断。最も自動化が遅い分野。",
    "keiseki":  "身体的な現場仕事。完全自動化までは時間がかかるが、給与上昇は限定的。",
}

QUOTE_BY_SECTOR_EN: dict[str, str] = {
    "iryo":     "Observation, judgment, and trust with patients — the human hand and heart remain medicine's core.",
    "fukushi":  "Work centered on dignity gains value precisely because it resists efficiency.",
    "kyoiku":   "Teaching means waiting until understanding arrives — a use of time AI cannot easily mimic.",
    "hoan":     "On-the-ground judgment and courage. A domain that resists complete codification.",
    "noringyo": "Dialogue with land, climate, and living things — embodied knowledge that does not digitize.",
    "senmon":   "The power to formulate new questions. AI answers; humans ask.",
    "it":       "The people who build AI for the AI era — strength and risk in the same hand.",
    "shigyo":   "Decision-making and accountability under uncertainty. AI assists; it cannot stand in.",
    "creative": "Originality and cultural context. AI imitates; humans create.",
    "jimu":     "Standardized work automates fastest. The key is role re-definition.",
    "hanbai":   "Face-to-face trust and the nuance of proposal. Real-world sales is being re-valued.",
    "service":  "Hospitality and experience design. The oldest and newest of human-only work.",
    "seizo":    "Manual feel and fine adjustment. Many domains still complete by craftspeople, not AI.",
    "maint":    "On-site inspection and repair require embodied skill. Full automation remains distant.",
    "kensetu":  "Body and judgment responding to site uncertainty. The slowest sector to automate.",
    "keiseki":  "Physical on-site work. Slow to fully automate, but wage growth is limited.",
}


def _hero(detail: dict, lang: Lang, dictionary: dict) -> str:
    title = detail["title"]
    name = title["en"] if lang == "en" and title.get("en") else title["ja"]
    en_subtitle = title.get("en") if lang == "ja" and title.get("en") else None
    sector = detail.get("sector") or {}
    sector_name = (sector.get("en") if lang == "en" else sector.get("ja")) or ""
    sector_band = sector.get("hue") or "mid"
    band_class = {"safe": "m-risk-low", "mid": "m-risk-mid", "warm": "m-risk-high", "risk": "m-risk-high"}.get(sector_band, "m-risk-mid")

    return (
        f'<section class="m-detail__hero">'
        f'<div class="m-detail__sector {band_class}">{escape(sector_name)}</div>'
        f'<h1 class="m-detail__title">{escape(name)}</h1>'
        + (f'<p class="m-detail__subtitle">{escape(en_subtitle)}</p>' if en_subtitle else "")
        + f'</section>'
    )


def _ai_score(detail: dict, lang: Lang, dictionary: dict) -> str:
    ai = detail.get("ai_risk")
    if not ai:
        return ""
    score = ai["score"]
    band = risk_band(score)
    rationale = ai.get("rationale_en") if lang == "en" else ai.get("rationale_ja")
    return (
        f'<section class="m-detail__score">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "detail.section.score", lang))}</span>'
        f'<div class="m-detail__dial m-risk-{band}">'
        f'<span class="m-detail__dial-num">{score}</span>'
        f'<span class="m-detail__dial-sub">{escape(t_plain(dictionary, "common.unit.score", lang))}</span>'
        f'</div>'
        + (f'<p class="m-detail__rationale">{escape(rationale)}</p>' if rationale else "")
        + f'</section>'
    )


def _quote(detail: dict, lang: Lang, dictionary: dict) -> str:
    sector = detail.get("sector") or {}
    sid = sector.get("id") or ""
    quote_map = QUOTE_BY_SECTOR_EN if lang == "en" else QUOTE_BY_SECTOR_JA
    quote = quote_map.get(sid)
    if not quote:
        return ""
    return (
        f'<section class="m-detail__quote">'
        f'<span class="m-mono-tag">"　"　{escape(t_plain(dictionary, "detail.section.quote", lang))}</span>'
        f'<blockquote>{escape(quote)}</blockquote>'
        f'</section>'
    )


def _profile_radar(profile: dict | None, lang: Lang, dictionary: dict) -> str:
    if not profile:
        return ""
    axes = ["creative", "social", "judgment", "physical", "routine"]
    values = [profile.get(a) or 0 for a in axes]
    labels = [t_plain(dictionary, f"detail.profile.{a}", lang) for a in axes]

    # 5-axis radar SVG, 240×240 viewBox, polygon points
    cx, cy, r = 120, 120, 90
    import math
    pts = []
    label_pts = []
    for i, v in enumerate(values):
        ang = math.radians(-90 + i * 72)
        scale = (v or 0) / 100
        x = cx + math.cos(ang) * r * scale
        y = cy + math.sin(ang) * r * scale
        pts.append(f"{x:.1f},{y:.1f}")
        lx = cx + math.cos(ang) * (r + 18)
        ly = cy + math.sin(ang) * (r + 18)
        label_pts.append((lx, ly, labels[i]))

    grid_layers = ""
    for level in (0.25, 0.5, 0.75, 1.0):
        layer_pts = []
        for i in range(5):
            ang = math.radians(-90 + i * 72)
            x = cx + math.cos(ang) * r * level
            y = cy + math.sin(ang) * r * level
            layer_pts.append(f"{x:.1f},{y:.1f}")
        grid_layers += f'<polygon points="{" ".join(layer_pts)}" fill="none" stroke="rgba(36,30,24,0.08)" stroke-width="1"/>'

    label_html = "".join(
        f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
        f'dominant-baseline="middle" font-size="11" font-family="JetBrains Mono, monospace" '
        f'fill="#7A6F5E" letter-spacing="0.06em">{escape(lab)}</text>'
        for lx, ly, lab in label_pts
    )

    return (
        f'<section class="m-detail__profile">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "detail.section.profile", lang))}</span>'
        f'<svg class="m-detail__radar" viewBox="0 0 240 240" role="img" aria-label="5-axis profile">'
        f'{grid_layers}'
        f'<polygon points="{" ".join(pts)}" '
        f'fill="rgba(110,155,137,0.20)" stroke="#48705F" stroke-width="2" />'
        f'{label_html}'
        f'</svg>'
        f'</section>'
    )


def _stats(detail: dict, lang: Lang, dictionary: dict) -> str:
    stats = detail.get("stats") or {}
    salary = stats.get("salary_man_yen")
    ratio = stats.get("recruit_ratio")
    age = stats.get("average_age")

    salary_str = (
        (f"¥{salary:.0f}万" if lang == "ja" else f"¥{salary / 100:.2f}M")
        if salary is not None else "–"
    )
    ratio_str = f"{ratio:.2f}" if ratio is not None else "–"
    age_str = f"{age:.1f}{t_plain(dictionary, 'common.unit.age', lang)}" if age is not None else "–"

    return (
        f'<section class="m-detail__stats">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "detail.section.stats", lang))}</span>'
        f'<div class="m-detail__stat-grid">'
        f'<div class="m-detail__stat"><span class="m-detail__stat-num">{escape(salary_str)}</span>'
        f'<span class="m-detail__stat-label">{escape(t_plain(dictionary, "detail.stat.salary", lang))}</span></div>'
        f'<div class="m-detail__stat"><span class="m-detail__stat-num">{escape(ratio_str)}</span>'
        f'<span class="m-detail__stat-label">{escape(t_plain(dictionary, "detail.stat.ratio", lang))}</span></div>'
        f'<div class="m-detail__stat"><span class="m-detail__stat-num">{escape(age_str)}</span>'
        f'<span class="m-detail__stat-label">{escape(t_plain(dictionary, "detail.stat.age", lang))}</span></div>'
        f'</div>'
        f'</section>'
    )


def _related(transfer: dict | None, lang: Lang, dictionary: dict) -> str:
    if not transfer:
        return ""
    candidates = transfer.get("candidates", [])[:3]
    if not candidates:
        return ""
    cards = ""
    for c in candidates:
        url = url_for(lang, f"/{c['id']}")
        name = c.get("title_ja") or "?"  # title_en not in transfer_paths data; fall back to JA
        risk = c.get("ai_risk")
        band = risk_band(risk) if risk is not None else "mid"
        cards += (
            f'<a class="m-detail__related-card" href="{url}">'
            f'<span class="m-detail__related-name">{escape(name)}</span>'
            f'<span class="m-detail__related-score m-risk-{band}">{risk}</span>'
            f'</a>'
        )
    return (
        f'<section class="m-detail__related">'
        f'<span class="m-mono-tag">{escape(t_plain(dictionary, "detail.section.related", lang))}</span>'
        f'<div class="m-detail__related-grid">{cards}</div>'
        f'</section>'
    )


def _description(detail: dict, lang: Lang, dictionary: dict) -> str:
    desc = detail.get("description") or {}
    blocks = []
    fields = (
        ("what_it_is_ja",         "what_it_is_en"),
        ("how_to_become_ja",      "how_to_become_en"),
        ("working_conditions_ja", "working_conditions_en"),
    )
    for ja_key, en_key in fields:
        val = desc.get(en_key) if lang == "en" else desc.get(ja_key)
        if not val:
            if lang == "en" and desc.get(ja_key):
                # Fallback notice
                blocks.append(
                    f'<p class="m-detail__ja-only">'
                    f'{escape(t_plain(dictionary, "detail.long_text.ja_only", lang))}</p>'
                )
            continue
        # Replace IDeographic newlines + double newlines with paragraphs
        paragraphs = [p.strip() for p in val.replace("　\n", "\n").split("\n") if p.strip()]
        for p in paragraphs:
            blocks.append(f'<p>{escape(p)}</p>')
        # only emit "ja-only" notice once
    if not blocks:
        return ""
    return f'<section class="m-detail__desc">{"".join(blocks)}</section>'


def _cta(detail: dict, lang: Lang, dictionary: dict) -> str:
    occ_id = detail["id"]
    return (
        f'<a class="m-detail__cta" data-action="add-compare" data-id="{occ_id}" '
        f'href="{url_for(lang, "/compare")}?a={occ_id}">'
        f'{t(dictionary, "detail.cta.add_compare", lang)}'
        f'</a>'
    )


def render(dictionary: dict, lang: Lang, detail: dict, profile: dict | None,
           transfer: dict | None) -> str:
    """Build a full mobile detail HTML for one occupation × one language."""
    occ_id = detail["id"]
    title_text = detail["title"]["en"] if lang == "en" and detail["title"].get("en") else detail["title"]["ja"]
    title = f"{title_text} — {t_plain(dictionary, 'brand.wordmark', lang)}"
    desc_summary_field = "summary_en" if lang == "en" else "summary_ja"
    desc_summary = (detail.get("description") or {}).get(desc_summary_field) or title_text
    canonical = f"https://mirai-shigoto.com/{lang}/{occ_id}"  # canonical → desktop

    desktop_link = (
        f'<a class="m-desktop-link" href="/{lang}/{occ_id}">'
        f'{t(dictionary, "nav.desktop_link", lang)}'
        f'</a>'
    )

    main_inner = (
        f'<main class="m-frame__main m-detail">'
        + render_backlink(dictionary, lang, url_for(lang, "/map"))
        + _hero(detail, lang, dictionary)
        + _ai_score(detail, lang, dictionary)
        + _quote(detail, lang, dictionary)
        + _profile_radar(profile, lang, dictionary)
        + _stats(detail, lang, dictionary)
        + _description(detail, lang, dictionary)
        + _related(transfer, lang, dictionary)
        + _cta(detail, lang, dictionary)
        + f'</main>'
    )

    body = (
        f'<div class="m-frame">'
        + desktop_link
        + render_navbar(dictionary, lang, current_path=f"/{occ_id}")
        + render_menu(dictionary, lang, current_screen="")
        + main_inner
        + render_footer(dictionary, lang)
        + f'</div>'
    )

    extra_head = '<link rel="stylesheet" href="/styles/mobile-screen-detail.css">'

    return render_html_shell(
        lang=lang, title=title, description=desc_summary,
        canonical=canonical, body_inner=body, extra_head=extra_head,
    )
