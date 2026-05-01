#!/usr/bin/env python3
"""
build_occupations.py — generate 1104 static per-occupation pages.

  ja/<id>.html (552 JA-only pages)  +  en/<id>.html (552 EN-only pages)

Each page is single-language (no in-page toggle). JA and EN pages are linked
via canonical + hreflang and a visible top-right language switch. Each page
includes a "Related occupations" block (5 entries) for SEO link equity and
reader navigation: 3 same-risk-band peers + 2 ID-neighbors.

URLs are pure-numeric — /ja/<id> and /en/<id>. The previous slug-based URLs
(/occ/<id>-<slug>) are 301-redirected to /ja/<id> via vercel.json.

Output:
  ja/<id>.html              e.g. ja/428.html
  en/<id>.html              e.g. en/428.html
  scripts/.occ_manifest.json  (id, ja_url, en_url, ai_risk, ...)
  sitemap.xml                rewritten with 1104 occ URLs + 4 site URLs

Usage:
  python3 scripts/build_occupations.py                    # all 552 (×2 langs)
  python3 scripts/build_occupations.py --limit 3
  python3 scripts/build_occupations.py --ids 428,33,1
"""
from __future__ import annotations
import argparse
import json
import re
from html import escape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA_PATH = REPO / "data.json"
OUT_DIR_JA = REPO / "ja"
OUT_DIR_EN = REPO / "en"
MANIFEST_PATH = REPO / "scripts" / ".occ_manifest.json"
SITEMAP_PATH = REPO / "sitemap.xml"
DATE_PUBLISHED = "2026-04-25"
DATE_MODIFIED = "2026-04-30"
RELATED_COUNT = 5


def fmt_int(n) -> str:
    if n is None:
        return "—"
    return f"{int(n):,}"


def ja_url(id_: int) -> str:
    return f"https://mirai-shigoto.com/ja/{id_}"


def en_url(id_: int) -> str:
    return f"https://mirai-shigoto.com/en/{id_}"


def pick_related(rec: dict, all_records: list[dict], count: int = RELATED_COUNT) -> list[dict]:
    """Pick {count} related occupations.

    Strategy: prefer same risk band (±1), then fill with ID-neighbors so every
    page links to a deterministic, content-relevant set. Ordering is stable
    (no randomness) so identical input → identical output.
    """
    rid = rec["id"]
    risk = rec.get("ai_risk")

    chosen: list[dict] = []
    chosen_ids: set[int] = set()

    if risk is not None:
        same_band = [
            r
            for r in all_records
            if r["id"] != rid
            and r.get("ai_risk") is not None
            and abs(r["ai_risk"] - risk) <= 1
        ]
        same_band.sort(key=lambda r: (abs(r["ai_risk"] - risk), abs(r["id"] - rid), r["id"]))
        for r in same_band:
            if len(chosen) >= 3:
                break
            chosen.append(r)
            chosen_ids.add(r["id"])

    neighbors = sorted(
        [r for r in all_records if r["id"] != rid and r["id"] not in chosen_ids],
        key=lambda r: (abs(r["id"] - rid), r["id"]),
    )
    for r in neighbors:
        if len(chosen) >= count:
            break
        chosen.append(r)
        chosen_ids.add(r["id"])

    return chosen[:count]


