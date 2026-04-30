#!/usr/bin/env python3
"""
build_occupations.py — generate 552 static per-occupation pages at /occ/<id>-<slug>.html

Each page is a small (~8-10 KB) self-contained HTML file with:
  - Standard SEO meta + canonical + hreflang (ja / en / x-default)
  - DNS-prefetch + preconnect for analytics origins
  - 4 analytics scripts (Cloudflare / GA4 / Vercel WA / Speed Insights) — same as index.html
  - Schema.org JSON-LD graph: WebPage + Occupation + BreadcrumbList,
    cross-referencing parent #website / #organization / #dataset on the home page
  - sameAs link to the canonical MHLW jobtag URL (occupation id ↔ jobtag detail id)
  - Bilingual content visible in DOM (JA primary; EN spans toggled with `?lang=en` JS)

Output:
  occ/<id>-<slug>.html         e.g. occ/428-general-office-clerk.html
  + emits a JSON manifest at scripts/.occ_manifest.json with (id, slug, path) for each
    record so update_sitemap.py / SEO scripts can read it without re-parsing.

Usage:
  python3 scripts/build_occupations.py                    # all 552
  python3 scripts/build_occupations.py --limit 3          # first 3 only (smoke test)
  python3 scripts/build_occupations.py --ids 428,33,1     # specific ids
"""
from __future__ import annotations
import argparse
import json
import re
from html import escape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA_PATH = REPO / "data.json"
OUT_DIR = REPO / "occ"
MANIFEST_PATH = REPO / "scripts" / ".occ_manifest.json"
DATE_PUBLISHED = "2026-04-25"
DATE_MODIFIED = "2026-04-30"


def slugify(s: str | None) -> str:
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s[:60]


def page_path(rec: dict) -> tuple[str, str]:
    """Return (slug-with-id, canonical_url) for an occupation record."""
    id_ = rec["id"]
    slug = slugify(rec.get("name_en"))
    path = f"{id_}-{slug}" if slug else f"{id_}"
    return path, f"https://mirai-shigoto.com/occ/{path}"


def render_jsonld(rec: dict, canonical: str) -> str:
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

    breadcrumb_label = f"{name_ja} / {name_en}" if name_en else name_ja
    description_for_occ = rationale_en or desc_en or rationale_ja or desc_ja or name_ja

    additional = []
    if risk is not None:
        additional.append({
            "@type": "PropertyValue",
            "name": "AI risk score (0-10)",
            "value": risk,
            "description": "Independent LLM estimate by Claude Opus 4.7. Reflects task-level exposure, not probability of job loss.",
        })
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
        "description": description_for_occ,
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
                "name": f"{name_ja} ({name_en}) — AI 影響 {risk}/10" if (name_en and risk is not None)
                        else f"{name_ja} — mirai-shigoto.com",
                "description": description_for_occ,
                "isPartOf": {"@id": "https://mirai-shigoto.com/#website"},
                "about": {"@id": f"{canonical}#occupation"},
                "mainEntity": {"@id": f"{canonical}#occupation"},
                "primaryImageOfPage": "https://mirai-shigoto.com/og.png",
                "inLanguage": ["ja", "en"],
                "breadcrumb": {"@id": f"{canonical}#breadcrumb"},
                "datePublished": DATE_PUBLISHED,
                "dateModified": DATE_MODIFIED,
                "publisher": {"@id": "https://mirai-shigoto.com/#organization"},
                "author": {"@id": "https://mirai-shigoto.com/#person"},
            },
            occupation_node,
            {
                "@type": "BreadcrumbList",
                "@id": f"{canonical}#breadcrumb",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "日本の職業 AI 影響マップ", "item": "https://mirai-shigoto.com/"},
                    {"@type": "ListItem", "position": 2, "name": breadcrumb_label, "item": canonical},
                ],
            },
        ],
    }
    return json.dumps(graph, ensure_ascii=False, indent=2)


def fmt_int(n: int | float | None) -> str:
    if n is None:
        return "—"
    return f"{int(n):,}"


