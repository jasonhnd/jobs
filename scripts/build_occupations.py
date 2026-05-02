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
    # Audit CODE-004: keep None as None instead of `or 0` so SEO meta
    # descriptions never claim "平均年収 0万円 / 平均年齢 0" for occupations
    # where MHLW jobtag returned no value. Display sites below substitute
    # explicit "—" / "データなし" / "Data unavailable" via the `_disp` helpers.
    # The Schema.org JSON-LD truthy filters (`if salary_man:` etc.) already
    # correctly omit absent properties — None and 0 both fall through.
    salary_man = rec.get("salary")
    workers = rec.get("workers")
    age = rec.get("age")
    hours = rec.get("hours")
    recruit = rec.get("recruit_ratio")
    hourly = rec.get("hourly_wage")
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
                "primaryImageOfPage": f"https://mirai-shigoto.com/api/og?id={id_}&lang={lang}",
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
      footer{margin-top:24px;padding:18px 0;border-top:1px solid var(--border);font-size:0.78rem;color:var(--fg2);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
      /* Stage 1: Follow + Share footer block (visual layering — follow prominent, share small) */
      .follow-share-section{margin:48px auto 8px;text-align:center}
      .follow-block{margin-bottom:28px}
      .follow-cta{display:inline-flex;align-items:center;gap:14px;padding:14px 26px;background:var(--accent);color:#1a1206;border-radius:10px;text-decoration:none;font:inherit;transition:filter 150ms ease,transform 100ms ease;max-width:100%}
      .follow-cta:hover{filter:brightness(1.05);text-decoration:none}
      .follow-cta:active{transform:translateY(1px)}
      .follow-cta:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .follow-cta .follow-icon{font-size:1.5rem;line-height:1}
      .follow-cta .follow-text{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}
      .follow-cta .follow-text strong{font-size:1.02rem;font-weight:700;color:#1a1206}
      .follow-cta .follow-text small{font-size:0.78rem;opacity:0.8;font-weight:500}
      .share-divider{font-size:0.74rem;color:var(--fg2);letter-spacing:0.08em;text-transform:uppercase;margin:0 auto 14px;max-width:480px;display:flex;align-items:center;gap:12px}
      .share-divider::before,.share-divider::after{content:"";flex:1;height:1px;background:var(--border)}
      .share-row{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin:0}
      .share-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:var(--bg2);color:var(--fg2);border:1px solid var(--border);border-radius:999px;cursor:pointer;font-family:inherit;text-decoration:none;transition:color 150ms ease,background 150ms ease,border-color 150ms ease}
      .share-btn:hover{color:#fff;border-color:transparent;text-decoration:none}
      .share-btn[data-platform="x"]:hover{background:#000}
      .share-btn[data-platform="line"]:hover{background:#06C755}
      .share-btn[data-platform="hatena"]:hover{background:#00A4DE}
      .share-btn[data-platform="linkedin"]:hover{background:#0A66C2}
      .share-btn[data-platform="facebook"]:hover{background:#1877F2}
      .share-btn[data-platform="copy"]:hover,.share-btn[data-platform="native"]:hover{background:var(--accent);color:#1a1206}
      .share-btn svg{width:16px;height:16px;fill:currentColor}
      .share-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .share-toast{font-size:0.78rem;color:var(--accent);margin-left:6px;opacity:0;transition:opacity 200ms ease}
      .share-toast.visible{opacity:1}
      @media (max-width:540px){.share-btn{width:36px;height:36px}.follow-cta{padding:12px 20px;gap:10px}.follow-cta .follow-text strong{font-size:0.95rem}.follow-cta .follow-text small{font-size:0.72rem}}
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

    # Audit CODE-004: keep None as None instead of `or 0` so SEO meta
    # descriptions never claim "平均年収 0万円 / 平均年齢 0" for occupations
    # where MHLW jobtag returned no value. Display sites below substitute
    # explicit "—" / "データなし" / "Data unavailable" via the `_disp` helpers.
    # The Schema.org JSON-LD truthy filters (`if salary_man:` etc.) already
    # correctly omit absent properties — None and 0 both fall through.
    salary_man = rec.get("salary")
    workers = rec.get("workers")
    age = rec.get("age")
    hours = rec.get("hours")
    recruit = rec.get("recruit_ratio")
    hourly = rec.get("hourly_wage")
    mhlw_url = rec.get("url") or f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{id_}"

    risk_class = f"risk-{risk}" if risk is not None else "risk-na"
    jsonld = render_jsonld(rec, lang)

    # Audit CODE-004: SEO description must read "データなし" instead of
    # "0万円" / "0" when MHLW didn't ship a value. _meta_* are the natural-
    # language fragments embedded in <meta description>; visible UI cells
    # use _ui_* below.
    if lang == "ja":
        _meta_workers = f"就業者 約{fmt_int(workers)}人" if workers else "就業者数データなし"
        _meta_salary = f"平均年収 {int(salary_man)}万円" if salary_man else "平均年収データなし"
        _meta_age = f"平均年齢 {age}" if age else "平均年齢データなし"
    else:
        _meta_workers = f"workforce ~{fmt_int(workers)}" if workers else "workforce data unavailable"
        _meta_salary = f"annual salary {int(salary_man)}万円" if salary_man else "annual salary data unavailable"
        _meta_age = f"avg age {age}" if age else "avg age data unavailable"

    if lang == "ja":
        title = (
            f"{name_ja}（{name_en}） — AI 影響 {risk_str}｜mirai-shigoto.com"
            if name_en
            else f"{name_ja} — AI 影響 {risk_str}｜mirai-shigoto.com"
        )
        seo_desc = (
            (
                f"{name_ja}（{name_en}）：{_meta_workers} / {_meta_salary} "
                f"/ {_meta_age} / AI 影響 {risk_str}。Claude Opus 4.7 による独自スコア（非公式）。"
            )
            if name_en
            else (
                f"{name_ja}：{_meta_workers} / {_meta_salary} "
                f"/ {_meta_age} / AI 影響 {risk_str}。Claude Opus 4.7 による独自スコア（非公式）。"
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
                f"{name_en} ({name_ja}): {_meta_workers} / {_meta_salary} "
                f"/ {_meta_age} / AI impact {risk_str}. Independent score by Claude Opus 4.7 (unofficial)."
            )
            if name_en
            else (
                f"{name_ja}: {_meta_workers} / {_meta_salary} "
                f"/ {_meta_age} / AI impact {risk_str}. Independent score by Claude Opus 4.7 (unofficial)."
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

    # Stage 1: Follow + Share localized strings.
    if lang == "ja":
        follow_strong = "X でフォローする"
        follow_small = "毎日の職業分析を受け取る"
        share_label = "このページをシェア"
        share_text_for_post = (
            f"{name_ja} の AI 影響度は {risk_str}。日本 552 職種の AI 影響マップ（非公式・独自分析）。"
        )
        share_aria_x = "X で共有"
        share_aria_line = "LINE で共有"
        share_aria_hatena = "はてなブックマークで共有"
        share_aria_linkedin = "LinkedIn で共有"
        share_aria_facebook = "Facebook で共有"
        share_aria_copy = "URL をコピー"
        share_aria_native = "共有"
        copy_toast_text = "コピーしました"
        about_link_label = "データについて →"
    else:
        display_name = name_en or name_ja
        follow_strong = "Follow on X"
        follow_small = "Daily occupation insights"
        share_label = "Share this page"
        share_text_for_post = (
            f"{display_name}: AI impact {risk_str}. Map of 552 Japanese occupations "
            f"(independent analysis, unofficial)."
        )
        share_aria_x = "Share on X"
        share_aria_line = "Share on LINE"
        share_aria_hatena = "Share on Hatena Bookmark"
        share_aria_linkedin = "Share on LinkedIn"
        share_aria_facebook = "Share on Facebook"
        share_aria_copy = "Copy link"
        share_aria_native = "Share"
        copy_toast_text = "Link copied"
        about_link_label = "About the data →"

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

    # Display-only formatters (Audit CODE-004). When the underlying value is
    # missing, both the value AND its unit suffix collapse to "—" alone, so
    # the page never reads "— 人" / "— yrs" — just the dash.
    salary_int = int(salary_man) if salary_man else "—"
    age_disp = age if age else "—"
    hours_disp = int(hours) if hours else "—"
    recruit_disp = recruit if recruit is not None else "—"
    hourly_disp = f"¥{fmt_int(hourly)}" if hourly else "—"
    risk_num_disp = risk if risk is not None else "—"
    workers_cell = f"{fmt_int(workers)}{st_workers_unit}" if workers else "—"
    age_cell = f"{age_disp}{st_age_unit}" if age else "—"
    hours_cell = f"{hours_disp}{st_hours_unit}" if hours else "—"

    # GA4 result_view signal — fires synchronously on page load. The gtag stub
    # in ANALYTICS_BLOCK queues the call into dataLayer and the real gtag.js
    # (loaded on window.load) replays it. Risk tier mirrors the convention used
    # for tooltip_cta_click in index.html.
    risk_score_js = str(risk) if risk is not None else "null"
    if risk is not None and risk >= 7:
        risk_tier_js = "'high'"
    elif risk is not None and risk >= 5:
        risk_tier_js = "'mid'"
    else:
        risk_tier_js = "'low'"
    result_view_block = (
        "    <script>\n"
        "      // Per-occupation page-view signal for the GA4 conversion funnel.\n"
        f"      gtag('event', 'result_view', {{ occupation_id: {id_}, "
        f"ai_risk_score: {risk_score_js}, risk_tier: {risk_tier_js}, "
        f"language: '{lang}' }});\n"
        "    </script>"
    )

    # Stage 1: JS literals for the share/follow handlers (escape-safe via repr).
    canonical_js = canonical
    share_text_js = share_text_for_post
    copy_toast_js = copy_toast_text
    occ_id_js = id_
    lang_js = lang

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
    <meta property="og:image" content="https://mirai-shigoto.com/api/og?id={id_}&amp;lang={lang}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="{escape(og_title)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(og_title)}" />
    <meta name="twitter:description" content="{escape(og_desc)}" />
    <meta name="twitter:image" content="https://mirai-shigoto.com/api/og?id={id_}&amp;lang={lang}" />
    <meta name="twitter:image:alt" content="{escape(og_title)}" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <!-- Schema.org JSON-LD: WebPage + Occupation + BreadcrumbList. References parent #website / #organization / #dataset from the home page. -->
    <script type="application/ld+json">
{jsonld}
    </script>

{ANALYTICS_BLOCK}

{result_view_block}

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
        <div><dt>{st_workers}</dt><dd>{workers_cell}</dd></div>
        <div><dt>{st_salary}</dt><dd>{salary_cell}</dd></div>
        <div><dt>{st_age}</dt><dd>{age_cell}</dd></div>
        <div><dt>{st_hours}</dt><dd>{hours_cell}</dd></div>
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

      <!-- Stage 1: Follow + Share footer block (visual layering — follow prominent, share small) -->
      <div class="follow-share-section" aria-label="Follow and share">
        <div class="follow-block">
          <a class="follow-cta"
             id="x-follow-cta"
             href="https://x.com/miraishigotocom"
             target="_blank"
             rel="noopener noreferrer">
            <span class="follow-icon" aria-hidden="true">📬</span>
            <span class="follow-text">
              <strong>{escape(follow_strong)}</strong>
              <small>{escape(follow_small)}</small>
            </span>
          </a>
        </div>

        <div class="share-divider"><span>{escape(share_label)}</span></div>

        <div class="share-row" role="group" aria-label="{escape(share_label)}">
          <a class="share-btn" id="share-x" data-platform="x" href="#" aria-label="{escape(share_aria_x)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z"/></svg>
          </a>
          <a class="share-btn" id="share-line" data-platform="line" href="#" aria-label="{escape(share_aria_line)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755Zm-3.855 3.016c0 .27-.174.51-.432.596a.616.616 0 0 1-.199.031.61.61 0 0 1-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595a.658.658 0 0 1 .194-.033c.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771Zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771Zm-2.466.629H4.917a.629.629 0 0 1-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          </a>
          <a class="share-btn" id="share-hatena" data-platform="hatena" href="#" aria-label="{escape(share_aria_hatena)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.47 0C22.42 0 24 1.58 24 3.53v16.94c0 1.95-1.58 3.53-3.53 3.53H3.53C1.58 24 0 22.42 0 20.47V3.53C0 1.58 1.58 0 3.53 0h16.94Zm-3.7 14.47a1.41 1.41 0 1 0 0 2.82 1.41 1.41 0 0 0 0-2.82Zm-5.92 2.69c1.59 0 2.92-.18 3.71-.83.84-.65 1.27-1.55 1.27-2.69 0-.97-.32-1.75-.97-2.34-.65-.59-1.5-.92-2.55-1 .92-.25 1.62-.59 2.04-1.07.43-.45.65-1.07.65-1.84 0-.61-.13-1.16-.4-1.61-.27-.45-.65-.83-1.18-1.07-.45-.22-1-.4-1.61-.5-.61-.07-1.55-.13-2.79-.13H6.74v13.07h4.11Zm-.86-2.5h-.94v-3.13h.97c1.16 0 1.95.13 2.34.4.4.27.59.72.59 1.34 0 .54-.18.97-.54 1.21-.36.27-1.16.18-2.42.18Zm0-5.45h-.94V6.5h.4c1.21 0 2 .07 2.39.27.4.18.61.61.61 1.27 0 .59-.22 1.05-.65 1.27-.4.18-1.18.27-2.39.27ZM22.59 16.94v-7.5h-2.13v7.5h2.13Z"/></svg>
          </a>
          <a class="share-btn" id="share-linkedin" data-platform="linkedin" href="#" aria-label="{escape(share_aria_linkedin)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 0H5C2.24 0 0 2.24 0 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5V5c0-2.76-2.24-5-5-5ZM8 19H5V8h3v11ZM6.5 6.73a1.76 1.76 0 1 1 0-3.53 1.76 1.76 0 0 1 0 3.53ZM20 19h-3v-5.6c0-3.37-4-3.11-4 0V19h-3V8h3v1.77c1.4-2.59 7-2.78 7 2.47V19Z"/></svg>
          </a>
          <a class="share-btn" id="share-facebook" data-platform="facebook" href="#" aria-label="{escape(share_aria_facebook)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.19 2.24.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99C18.34 21.13 22 16.99 22 12Z"/></svg>
          </a>
          <button class="share-btn" id="share-copy" type="button" data-platform="copy" aria-label="{escape(share_aria_copy)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1ZM8 13h8v-2H8v2Zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4a5 5 0 0 0 0-10Z"/></svg>
          </button>
          <button class="share-btn" id="share-native" type="button" data-platform="native" aria-label="{escape(share_aria_native)}" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 8 6h3v8h2V6h3l-4-4Zm-7 7v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2h-3v2h3v11H7V9h3V7H7c-1.1 0-2 .9-2 2Z"/></svg>
          </button>
          <span class="share-toast" id="share-toast" aria-live="polite"></span>
        </div>
      </div>

      <footer>
        <span>© <a href="{home_href}">mirai-shigoto.com</a> · MIT</span>
        <span><a href="/about">{escape(about_link_label)}</a> · <a href="/privacy">Privacy</a> · <a href="https://github.com/jasonhnd/jobs">GitHub</a></span>
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
      // Stage 1: Follow + Share handlers
      (function(){{
        var SITE = {canonical_js!r};
        var SHARE_TEXT = {share_text_js!r};
        var COPY_TOAST = {copy_toast_js!r};
        function shareUrl(source, medium){{
          var sep = SITE.indexOf('?')>=0 ? '&' : '?';
          return SITE + sep + 'utm_source=' + source + '&utm_medium=' + medium + '&utm_campaign=footer_share&utm_content=occ';
        }}
        function track(p){{ if(window.gtag) gtag('event','share_click',{{platform:p,occupation_id:{occ_id_js},language:{lang_js!r}}}); }}
        function open(u){{ window.open(u,'_blank','noopener,noreferrer'); }}

        var x = document.getElementById('share-x');
        if(x) x.addEventListener('click',function(e){{e.preventDefault(); open('https://x.com/intent/post?url=' + encodeURIComponent(shareUrl('x','social')) + '&text=' + encodeURIComponent(SHARE_TEXT)); track('x');}});
        var line = document.getElementById('share-line');
        if(line) line.addEventListener('click',function(e){{e.preventDefault(); open('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(shareUrl('line','im'))); track('line');}});
        var hatena = document.getElementById('share-hatena');
        if(hatena) hatena.addEventListener('click',function(e){{e.preventDefault(); open('https://b.hatena.ne.jp/entry/' + shareUrl('hatena','social').replace(/^https?:\\/\\//,'')); track('hatena');}});
        var linkedin = document.getElementById('share-linkedin');
        if(linkedin) linkedin.addEventListener('click',function(e){{e.preventDefault(); open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl('linkedin','social'))); track('linkedin');}});
        var fb = document.getElementById('share-facebook');
        if(fb) fb.addEventListener('click',function(e){{e.preventDefault(); open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl('facebook','social'))); track('facebook');}});
        var xfollow = document.getElementById('x-follow-cta');
        if(xfollow) xfollow.addEventListener('click',function(){{ if(window.gtag) gtag('event','x_follow_click',{{occupation_id:{occ_id_js},language:{lang_js!r}}}); }});

        var copy = document.getElementById('share-copy');
        var toast = document.getElementById('share-toast');
        if(copy && toast) copy.addEventListener('click',async function(e){{
          e.preventDefault();
          var url = shareUrl('direct','copylink');
          try{{ await navigator.clipboard.writeText(url); toast.textContent = COPY_TOAST; }}catch(err){{ toast.textContent = url; }}
          toast.classList.add('visible'); track('copy');
          setTimeout(function(){{toast.classList.remove('visible');}},2200);
        }});

        var native = document.getElementById('share-native');
        if(native){{
          if(typeof navigator.share === 'function'){{
            native.hidden = false;
            native.addEventListener('click',async function(e){{
              e.preventDefault();
              try{{ await navigator.share({{title: document.title, text: SHARE_TEXT, url: shareUrl('native','share_api')}}); track('native'); }}catch(err){{}}
            }});
          }}
        }}
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
  <url>
    <loc>https://mirai-shigoto.com/about</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com/about" />
    <xhtml:link rel="alternate" hreflang="en" href="https://mirai-shigoto.com/about?lang=en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com/about" />
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

    # Partial runs (--ids / --limit) write to .partial.json so the canonical
    # 552-entry manifest produced by full runs is never overwritten by smoke
    # tests. Only is_full_run promotes to the canonical path.
    if is_full_run:
        manifest_target = MANIFEST_PATH
    else:
        manifest_target = MANIFEST_PATH.with_suffix(".partial.json")
    manifest_target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    pages = len(manifest) * 2
    avg_kb = bytes_total / pages / 1024 if pages else 0
    print(f"Generated {pages} pages ({len(manifest)} JA + {len(manifest)} EN) → {OUT_DIR_JA.name}/, {OUT_DIR_EN.name}/")
    print(f"Total: {bytes_total/1024:.1f} KB  ·  Avg: {avg_kb:.1f} KB/page")
    print(f"Manifest: {manifest_target}{' (partial — full manifest at ' + str(MANIFEST_PATH) + ' unchanged)' if not is_full_run else ''}")

    if is_full_run and not args.no_sitemap:
        write_sitemap(manifest)
        print(f"Sitemap rewritten: {SITEMAP_PATH} ({pages} occupation URLs added)")
    elif not is_full_run:
        print("(partial run — sitemap NOT rewritten; pass --no-sitemap to silence this notice)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