def render_jsonld(rec: dict, lang: str) -> str:
    """Render Schema.org JSON-LD for one language version of an occupation page."""
    id_ = rec["id"]
    name_ja = rec.get("name_ja") or ""
    name_en = rec.get("name_en") or ""
    risk = rec.get("ai_risk")
    rationale_en = rec.get("ai_rationale_en") or ""
    rationale_ja = rec.get("ai_rationale_ja") or ""
    desc_en = rec.get("desc_en") or ""
    desc_ja = rec.get("desc_ja") or ""
    salary_man = rec.get("salary") or 0
    workers = rec.get("workers") or 0
    age = rec.get("age") or 0
    hours = rec.get("hours") or 0
    recruit = rec.get("recruit_ratio")
    hourly = rec.get("hourly_wage") or 0
    mhlw_url = rec.get("url") or f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{id_}"

    canonical = ja_url(id_) if lang == "ja" else en_url(id_)

    if lang == "ja":
        page_name = (
            f"{name_ja}（{name_en}） — AI 影響 {risk}/10"
            if (name_en and risk is not None)
            else f"{name_ja} — mirai-shigoto.com"
        )
        page_desc = rationale_ja or desc_ja or rationale_en or desc_en or name_ja
        breadcrumb_root = "日本の職業 AI 影響マップ"
        breadcrumb_self = f"{name_ja}" + (f" / {name_en}" if name_en else "")
        home_url = "https://mirai-shigoto.com/"
    else:
        page_name = (
            f"{name_en} ({name_ja}) — AI Impact {risk}/10"
            if (name_en and risk is not None)
            else f"{name_en or name_ja} — mirai-shigoto.com"
        )
        page_desc = rationale_en or desc_en or rationale_ja or desc_ja or name_en or name_ja
        breadcrumb_root = "Japan Jobs × AI Impact Map"
        breadcrumb_self = f"{name_en} / {name_ja}" if name_en else name_ja
        home_url = "https://mirai-shigoto.com/?lang=en"

    additional = []
    if risk is not None:
        additional.append(
            {
                "@type": "PropertyValue",
                "name": "AI risk score (0-10)",
                "value": risk,
                "description": "Independent LLM estimate by Claude Opus 4.7. Reflects task-level exposure, not probability of job loss.",
            }
        )
    if workers:
        additional.append({"@type": "PropertyValue", "name": "Workforce size", "value": workers, "unitText": "persons"})
    if age:
        additional.append({"@type": "PropertyValue", "name": "Average age", "value": age, "unitText": "years"})
    if hours:
        additional.append({"@type": "PropertyValue", "name": "Monthly working hours", "value": hours, "unitText": "hours"})
    if recruit is not None:
        additional.append({"@type": "PropertyValue", "name": "Effective recruit ratio", "value": recruit})
    if hourly:
        additional.append({"@type": "PropertyValue", "name": "Hourly wage", "value": hourly, "unitText": "JPY/hour"})

    occupation_node = {
        "@type": "Occupation",
        "@id": f"{canonical}#occupation",
        "name": name_ja,
        "description": rationale_en or desc_en or rationale_ja or desc_ja or name_ja,
        "occupationLocation": {"@type": "Country", "name": "Japan"},
        "occupationalCategory": str(id_),
        "sameAs": mhlw_url,
        "additionalProperty": additional,
        "isPartOf": {"@id": "https://mirai-shigoto.com/#dataset"},
    }
    if name_en:
        occupation_node["alternateName"] = name_en
    if salary_man:
        occupation_node["estimatedSalary"] = {
            "@type": "MonetaryAmountDistribution",
            "name": "Annual salary (estimated mean from MHLW jobtag)",
            "currency": "JPY",
            "duration": "P1Y",
            "median": int(salary_man * 10000),
        }

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": f"{canonical}#webpage",
                "url": canonical,
                "name": page_name,
                "description": page_desc,
                "isPartOf": {"@id": "https://mirai-shigoto.com/#website"},
                "about": {"@id": f"{canonical}#occupation"},
                "mainEntity": {"@id": f"{canonical}#occupation"},
                "primaryImageOfPage": "https://mirai-shigoto.com/og.png",
                "inLanguage": lang,
                "breadcrumb": {"@id": f"{canonical}#breadcrumb"},
                "datePublished": DATE_PUBLISHED,
                "dateModified": DATE_MODIFIED,
                "publisher": {"@id": "https://mirai-shigoto.com/#organization"},
                "author": {"@id": "https://mirai-shigoto.com/#organization"},
            },
            occupation_node,
            {
                "@type": "BreadcrumbList",
                "@id": f"{canonical}#breadcrumb",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": breadcrumb_root, "item": home_url},
                    {"@type": "ListItem", "position": 2, "name": breadcrumb_self, "item": canonical},
                ],
            },
        ],
    }
    return json.dumps(graph, ensure_ascii=False, indent=2)