def render_html(rec: dict) -> tuple[str, str]:
    """Return (path-stem, html-string)."""
    id_ = rec["id"]
    path_stem, canonical = page_path(rec)

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

    title_ja = f"{name_ja}（{name_en}） — AI 影響 {risk_str}｜mirai-shigoto.com" if name_en \
        else f"{name_ja} — AI 影響 {risk_str}｜mirai-shigoto.com"
    desc_seo = (
        f"{name_ja}（{name_en}）：就業者 約{fmt_int(workers)}人 / 平均年収 {int(salary_man)}万円 "
        f"/ 平均年齢 {age} / AI 影響 {risk_str}。Claude Opus 4.7 による独自スコア（非公式）。"
    ) if name_en else (
        f"{name_ja}：就業者 約{fmt_int(workers)}人 / 平均年収 {int(salary_man)}万円 "
        f"/ 平均年齢 {age} / AI 影響 {risk_str}。Claude Opus 4.7 による独自スコア（非公式）。"
    )
    og_title = title_ja[:120]
    og_desc = desc_seo[:300]

    risk_class = f"risk-{risk}" if risk is not None else "risk-na"

    jsonld_str = render_jsonld(rec, canonical)

    # CSS — minimal, mirrors index.html palette
    css = """
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
      h1 .h1-en{font-size:0.7em;color:var(--fg2);font-weight:500;margin-left:8px}
      .lang-switch{display:inline-flex;gap:4px;font-size:0.78rem;margin-left:8px;vertical-align:middle}
      .lang-switch button{background:transparent;border:1px solid var(--border);color:var(--fg2);padding:3px 9px;border-radius:999px;cursor:pointer;font:inherit}
      .lang-switch button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent)}
      .risk-card{display:flex;align-items:center;gap:18px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 22px;margin:18px 0 22px}
      .risk-num{font-size:clamp(2.4rem,1.8rem+2vw,3.4rem);font-weight:800;line-height:1;letter-spacing:-0.02em}
      .risk-num small{font-size:0.4em;color:var(--fg2);font-weight:500;margin-left:4px}
      .risk-label{font-size:0.85rem;color:var(--fg2);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em}
      .risk-rationale{flex:1;font-size:0.95rem;color:var(--fg)}
      .risk-rationale .lang-en{color:var(--fg2);display:block;margin-top:4px;font-size:0.85rem}
      .risk-0,.risk-1,.risk-2{color:#7ddc7d}.risk-3,.risk-4{color:#a8d572}
      .risk-5,.risk-6{color:#ffd84d}.risk-7,.risk-8{color:#ff8a3d}.risk-9,.risk-10{color:#ff5050}
      dl.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 18px;margin:20px 0;padding:16px 18px;background:var(--bg2);border:1px solid var(--border);border-radius:10px}
      dl.stats dt{font-size:0.72rem;color:var(--fg2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px}
      dl.stats dd{font-size:1.05rem;font-weight:600}
      section.context,section.sources{margin-top:28px}
      section h2{font-size:1.05rem;margin-bottom:10px;color:var(--accent)}
      section p{color:var(--fg);margin-bottom:8px}
      section ul{list-style:none;padding:0}section li{margin-bottom:6px;font-size:0.92rem}
      .disclaimer{margin-top:32px;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--fg2);font-size:0.82rem;line-height:1.6}
      .disclaimer strong{color:#ff8a3d}
      .back{margin-top:24px;font-size:0.92rem}
      footer{margin-top:48px;padding:18px 0;border-top:1px solid var(--border);font-size:0.78rem;color:var(--fg2);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
      [data-i18n]{display:none}[data-i18n].active{display:inline}
      [data-i18n].block{display:none}[data-i18n].active.block{display:block}
    """

    # Body — bilingual content visible to crawlers (CSS-toggled, both rendered)
    body = f"""
    <a class="skip-link" href="#content"><span data-i18n="ja" class="active">本文へ</span><span data-i18n="en">Skip to content</span></a>
    <div class="top-banner" role="note">
      <span class="badge">UNOFFICIAL</span>
      <span data-i18n="ja" class="active">独自分析・<strong>厚労省 / job tag / JILPT の公式見解ではありません</strong></span>
      <span data-i18n="en"><strong>Independent analysis</strong> ・ Not endorsed by MHLW / jobtag / JILPT</span>
    </div>

    <div id="wrapper">
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="/" rel="up">
          <span data-i18n="ja" class="active">日本の職業 AI 影響マップ</span>
          <span data-i18n="en">Japan Jobs × AI Impact Map</span>
        </a>
        <span aria-hidden="true">›</span>
        <span>{escape(name_ja)}{(' / ' + escape(name_en)) if name_en else ''}</span>
      </nav>

      <header id="content">
        <h1>
          <span class="accent">{escape(name_ja)}</span>{f'<span class="h1-en">{escape(name_en)}</span>' if name_en else ''}
          <span class="lang-switch" role="group">
            <button data-set="ja" aria-pressed="true">日本語</button>
            <button data-set="en" aria-pressed="false">English</button>
          </span>
        </h1>
      </header>

      <div class="risk-card {risk_class}">
        <div>
          <div class="risk-label">
            <span data-i18n="ja" class="active">AI 影響</span>
            <span data-i18n="en">AI Impact</span>
          </div>
          <div class="risk-num">{risk if risk is not None else '—'}<small> / 10</small></div>
        </div>
        <div class="risk-rationale">
          <span data-i18n="ja" class="active block">{escape(rationale_ja or desc_ja)}</span>
          <span data-i18n="en" class="block">{escape(rationale_en or desc_en)}</span>
        </div>
      </div>

      <dl class="stats" aria-label="Key occupation statistics">
        <div><dt><span data-i18n="ja" class="active">就業者数</span><span data-i18n="en">Workforce</span></dt><dd>{fmt_int(workers)}<span data-i18n="ja" class="active"> 人</span><span data-i18n="en"> persons</span></dd></div>
        <div><dt><span data-i18n="ja" class="active">年収（平均）</span><span data-i18n="en">Annual salary</span></dt><dd>{('¥' + fmt_int(int(salary_man * 10000))) if salary_man else '—'}<span data-i18n="ja" class="active">（{int(salary_man) if salary_man else '—'} 万円）</span></dd></div>
        <div><dt><span data-i18n="ja" class="active">平均年齢</span><span data-i18n="en">Avg age</span></dt><dd>{age if age else '—'}<span data-i18n="ja" class="active"> 歳</span><span data-i18n="en"> yrs</span></dd></div>
        <div><dt><span data-i18n="ja" class="active">月労働時間</span><span data-i18n="en">Monthly hours</span></dt><dd>{int(hours) if hours else '—'}<span data-i18n="ja" class="active"> 時間/月</span><span data-i18n="en"> h/mo</span></dd></div>
        <div><dt><span data-i18n="ja" class="active">求人倍率</span><span data-i18n="en">Recruit ratio</span></dt><dd>{recruit if recruit is not None else '—'}</dd></div>
        <div><dt><span data-i18n="ja" class="active">時給</span><span data-i18n="en">Hourly wage</span></dt><dd>¥{fmt_int(hourly) if hourly else '—'}</dd></div>
      </dl>

      <section class="context">
        <h2><span data-i18n="ja" class="active">この職業について</span><span data-i18n="en">About this occupation</span></h2>
        <p data-i18n="ja" class="active block">{escape(desc_ja)}</p>
        <p data-i18n="en" class="block">{escape(desc_en or rationale_en)}</p>
      </section>

      <section class="sources">
        <h2><span data-i18n="ja" class="active">出典 / 関連リンク</span><span data-i18n="en">Sources / Related</span></h2>
        <ul>
          <li><a href="{escape(mhlw_url)}" rel="external" target="_blank">
            <span data-i18n="ja" class="active">厚生労働省 job tag — {escape(name_ja)}（公式）</span>
            <span data-i18n="en">MHLW jobtag — {escape(name_ja)} (official source)</span>
          </a></li>
          <li><a href="/llms-full.txt" rel="noopener">
            <span data-i18n="ja" class="active">方法論 / スコアリングルーブリック</span>
            <span data-i18n="en">Methodology / scoring rubric</span>
          </a></li>
          <li><a href="/" rel="up">
            <span data-i18n="ja" class="active">552 職種マップに戻る</span>
            <span data-i18n="en">Back to 552-occupation map</span>
          </a></li>
        </ul>
      </section>

      <p class="disclaimer">
        <strong>UNOFFICIAL.</strong>
        <span data-i18n="ja" class="active">AI 影響スコアは Claude Opus 4.7 による独自推定（非公式）。MHLW / jobtag / JILPT の公式見解ではありません。個別の職業選択の唯一の根拠としては使わないでください。</span>
        <span data-i18n="en">AI risk scores are independent LLM estimates by Claude Opus 4.7 — not official forecasts. Not endorsed by MHLW, jobtag, or JILPT. Should not be the sole basis for personal career decisions.</span>
      </p>

      <footer>
        <span>© <a href="/">mirai-shigoto.com</a> · MIT</span>
        <span><a href="/privacy">Privacy</a> · <a href="https://github.com/jasonhnd/jobs">GitHub</a></span>
      </footer>
    </div>

    <script>
      // Tiny bilingual toggle — reads ?lang=en from URL or button click.
      (function(){{
        var params = new URLSearchParams(location.search);
        var lang = params.get('lang') === 'en' ? 'en' : 'ja';
        function apply(target){{
          document.documentElement.lang = target;
          document.querySelectorAll('[data-i18n]').forEach(function(el){{
            if (el.getAttribute('data-i18n') === target) el.classList.add('active');
            else el.classList.remove('active');
          }});
          document.querySelectorAll('.lang-switch button').forEach(function(b){{
            b.setAttribute('aria-pressed', b.getAttribute('data-set') === target ? 'true' : 'false');
          }});
        }}
        if (lang !== 'ja') apply(lang);
        document.querySelectorAll('.lang-switch button').forEach(function(b){{
          b.addEventListener('click', function(){{ apply(b.getAttribute('data-set')); }});
        }});
      }})();
    </script>
"""

    # Compose final HTML
    html = f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(title_ja)}</title>
    <meta name="description" content="{escape(desc_seo)}" />
    <meta name="robots" content="index, follow" />
    <meta name="author" content="Jason" />

    <link rel="canonical" href="{canonical}" />
    <link rel="alternate" hreflang="ja" href="{canonical}" />
    <link rel="alternate" hreflang="en" href="{canonical}?lang=en" />
    <link rel="alternate" hreflang="x-default" href="{canonical}" />

    <link rel="dns-prefetch" href="//static.cloudflareinsights.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="日本の職業 AI 影響マップ（非公式）" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:locale:alternate" content="en_US" />
    <meta property="og:title" content="{escape(og_title)}" />
    <meta property="og:description" content="{escape(og_desc)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="https://mirai-shigoto.com/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@jasonaxb" />
    <meta name="twitter:creator" content="@jasonaxb" />
    <meta name="twitter:title" content="{escape(og_title)}" />
    <meta name="twitter:description" content="{escape(og_desc)}" />
    <meta name="twitter:image" content="https://mirai-shigoto.com/og.png" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <!-- Schema.org JSON-LD: WebPage + Occupation + BreadcrumbList. References parent #website / #organization / #dataset / #person from the home page. -->
    <script type="application/ld+json">
{jsonld_str}
    </script>

    <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{{"token": "b1588779b90341ea9d87d93769b348dc"}}'></script>

    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){{dataLayer.push(arguments);}}
      gtag('js', new Date());
      gtag('config', 'G-GLDNBDPF13');
      window.addEventListener('load', function () {{
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=G-GLDNBDPF13';
        document.head.appendChild(s);
      }});
    </script>

    <script defer src="/_vercel/insights/script.js"></script>
    <script defer src="/_vercel/speed-insights/script.js"></script>

    <style>{css}</style>
  </head>
  <body>{body}</body>