CSS_BLOCK = """
      *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
      :root{--bg:#0b0d10;--bg2:#14171c;--fg:#e9eef5;--fg2:#8a93a3;--accent:#ffb84d;--border:rgba(255,255,255,0.08)}
      html,body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic UI","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6}
      a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
      .skip-link{position:absolute;left:-9999px}.skip-link:focus{position:static;background:var(--accent);color:#000;padding:8px}
      .top-banner{background:var(--bg2);border-bottom:1px solid var(--border);padding:8px 16px;font-size:0.78rem;color:var(--fg2);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .top-banner .badge{background:#ff8a3d;color:#000;font-weight:700;padding:2px 8px;border-radius:4px;font-size:0.7rem;letter-spacing:0.04em}
      #wrapper{max-width:780px;margin:0 auto;padding:24px 24px 80px}
      nav.crumb{font-size:0.85rem;color:var(--fg2);margin-bottom:18px}
      nav.crumb a{color:var(--fg2)}nav.crumb a:hover{color:var(--accent)}
      h1{font-size:clamp(1.4rem,1rem+1.6vw,2rem);font-weight:700;letter-spacing:-0.01em;margin-bottom:6px}
      h1 .accent{color:var(--accent)}
      h1 .h1-sub{font-size:0.7em;color:var(--fg2);font-weight:500;margin-left:8px}
      .lang-switch{display:inline-block;font-size:0.78rem;margin-left:8px;vertical-align:middle}
      .lang-switch a{border:1px solid var(--border);color:var(--fg2);padding:3px 9px;border-radius:999px}
      .lang-switch a:hover{border-color:var(--accent);color:var(--accent);text-decoration:none}
      .risk-card{display:flex;align-items:center;gap:18px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 22px;margin:18px 0 22px}
      .risk-num{font-size:clamp(2.4rem,1.8rem+2vw,3.4rem);font-weight:800;line-height:1;letter-spacing:-0.02em}
      .risk-num small{font-size:0.4em;color:var(--fg2);font-weight:500;margin-left:4px}
      .risk-label{font-size:0.85rem;color:var(--fg2);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em}
      .risk-rationale{flex:1;font-size:0.95rem;color:var(--fg)}
      .risk-0,.risk-1,.risk-2{color:#7ddc7d}.risk-3,.risk-4{color:#a8d572}
      .risk-5,.risk-6{color:#ffd84d}.risk-7,.risk-8{color:#ff8a3d}.risk-9,.risk-10{color:#ff5050}
      dl.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 18px;margin:20px 0;padding:16px 18px;background:var(--bg2);border:1px solid var(--border);border-radius:10px}
      dl.stats dt{font-size:0.72rem;color:var(--fg2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px}
      dl.stats dd{font-size:1.05rem;font-weight:600}
      section.context,section.sources,section.related{margin-top:28px}
      section h2{font-size:1.05rem;margin-bottom:10px;color:var(--accent)}
      section p{color:var(--fg);margin-bottom:8px}
      section ul{list-style:none;padding:0}section li{margin-bottom:6px;font-size:0.92rem}
      section.related ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 12px}
      section.related li{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;align-items:baseline;margin:0}
      section.related li:hover{border-color:var(--accent)}
      section.related .r-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      section.related .r-risk{font-size:0.78rem;color:var(--fg2);font-variant-numeric:tabular-nums}
      .disclaimer{margin-top:32px;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--fg2);font-size:0.82rem;line-height:1.6}
      .disclaimer strong{color:#ff8a3d}
      footer{margin-top:48px;padding:18px 0;border-top:1px solid var(--border);font-size:0.78rem;color:var(--fg2);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
      @media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#fafafa;--bg2:#ffffff;--fg:#0f1217;--fg2:#5a6470;--accent:#d97706;--border:rgba(0,0,0,0.10)}}
      :root[data-theme="light"]{--bg:#fafafa;--bg2:#ffffff;--fg:#0f1217;--fg2:#5a6470;--accent:#d97706;--border:rgba(0,0,0,0.10)}
      :root[data-theme="dark"]{--bg:#0b0d10;--bg2:#14171c;--fg:#e9eef5;--fg2:#8a93a3;--accent:#ffb84d;--border:rgba(255,255,255,0.08)}
      @media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .risk-card,:root:not([data-theme="dark"]) dl.stats,:root:not([data-theme="dark"]) section.related li,:root:not([data-theme="dark"]) .disclaimer{box-shadow:0 1px 3px rgba(0,0,0,0.05)}}
      :root[data-theme="light"] .risk-card,:root[data-theme="light"] dl.stats,:root[data-theme="light"] section.related li,:root[data-theme="light"] .disclaimer{box-shadow:0 1px 3px rgba(0,0,0,0.05)}
      .theme-toggle{background:transparent;border:1px solid var(--border);color:var(--fg2);width:28px;height:28px;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;margin-left:6px;font-family:inherit;transition:color 150ms,border-color 150ms;vertical-align:middle}
      .theme-toggle:hover{color:var(--accent);border-color:var(--accent)}
      .theme-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .theme-toggle svg{width:13px;height:13px;fill:currentColor}
      .theme-toggle .icon-sun{display:inline-block}
      .theme-toggle .icon-moon{display:none}
      @media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .theme-toggle .icon-sun{display:none}:root:not([data-theme="dark"]) .theme-toggle .icon-moon{display:inline-block}}
      :root[data-theme="light"] .theme-toggle .icon-sun{display:none}
      :root[data-theme="light"] .theme-toggle .icon-moon{display:inline-block}
      :root[data-theme="dark"] .theme-toggle .icon-sun{display:inline-block}
      :root[data-theme="dark"] .theme-toggle .icon-moon{display:none}
"""


ANALYTICS_BLOCK = """    <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "b1588779b90341ea9d87d93769b348dc"}'></script>

    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-GLDNBDPF13');
      window.addEventListener('load', function () {
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=G-GLDNBDPF13';
        document.head.appendChild(s);
      });
    </script>

    <script defer src="/_vercel/insights/script.js"></script>
    <script defer src="/_vercel/speed-insights/script.js"></script>"""


def render_html(rec: dict, lang: str, related: list[dict]) -> str:
    """Render the full HTML for one occupation page in the given language.

    lang: 'ja' or 'en'
    related: list of related occupation records (RELATED_COUNT entries)
    """
    id_ = rec["id"]
    canonical = ja_url(id_) if lang == "ja" else en_url(id_)

    name_ja = rec.get("name_ja") or ""
    name_en = rec.get("name_en") or ""
    risk = rec.get("ai_risk")
    risk_str = f"{risk}/10" if risk is not None else "—"
    rationale_ja = rec.get("ai_rationale_ja") or ""
    rationale_en = rec.get("ai_rationale_en") or ""
    desc_ja = (rec.get("desc_ja") or "")[:240]
    desc_en = (rec.get("desc_en") or "")[:200]

    salary_man = rec.get("salary") or 0
    workers = rec.get("workers") or 0
    age = rec.get("age") or 0
    hours = rec.get("hours") or 0
    recruit = rec.get("recruit_ratio")
    hourly = rec.get("hourly_wage") or 0
    mhlw_url = rec.get("url") or f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{id_}"

    risk_class = f"risk-{risk}" if risk is not None else "risk-na"
    jsonld = render_jsonld(rec, lang)

    if lang == "ja":
        title = (
            f"{name_ja}（{name_en}） — AI 影響 {risk_str}｜mirai-shigoto.com"
            if name_en
            else f"{name_ja} — AI 影響 {risk_str}｜mirai-shigoto.com"
        )
        seo_desc = (
            (
                f"{name_ja}（{name_en}）：就業者 約{fmt_int(workers)}人 / 平均年収 {int(salary_man)}万円 "
                f"/ 平均年齢 {age} / AI 影響 {risk_str}。Claude Opus 4.7 による独自スコア（非公式）。"
            )
            if name_en
            else (
                f"{name_ja}：就業者 約{fmt_int(workers)}人 / 平均年収 {int(salary_man)}万円 "
                f"/ 平均年齢 {age} / AI 影響 {risk_str}。Claude Opus 4.7 による独自スコア（非公式）。"
            )
        )
        og_locale = "ja_JP"
        og_locale_alt = "en_US"
        site_name = "日本の職業 AI 影響マップ（非公式）"
        home_href = "/"
        crumb_root = "日本の職業 AI 影響マップ"
        crumb_self_label = f"{name_ja} / {name_en}" if name_en else name_ja
        h1_main = name_ja
        h1_sub = name_en
        risk_label = "AI 影響"
        rationale = rationale_ja or desc_ja
        st_workers = "就業者数"
        st_workers_unit = " 人"
        st_salary = "年収（平均）"
        st_age = "平均年齢"
        st_age_unit = " 歳"
        st_hours = "月労働時間"
        st_hours_unit = " 時間/月"
        st_recruit = "求人倍率"
        st_hourly = "時給"
        ctx_h2 = "この職業について"
        ctx_p = desc_ja or rationale_ja
        src_h2 = "出典 / 関連リンク"
        src_mhlw_label = f"厚生労働省 job tag — {name_ja}（公式）"
        src_method_label = "方法論 / スコアリングルーブリック"
        src_back_label = "552 職種マップに戻る"
        rel_h2 = "類似する職業"
        rel_path = "/ja/"
        banner_html = "独自分析・<strong>厚労省 / job tag / JILPT の公式見解ではありません</strong>"
        skip_label = "本文へ"
        disclaim = "AI 影響スコアは Claude Opus 4.7 による独自推定（非公式）。MHLW / jobtag / JILPT の公式見解ではありません。個別の職業選択の唯一の根拠としては使わないでください。"
        lang_switch_label = "English"
        lang_switch_target_lang = "en"
        salary_cell = (
            f'{("¥" + fmt_int(int(salary_man * 10000))) if salary_man else "—"}（{int(salary_man) if salary_man else "—"} 万円）'
        )
    else:
        title = (
            f"{name_en} ({name_ja}) — AI Impact {risk_str}｜mirai-shigoto.com"
            if name_en
            else f"{name_ja} — AI Impact {risk_str}｜mirai-shigoto.com"
        )
        seo_desc = (
            (
                f"{name_en} ({name_ja}): workforce ~{fmt_int(workers)} / annual salary {int(salary_man)}万円 "
                f"/ avg age {age} / AI impact {risk_str}. Independent score by Claude Opus 4.7 (unofficial)."
            )
            if name_en
            else (
                f"{name_ja}: workforce ~{fmt_int(workers)} / annual salary {int(salary_man)}万円 "
                f"/ avg age {age} / AI impact {risk_str}. Independent score by Claude Opus 4.7 (unofficial)."
            )
        )
        og_locale = "en_US"
        og_locale_alt = "ja_JP"
        site_name = "Japan Jobs × AI Impact Map (unofficial)"
        home_href = "/?lang=en"
        crumb_root = "Japan Jobs × AI Impact Map"
        crumb_self_label = f"{name_en} / {name_ja}" if name_en else name_ja
        h1_main = name_en or name_ja
        h1_sub = name_ja if name_en else ""
        risk_label = "AI Impact"
        rationale = rationale_en or desc_en
        st_workers = "Workforce"
        st_workers_unit = " persons"
        st_salary = "Annual salary"
        st_age = "Avg age"
        st_age_unit = " yrs"
        st_hours = "Monthly hours"
        st_hours_unit = " h/mo"
        st_recruit = "Recruit ratio"
        st_hourly = "Hourly wage"
        ctx_h2 = "About this occupation"
        ctx_p = desc_en or rationale_en
        src_h2 = "Sources / Related"
        src_mhlw_label = f"MHLW jobtag — {name_ja} (official source)"
        src_method_label = "Methodology / scoring rubric"
        src_back_label = "Back to the 552-occupation map"
        rel_h2 = "Related occupations"
        rel_path = "/en/"
        banner_html = "<strong>Independent analysis</strong> · Not endorsed by MHLW / jobtag / JILPT"
        skip_label = "Skip to content"
        disclaim = "AI risk scores are independent LLM estimates by Claude Opus 4.7 — not official forecasts. Not endorsed by MHLW, jobtag, or JILPT. Should not be the sole basis for personal career decisions."
        lang_switch_label = "日本語"
        lang_switch_target_lang = "ja"
        salary_cell = (
            f'{("¥" + fmt_int(int(salary_man * 10000))) if salary_man else "—"} ({int(salary_man) if salary_man else "—"}万円)'
        )

    og_title = title[:120]
    og_desc = seo_desc[:300]
    alternate_url = en_url(id_) if lang == "ja" else ja_url(id_)
    h1_sub_html = f'<span class="h1-sub">{escape(h1_sub)}</span>' if h1_sub else ""

    related_li_html_parts = []
    for r in related:
        rid = r["id"]
        if lang == "ja":
            rname = r.get("name_ja") or r.get("name_en") or f"#{rid}"
        else:
            rname = r.get("name_en") or r.get("name_ja") or f"#{rid}"
        rrisk = r.get("ai_risk")
        rrisk_str = f"{rrisk}/10" if rrisk is not None else "—"
        ai_short = "AI 影響" if lang == "ja" else "AI"
        related_li_html_parts.append(
            f'<li><a class="r-name" href="{rel_path}{rid}">{escape(rname)}</a>'
            f'<span class="r-risk">{ai_short} {rrisk_str}</span></li>'
        )
    related_html = "\n          ".join(related_li_html_parts)

    salary_int = int(salary_man) if salary_man else "—"
    age_disp = age if age else "—"
    hours_disp = int(hours) if hours else "—"
    recruit_disp = recruit if recruit is not None else "—"
    hourly_disp = f"¥{fmt_int(hourly)}" if hourly else "—"
    risk_num_disp = risk if risk is not None else "—"

    html = f"""<!doctype html>
<html lang="{lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Theme: read saved choice before paint (no flash). Falls back to system preference via CSS @media. -->
    <script>(function(){{try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}}})();</script>
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(seo_desc)}" />
    <meta name="robots" content="index, follow" />

    <link rel="canonical" href="{canonical}" />
    <link rel="alternate" hreflang="ja" href="{ja_url(id_)}" />
    <link rel="alternate" hreflang="en" href="{en_url(id_)}" />
    <link rel="alternate" hreflang="x-default" href="{ja_url(id_)}" />

    <link rel="dns-prefetch" href="//static.cloudflareinsights.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="{escape(site_name)}" />
    <meta property="og:locale" content="{og_locale}" />
    <meta property="og:locale:alternate" content="{og_locale_alt}" />
    <meta property="og:title" content="{escape(og_title)}" />
    <meta property="og:description" content="{escape(og_desc)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="https://mirai-shigoto.com/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(og_title)}" />
    <meta name="twitter:description" content="{escape(og_desc)}" />
    <meta name="twitter:image" content="https://mirai-shigoto.com/og.png" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <!-- Schema.org JSON-LD: WebPage + Occupation + BreadcrumbList. References parent #website / #organization / #dataset from the home page. -->
    <script type="application/ld+json">
{jsonld}
    </script>

{ANALYTICS_BLOCK}

    <style>{CSS_BLOCK}</style>
  </head>
  <body>
    <a class="skip-link" href="#content">{skip_label}</a>
    <div class="top-banner" role="note">
      <span class="badge">UNOFFICIAL</span>
      <span>{banner_html}</span>
    </div>

    <div id="wrapper">
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="{home_href}" rel="up">{escape(crumb_root)}</a>
        <span aria-hidden="true">›</span>
        <span>{escape(crumb_self_label)}</span>
      </nav>

      <header id="content">
        <h1>
          <span class="accent">{escape(h1_main)}</span>{h1_sub_html}
          <span class="lang-switch"><a href="{alternate_url}" hreflang="{lang_switch_target_lang}" rel="alternate">{lang_switch_label}</a></span>
          <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light / dark">
            <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-1-13h2v3h-2V2Zm0 19h2v3h-2v-3ZM2 11h3v2H2v-2Zm17 0h3v2h-3v-2ZM5.6 4.2 7.7 6.3 6.3 7.7 4.2 5.6l1.4-1.4Zm12.7 12.7 2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4ZM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1ZM18.3 7.7l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1Z"/></svg>
            <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          </button>
        </h1>
      </header>

      <div class="risk-card {risk_class}">
        <div>
          <div class="risk-label">{risk_label}</div>
          <div class="risk-num">{risk_num_disp}<small> / 10</small></div>
        </div>
        <div class="risk-rationale">{escape(rationale)}</div>
      </div>

      <dl class="stats" aria-label="Key occupation statistics">
        <div><dt>{st_workers}</dt><dd>{fmt_int(workers)}{st_workers_unit}</dd></div>
        <div><dt>{st_salary}</dt><dd>{salary_cell}</dd></div>
        <div><dt>{st_age}</dt><dd>{age_disp}{st_age_unit}</dd></div>
        <div><dt>{st_hours}</dt><dd>{hours_disp}{st_hours_unit}</dd></div>
        <div><dt>{st_recruit}</dt><dd>{recruit_disp}</dd></div>
        <div><dt>{st_hourly}</dt><dd>{hourly_disp}</dd></div>
      </dl>

      <section class="context">
        <h2>{ctx_h2}</h2>
        <p>{escape(ctx_p)}</p>
      </section>

      <section class="related" aria-label="{escape(rel_h2)}">
        <h2>{rel_h2}</h2>
        <ul>
          {related_html}
        </ul>
      </section>

      <section class="sources">
        <h2>{src_h2}</h2>
        <ul>
          <li><a href="{escape(mhlw_url)}" rel="external" target="_blank">{escape(src_mhlw_label)}</a></li>
          <li><a href="/llms-full.txt" rel="noopener">{src_method_label}</a></li>
          <li><a href="{home_href}" rel="up">{src_back_label}</a></li>
        </ul>
      </section>

      <p class="disclaimer">
        <strong>UNOFFICIAL.</strong>
        {escape(disclaim)}
      </p>

      <footer>
        <span>© <a href="{home_href}">mirai-shigoto.com</a> · MIT</span>
        <span><a href="/privacy">Privacy</a> · <a href="https://github.com/jasonhnd/jobs">GitHub</a></span>
      </footer>
    </div>

    <script>
      (function(){{
        var btn=document.getElementById('themeToggle');
        if(!btn)return;
        btn.addEventListener('click',function(){{
          var sysLight=matchMedia('(prefers-color-scheme: light)').matches;
          var saved=null;try{{saved=localStorage.getItem('theme');}}catch(e){{}}
          var cur=document.documentElement.getAttribute('data-theme')||(sysLight?'light':'dark');
          var next=cur==='light'?'dark':'light';
          document.documentElement.setAttribute('data-theme',next);
          try{{localStorage.setItem('theme',next);}}catch(e){{}}
          if(window.gtag)gtag('event','theme_change',{{from:cur,to:next,was_explicit:saved==='light'||saved==='dark',system_pref:sysLight?'light':'dark'}});
        }});
      }})();
    </script>
  </body>
</html>
"""
    return html