</html>
"""
    return path_stem, html


SITEMAP_PATH = REPO / "sitemap.xml"
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
  <!-- Per-occupation pages (552). Generated by scripts/build_occupations.py. -->
{occupations}</urlset>
"""


def write_sitemap(manifest: list[dict], lastmod: str = DATE_MODIFIED) -> None:
    """Rewrite sitemap.xml with the home + privacy + llms* + N occupation URLs."""
    lines = []
    for entry in manifest:
        url = entry["url"]
        lines.append(
            f"  <url>\n"
            f"    <loc>{url}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <changefreq>monthly</changefreq>\n"
            f"    <priority>0.5</priority>\n"
            f"    <xhtml:link rel=\"alternate\" hreflang=\"ja\" href=\"{url}\" />\n"
            f"    <xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"{url}?lang=en\" />\n"
            f"    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"{url}\" />\n"
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
    ap.add_argument("--out", type=str, default=str(OUT_DIR), help="Output directory.")
    ap.add_argument("--no-sitemap", action="store_true", help="Skip rewriting sitemap.xml (default: rewrite when generating full set).")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    is_full_run = (args.ids is None and args.limit is None)
    if args.ids:
        wanted = set(int(x) for x in args.ids.split(",") if x.strip())
        data = [r for r in data if r["id"] in wanted]
    if args.limit:
        data = data[: args.limit]

    manifest = []
    bytes_total = 0
    for rec in data:
        path_stem, html = render_html(rec)
        path = out_dir / f"{path_stem}.html"
        path.write_text(html, encoding="utf-8")
        size = path.stat().st_size
        bytes_total += size
        manifest.append({
            "id": rec["id"],
            "name_ja": rec.get("name_ja"),
            "name_en": rec.get("name_en"),
            "ai_risk": rec.get("ai_risk"),
            "slug": path_stem,
            "url": f"https://mirai-shigoto.com/occ/{path_stem}",
            "size_bytes": size,
        })

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {len(manifest)} occupation pages → {out_dir}")
    print(f"Total: {bytes_total/1024:.1f} KB  ·  Avg: {bytes_total/len(manifest)/1024:.1f} KB/page")
    print(f"Manifest: {MANIFEST_PATH}")

    if is_full_run and not args.no_sitemap:
        write_sitemap(manifest)
        print(f"Sitemap rewritten: {SITEMAP_PATH} ({len(manifest)} occupation URLs added)")
    elif not is_full_run:
        print("(partial run — sitemap NOT rewritten; pass --no-sitemap to silence this notice)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