SITEMAP_BASE = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://mirai-shigoto.com/</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://mirai-shigoto.com/?lang=en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com/" />
  </url>
  <url>
    <loc>https://mirai-shigoto.com/privacy</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com/privacy" />
    <xhtml:link rel="alternate" hreflang="en" href="https://mirai-shigoto.com/privacy?lang=en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com/privacy" />
  </url>
  <!-- GEO surface: llms.txt convention (https://llmstxt.org). Listed here so general crawlers discover them too. -->
  <url>
    <loc>https://mirai-shigoto.com/llms.txt</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.2</priority>
  </url>
  <url>
    <loc>https://mirai-shigoto.com/llms-full.txt</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.2</priority>
  </url>
  <!-- Per-occupation pages: 552 JA at /ja/<id> + 552 EN at /en/<id>. Generated by scripts/build_occupations.py. -->
{occupations}</urlset>
"""


def write_sitemap(manifest: list[dict], lastmod: str = DATE_MODIFIED) -> None:
    """Rewrite sitemap.xml with home + privacy + llms* + (552 JA + 552 EN) occupation URLs."""
    lines: list[str] = []
    for entry in manifest:
        ja = entry["ja_url"]
        en = entry["en_url"]
        for primary in (ja, en):
            lines.append(
                f"  <url>\n"
                f"    <loc>{primary}</loc>\n"
                f"    <lastmod>{lastmod}</lastmod>\n"
                f"    <changefreq>monthly</changefreq>\n"
                f"    <priority>0.5</priority>\n"
                f'    <xhtml:link rel="alternate" hreflang="ja" href="{ja}" />\n'
                f'    <xhtml:link rel="alternate" hreflang="en" href="{en}" />\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ja}" />\n'
                f"  </url>\n"
            )
    SITEMAP_PATH.write_text(
        SITEMAP_BASE.format(lastmod=lastmod, occupations="".join(lines)),
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="Generate only the first N records (smoke test).")
    ap.add_argument("--ids", type=str, default=None, help="Comma-separated list of ids to generate (e.g., 428,33,1).")
    ap.add_argument("--no-sitemap", action="store_true", help="Skip rewriting sitemap.xml (default: rewrite when generating full set).")
    args = ap.parse_args()

    OUT_DIR_JA.mkdir(parents=True, exist_ok=True)
    OUT_DIR_EN.mkdir(parents=True, exist_ok=True)

    all_data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    is_full_run = args.ids is None and args.limit is None

    if args.ids:
        wanted = {int(x) for x in args.ids.split(",") if x.strip()}
        data = [r for r in all_data if r["id"] in wanted]
    elif args.limit:
        data = all_data[: args.limit]
    else:
        data = all_data

    manifest: list[dict] = []
    bytes_total = 0
    for rec in data:
        related = pick_related(rec, all_data, RELATED_COUNT)
        ja_html = render_html(rec, "ja", related)
        en_html = render_html(rec, "en", related)
        ja_path = OUT_DIR_JA / f"{rec['id']}.html"
        en_path = OUT_DIR_EN / f"{rec['id']}.html"
        ja_path.write_text(ja_html, encoding="utf-8")
        en_path.write_text(en_html, encoding="utf-8")
        ja_size = ja_path.stat().st_size
        en_size = en_path.stat().st_size
        bytes_total += ja_size + en_size
        manifest.append(
            {
                "id": rec["id"],
                "name_ja": rec.get("name_ja"),
                "name_en": rec.get("name_en"),
                "ai_risk": rec.get("ai_risk"),
                "ja_url": ja_url(rec["id"]),
                "en_url": en_url(rec["id"]),
                "ja_size_bytes": ja_size,
                "en_size_bytes": en_size,
            }
        )

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    pages = len(manifest) * 2
    avg_kb = bytes_total / pages / 1024 if pages else 0
    print(f"Generated {pages} pages ({len(manifest)} JA + {len(manifest)} EN) → {OUT_DIR_JA.name}/, {OUT_DIR_EN.name}/")
    print(f"Total: {bytes_total/1024:.1f} KB  ·  Avg: {avg_kb:.1f} KB/page")
    print(f"Manifest: {MANIFEST_PATH}")

    if is_full_run and not args.no_sitemap:
        write_sitemap(manifest)
        print(f"Sitemap rewritten: {SITEMAP_PATH} ({pages} occupation URLs added)")
    elif not is_full_run:
        print("(partial run — sitemap NOT rewritten; pass --no-sitemap to silence this notice)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
