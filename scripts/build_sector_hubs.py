#!/usr/bin/env python3
"""
build_sector_hubs.py — generate 16 static JA sector hub pages.

  ja/sectors/<sector_id>.html  (16 JA sector hubs)

Each hub aggregates the occupations belonging to one sector and surfaces:
  - sector overview (count, mean AI risk, total workforce)
  - TOP 5 high AI risk occupations in the sector
  - TOP 5 low AI risk occupations in the sector
  - TOP 5 workforce occupations in the sector
  - full occupation list (sorted by AI risk desc) with link to detail page

JA-only as of v1.4.0 (English UI removed). Includes the same 4-tracker
analytics block as every other page on the site. Schema.org JSON-LD:
WebPage + BreadcrumbList + ItemList.

Output:
  ja/sectors/<sector_id>.html × 16
  scripts/.sector_manifest.json  (sector_id, ja_url, occupation_count, ...)
  sitemap.xml                    rewritten to include the 16 hub URLs

Usage:
  python3 scripts/build_sector_hubs.py             # generate all 16 hubs + rewrite sitemap
  python3 scripts/build_sector_hubs.py --no-sitemap
"""
from __future__ import annotations
import argparse
import json
from html import escape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SECTORS_PATH = REPO / "data" / "sectors" / "sectors.ja-en.json"
DETAIL_DIR = REPO / "dist" / "data.detail"
OCC_MANIFEST_PATH = REPO / "scripts" / ".occ_manifest.json"
SECTOR_MANIFEST_PATH = REPO / "scripts" / ".sector_manifest.json"
SITEMAP_PATH = REPO / "sitemap.xml"
OUT_DIR_JA = REPO / "ja" / "sectors"
DATE_PUBLISHED = "2026-05-05"
DATE_MODIFIED = "2026-05-05"
TOP_N = 5
SITE = "https://mirai-shigoto.com"


# ────────────────────────── shared assets (analytics + CSS) ──────────────────

ANALYTICS_BLOCK = """\
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "b1588779b90341ea9d87d93769b348dc"}'></script>

    <!-- Google tag (gtag.js) — defer script load to window.load to remove ~64 KB / 265 ms from critical path. dataLayer + gtag stub stay available immediately so pre-load gtag() calls queue normally. -->
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

    <!-- Vercel Web Analytics + Speed Insights -->
    <script defer src="/_vercel/insights/script.js"></script>
    <script defer src="/_vercel/speed-insights/script.js"></script>"""


CSS_BLOCK = """\
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10);--font-serif:"Noto Serif JP","Source Serif Pro",Georgia,serif;--font-sans:"Plus Jakarta Sans","Hiragino Sans",-apple-system,BlinkMacSystemFont,"Yu Gothic UI","Segoe UI",Roboto,sans-serif}
:root[data-theme="dark"]{--bg:#1A1814;--bg2:#241E18;--bg3:#2E2722;--fg:#F0EBE0;--fg2:#B8AC95;--fg3:#7A6F5E;--border:rgba(240,235,224,0.10)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1A1814;--bg2:#241E18;--bg3:#2E2722;--fg:#F0EBE0;--fg2:#B8AC95;--fg3:#7A6F5E;--border:rgba(240,235,224,0.10)}}
html{font-size:16px}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.65;font-feature-settings:"palt"}
a{color:var(--accent-deep);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
a:hover{color:var(--accent)}
.skip-link{position:absolute;left:-9999px;top:0;background:var(--fg);color:var(--bg);padding:8px 12px;z-index:100}
.skip-link:focus{left:8px;top:8px}
.top-banner{background:var(--bg3);border-bottom:1px solid var(--border);padding:8px 16px;font-size:.85rem;color:var(--fg2);display:flex;gap:12px;align-items:center;justify-content:center}
.badge{background:var(--accent);color:#fff;padding:2px 8px;font-size:.7rem;letter-spacing:.05em;font-weight:700;border-radius:2px}
#wrapper{max-width:980px;margin:0 auto;padding:32px 20px 80px}
.crumb{font-size:.85rem;color:var(--fg2);margin-bottom:24px}
.crumb a{color:var(--fg2)}
.crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}
header{margin-bottom:32px;border-bottom:1px solid var(--border);padding-bottom:24px}
h1{font-family:var(--font-serif);font-size:clamp(1.75rem,4vw,2.5rem);font-weight:600;line-height:1.25;color:var(--fg);margin-bottom:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
h1 .accent{color:var(--accent-deep)}
.sub{color:var(--fg2);font-size:.95rem}
.sub strong{color:var(--accent-deep);font-weight:600}
.intro{margin:24px 0;color:var(--fg);font-size:1.05rem;max-width:64ch}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:32px 0}
.stats>div{background:var(--bg2);border:1px solid var(--border);padding:16px;border-radius:6px}
.stats dt{font-size:.75rem;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.stats dd{font-family:var(--font-serif);font-size:1.4rem;font-weight:600;color:var(--fg)}
section{margin:48px 0}
h2{font-family:var(--font-serif);font-size:1.35rem;font-weight:600;color:var(--fg);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.top-list{list-style:none;display:grid;gap:8px}
.top-list li{background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px}
.top-list a{color:var(--fg);text-decoration:none;font-weight:500}
.top-list a:hover{color:var(--accent-deep);text-decoration:underline}
.top-list .meta{color:var(--fg2);font-size:.85rem;white-space:nowrap;font-variant-numeric:tabular-nums}
.risk-pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums;margin-right:8px}
.risk-pill.low{background:#E0EAE2;color:#48705F}
.risk-pill.mid{background:#F4E5C7;color:#8A6A2A}
.risk-pill.high{background:#F5D5C7;color:#A24A28}
:root[data-theme="dark"] .risk-pill.low{background:#2A3D34;color:#9DC4AD}
:root[data-theme="dark"] .risk-pill.mid{background:#3D3424;color:#D4B97E}
:root[data-theme="dark"] .risk-pill.high{background:#3D2620;color:#E89A7C}
.full-list{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:6px}
.full-list li{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;align-items:center}
.full-list a{color:var(--fg);text-decoration:none}
.full-list a:hover{color:var(--accent-deep);text-decoration:underline}
.related-sectors{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;list-style:none}
.related-sectors li{background:var(--bg2);border:1px solid var(--border);border-radius:4px}
.related-sectors a{display:block;padding:12px 14px;text-decoration:none;color:var(--fg)}
.related-sectors a:hover{background:var(--bg3);color:var(--accent-deep)}
.related-sectors .ja-name{font-family:var(--font-serif);font-weight:500}
.related-sectors .count{color:var(--fg2);font-size:.8rem;display:block;margin-top:2px}
footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--border);font-size:.85rem;color:var(--fg2);text-align:center}
footer .footer-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin-bottom:14px}
footer .footer-links a{color:var(--fg2);text-decoration:none;padding:5px 14px;border:1px solid var(--border);border-radius:999px;font-size:.78rem;line-height:1.2;transition:color 150ms ease,border-color 150ms ease,background 150ms ease}
footer .footer-links a:hover{color:var(--accent);border-color:var(--accent);background:rgba(217,107,61,0.06);text-decoration:none}
footer .footer-meta{color:var(--fg2);font-size:.7rem;opacity:.92;text-wrap:pretty;line-height:1.65}
footer .footer-meta a{color:var(--accent)}
footer .footer-meta .nowrap{white-space:nowrap}
@media (max-width:540px){footer .footer-meta{font-size:.66rem;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere}}
@media (max-width:600px){#wrapper{padding:20px 16px 60px}h1{flex-direction:column;align-items:flex-start;gap:6px}.top-list li{flex-direction:column;align-items:flex-start;gap:6px}}
"""


# ────────────────────────── data loading ─────────────────────────────────────

def load_sectors() -> list[dict]:
    return json.loads(SECTORS_PATH.read_text(encoding="utf-8"))["sectors"]


def load_occupations() -> list[dict]:
    out: list[dict] = []
    for f in sorted(DETAIL_DIR.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        sector = d.get("sector") or {}
        if not sector.get("id"):
            continue
        stats = d.get("stats") or {}
        ai = d.get("ai_risk") or {}
        out.append({
            "id": d["id"],
            "title_ja": (d.get("title") or {}).get("ja"),
            "title_en": (d.get("title") or {}).get("en"),
            "ai_risk": ai.get("score"),
            "risk_band": d.get("risk_band"),
            "workers": stats.get("workers"),
            "salary": stats.get("salary_man_yen"),
            "sector_id": sector["id"],
        })
    return out


def fmt_int(n) -> str:
    if n is None:
        return "—"
    return f"{int(n):,}"


def risk_band(score):
    if score is None:
        return "mid"
    if score <= 3:
        return "low"
    if score <= 6:
        return "mid"
    return "high"


def occ_url(id_: int) -> str:
    return f"{SITE}/ja/{id_}"


def hub_url(sector_id: str) -> str:
    return f"{SITE}/ja/sectors/{sector_id}"


# ────────────────────────── rendering ────────────────────────────────────────

def render_top_list(items: list[dict]) -> str:
    if not items:
        return ""
    rows = []
    for o in items:
        title = o["title_ja"] or f"#{o['id']}"
        score = o["ai_risk"]
        score_str = "—" if score is None else f"{score}/10"
        band = risk_band(score)
        workers = fmt_int(o["workers"])
        rows.append(
            f'<li>'
            f'<a href="/ja/{o["id"]}">'
            f'<span class="risk-pill {band}">{escape(score_str)}</span>'
            f'{escape(title)}'
            f'</a>'
            f'<span class="meta">{workers} 就業者</span>'
            f'</li>'
        )
    return f'<ul class="top-list">{"".join(rows)}</ul>'


def render_full_list(items: list[dict]) -> str:
    rows = []
    for o in sorted(items, key=lambda r: (-(r["ai_risk"] or -1), r["id"])):
        title = o["title_ja"] or f"#{o['id']}"
        score = o["ai_risk"]
        score_str = "—" if score is None else f"{score}/10"
        band = risk_band(score)
        rows.append(
            f'<li>'
            f'<a href="/ja/{o["id"]}">'
            f'<span class="risk-pill {band}">{escape(score_str)}</span>'
            f'{escape(title)}'
            f'</a>'
            f'</li>'
        )
    return f'<ul class="full-list">{"".join(rows)}</ul>'


def render_related_sectors(current_id: str, all_sectors: list[dict], occ_counts: dict) -> str:
    rows = []
    for s in all_sectors:
        if s["id"] == current_id:
            continue
        name = s["ja"]
        count = occ_counts.get(s["id"], 0)
        rows.append(
            f'<li>'
            f'<a href="/ja/sectors/{s["id"]}">'
            f'<span class="ja-name">{escape(name)}</span>'
            f'<span class="count">{count} 職業</span>'
            f'</a>'
            f'</li>'
        )
    return f'<ul class="related-sectors">{"".join(rows)}</ul>'


def render_jsonld(sector: dict, occs: list[dict]) -> str:
    name_loc = sector["ja"]
    canonical = hub_url(sector["id"])
    crumb_root = "未来の仕事"
    crumb_sectors = "セクター"
    home_href = f"{SITE}/"
    sectors_index_href = f"{SITE}/ja/sectors"

    item_list = []
    for i, o in enumerate(sorted(occs, key=lambda r: (-(r["ai_risk"] or -1), r["id"])), 1):
        title = o["title_ja"] or f"#{o['id']}"
        item_list.append({
            "@type": "ListItem",
            "position": i,
            "url": occ_url(o["id"]),
            "name": title,
        })

    graph = [
        {
            "@type": "WebPage",
            "@id": f"{canonical}#webpage",
            "url": canonical,
            "name": f"{name_loc} の職業一覧",
            "description": f"{name_loc} 業界の {len(occs)} 職業を AI 影響度・年収・就業者数で一覧。",
            "isPartOf": {"@id": f"{SITE}/#website"},
            "inLanguage": "ja",
            "datePublished": DATE_PUBLISHED,
            "dateModified": DATE_MODIFIED,
            "publisher": {"@id": f"{SITE}/#organization"},
            "breadcrumb": {"@id": f"{canonical}#breadcrumb"},
        },
        {
            "@type": "BreadcrumbList",
            "@id": f"{canonical}#breadcrumb",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": crumb_root, "item": home_href},
                {"@type": "ListItem", "position": 2, "name": crumb_sectors, "item": sectors_index_href},
                {"@type": "ListItem", "position": 3, "name": name_loc, "item": canonical},
            ],
        },
        {
            "@type": "ItemList",
            "@id": f"{canonical}#occupations",
            "name": f"{name_loc} の職業",
            "numberOfItems": len(item_list),
            "itemListOrder": "https://schema.org/ItemListOrderDescending",
            "itemListElement": item_list,
        },
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)


def render_hub(sector: dict, occs: list[dict], all_sectors: list[dict], occ_counts: dict) -> str:
    sid = sector["id"]
    name_loc = sector["ja"]
    desc_intro = sector.get("description_ja", "")
    canonical = hub_url(sid)
    n = len(occs)

    workforce_total = sum(o["workers"] or 0 for o in occs)
    risks = [o["ai_risk"] for o in occs if o["ai_risk"] is not None]
    mean_risk = (sum(risks) / len(risks)) if risks else None

    sample_titles = []
    for o in sorted(occs, key=lambda r: -(r["workers"] or 0))[:3]:
        t = o["title_ja"]
        if t:
            sample_titles.append(t)
    samples_str = " / ".join(sample_titles) if sample_titles else ""

    title = f"{name_loc}の職業一覧 — {n}職業｜AI 影響度ランキング・年収・就業者数 | 未来の仕事"
    og_title = f"{name_loc}の職業一覧 — {n}職業｜AI 影響度ランキング"
    seo_desc = (
        f"{name_loc} 業界の{n}職業をAI影響度・年収・就業者数で一覧。"
        f"代表職業：{samples_str}。Claude Opus 4.7 による独自分析（非公式）。"
    )
    crumb_root = "未来の仕事"
    crumb_sectors = "セクター"
    site_name = "未来の仕事 — Mirai Shigoto（非公式）"
    og_locale = "ja_JP"
    intro_text = desc_intro
    h1_main = f"{name_loc}の職業"
    sub_text = (
        f"<strong>{n} 職業</strong>"
        + (f" · 平均 AI 影響 <strong>{mean_risk:.1f}/10</strong>" if mean_risk is not None else "")
        + f" · 就業者数 計 <strong>{fmt_int(workforce_total)}</strong> 人"
    )
    # H2 with sector name embedded — matches "{sector} AI 影響" / "{sector} 就業者数" intent.
    h_high = f"{name_loc} の AI 影響 が高い職業 TOP 5"
    h_low = f"{name_loc} の AI 影響 が低い職業 TOP 5"
    h_pop = f"{name_loc} の 就業者数 TOP 5"
    h_full = f"{name_loc} の全 {n} 職業（AI 影響度 高い順）"
    h_related = "他のセクター"
    about_link = "データについて"
    skip_label = "本文へスキップ"

    sorted_by_risk = sorted([o for o in occs if o["ai_risk"] is not None], key=lambda r: r["ai_risk"], reverse=True)
    top_high = sorted_by_risk[:TOP_N]
    top_low = sorted_by_risk[::-1][:TOP_N]
    top_workers = sorted([o for o in occs if o["workers"]], key=lambda r: -r["workers"])[:TOP_N]

    home_href = "/"
    about_href = "/about"

    keywords_list = [name_loc]
    keywords_list.extend([t for t in sample_titles if t])
    keywords_list.extend([f"{name_loc} 仕事", f"{name_loc} 職業", f"{name_loc} AI 影響"])
    keywords_str = ", ".join(escape(k) for k in keywords_list)

    jsonld = render_jsonld(sector, occs)
    intro_section = f'<p class="intro">{escape(intro_text)}</p>' if intro_text else ""

    html = f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>(function(){{try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}}})();</script>
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(seo_desc)}" />
    <meta name="robots" content="index, follow" />
    <meta name="keywords" content="{keywords_str}" />

    <link rel="canonical" href="{canonical}" />

    <link rel="dns-prefetch" href="//static.cloudflareinsights.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="{escape(site_name)}" />
    <meta property="og:locale" content="{og_locale}" />
    <meta property="og:title" content="{escape(og_title)}" />
    <meta property="og:description" content="{escape(seo_desc)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="/api/og?sector={sid}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="{escape(og_title)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(og_title)}" />
    <meta name="twitter:description" content="{escape(seo_desc)}" />
    <meta name="twitter:image" content="/api/og?sector={sid}" />
    <meta name="twitter:image:alt" content="{escape(og_title)}" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <script type="application/ld+json">
{jsonld}
    </script>

{ANALYTICS_BLOCK}

    <style>{CSS_BLOCK}</style>
  </head>
  <body>
    <a class="skip-link" href="#content">{escape(skip_label)}</a>
    <div class="top-banner" role="note">
      <span class="badge">UNOFFICIAL</span>
      <span>独立分析・厚労省 / jobtag / JILPT 非公式</span>
    </div>

    <div id="wrapper">
      <nav class="crumb" aria-label="パンくずリスト">
        <a href="{home_href}" rel="up">{escape(crumb_root)}</a>
        <span aria-hidden="true">›</span>
        <a href="/ja/sectors" rel="up">{escape(crumb_sectors)}</a>
        <span aria-hidden="true">›</span>
        <span>{escape(name_loc)}</span>
      </nav>

      <header id="content">
        <h1>
          <span class="accent">{escape(h1_main)}</span>
        </h1>
        <p class="sub">{sub_text}</p>
        {intro_section}
      </header>

      <section aria-label="セクター概要">
        <dl class="stats">
          <div><dt>職業数</dt><dd>{n}</dd></div>
          <div><dt>平均 AI 影響</dt><dd>{('—' if mean_risk is None else f'{mean_risk:.1f} / 10')}</dd></div>
          <div><dt>就業者数 合計</dt><dd>{fmt_int(workforce_total)}</dd></div>
        </dl>
      </section>

      <section aria-label="{escape(h_high)}">
        <h2>{escape(h_high)}</h2>
        {render_top_list(top_high)}
      </section>

      <section aria-label="{escape(h_low)}">
        <h2>{escape(h_low)}</h2>
        {render_top_list(top_low)}
      </section>

      <section aria-label="{escape(h_pop)}">
        <h2>{escape(h_pop)}</h2>
        {render_top_list(top_workers)}
      </section>

      <section aria-label="{escape(h_full)}">
        <h2>{escape(h_full)}</h2>
        {render_full_list(occs)}
      </section>

      <section aria-label="{escape(h_related)}">
        <h2>{escape(h_related)}</h2>
        {render_related_sectors(sid, all_sectors, occ_counts)}
      </section>

      <footer>
        <div class="footer-links">
          <a href="{home_href}">トップ</a>
          <a href="/ja/sectors">セクター</a>
          <a href="/ja/rankings">ランキング</a>
        </div>
        <div class="footer-links">
          <a href="{about_href}">データについて</a>
          <a href="/compliance">コンプライアンス</a>
          <a href="/privacy">プライバシー</a>
        </div>
        <div class="footer-meta">
            v1.3.0 · MIT<br />
            出典：厚生労働省・<span class="nowrap">独立行政法人 労働政策研究・研修機構（JILPT）</span><br />
            <em>※ 本サイトは独自分析サイトであり、<br />厚生労働省・job tag・JILPT の<span class="nowrap">公式見解ではありません</span>。<br />詳細は <a href="/compliance">コンプライアンス</a> ページをご確認ください。</em>
        </div>
      </footer>
    </div>
  </body>
</html>
"""
    return html


# ────────────────────────── sectors index page ──────────────────────────────

def render_sectors_index(sectors: list[dict], by_sector: dict) -> str:
    """Hub-of-hubs: lists all 16 sectors with stats, links to each sector hub (JA only)."""
    canonical = f"{SITE}/ja/sectors"

    total_occ = sum(len(items) for items in by_sector.values())

    title = f"全 16 セクター｜556 職業を業界別に分類 | 未来の仕事"
    og_title = "全 16 セクター｜業界別 職業ランキング・AI 影響度・年収"
    seo_desc = (
        f"日本の{total_occ}職業を 16 業界（医療・保健、IT・通信、士業、製造、建設 ほか）に分類。"
        f"業界別の AI 影響度ランキング・就業者数・年収・代表職業を一覧。Claude Opus 4.7 独自分析（非公式）。"
    )
    crumb_root = "未来の仕事"
    site_name = "未来の仕事 — Mirai Shigoto（非公式）"
    og_locale = "ja_JP"
    h1 = "全 16 セクター"
    sub = f"<strong>556 職業</strong> を 16 業界に分類。クリックで業界別の AI 影響度ランキング・代表職業へ。"
    intro = "業界別に職業を一覧化したインデックスです。各セクターを開くと、AI 影響度・就業者数・年収のランキング、その業界に属する全職業の一覧が確認できます。"
    h_list = "業界 一覧"
    crumb_self = "セクター"
    about_link = "データについて"
    skip_label = "本文へスキップ"
    keywords = "業界別 職業, 業界 ランキング, AI 影響 業界, 仕事 業界, 556 職業, セクター"

    cards = []
    for s in sectors:
        sid = s["id"]
        occs = by_sector.get(sid, [])
        n = len(occs)
        risks = [o["ai_risk"] for o in occs if o["ai_risk"] is not None]
        mean_risk = (sum(risks) / len(risks)) if risks else 0
        workforce = sum(o["workers"] or 0 for o in occs)
        sample_titles = []
        for o in sorted(occs, key=lambda r: -(r["workers"] or 0))[:3]:
            t = o["title_ja"]
            if t:
                sample_titles.append(t)
        sample_str = " ・ ".join(sample_titles)
        name = s["ja"]
        risk_class = "low" if mean_risk <= 3.5 else ("high" if mean_risk >= 6.5 else "mid")
        cards.append(
            f'<li class="sector-card">'
            f'<a href="/ja/sectors/{sid}">'
            f'<div class="sc-head">'
            f'<h3 class="sc-name">{escape(name)}</h3>'
            f'<span class="sc-count">{n} 職業</span>'
            f'</div>'
            f'<div class="sc-stats">'
            f'<span class="sc-risk risk-pill {risk_class}">AI 影響 平均 {mean_risk:.1f}/10</span>'
            f'<span class="sc-workers">{fmt_int(workforce)} 人</span>'
            f'</div>'
            f'<p class="sc-samples">{escape(sample_str)}</p>'
            f'</a>'
            f'</li>'
        )
    cards_html = "\n        ".join(cards)

    # JSON-LD: WebPage + BreadcrumbList + ItemList of 16 hub URLs
    item_list = []
    for i, s in enumerate(sectors, 1):
        item_list.append({
            "@type": "ListItem",
            "position": i,
            "url": hub_url(s["id"]),
            "name": s["ja"],
        })
    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": f"{canonical}#webpage",
                "url": canonical,
                "name": h1,
                "description": seo_desc,
                "isPartOf": {"@id": f"{SITE}/#website"},
                "inLanguage": "ja",
                "datePublished": DATE_PUBLISHED,
                "dateModified": DATE_MODIFIED,
                "publisher": {"@id": f"{SITE}/#organization"},
                "breadcrumb": {"@id": f"{canonical}#breadcrumb"},
            },
            {
                "@type": "BreadcrumbList",
                "@id": f"{canonical}#breadcrumb",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": crumb_root, "item": f"{SITE}/"},
                    {"@type": "ListItem", "position": 2, "name": crumb_self, "item": canonical},
                ],
            },
            {
                "@type": "ItemList",
                "@id": f"{canonical}#sectors",
                "name": h_list,
                "numberOfItems": len(sectors),
                "itemListElement": item_list,
            },
        ],
    }, ensure_ascii=False, indent=2)

    home_href = "/"
    about_href = "/about"

    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>(function(){{try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}}})();</script>
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(seo_desc)}" />
    <meta name="robots" content="index, follow" />
    <meta name="keywords" content="{escape(keywords)}" />

    <link rel="canonical" href="{canonical}" />

    <link rel="dns-prefetch" href="//static.cloudflareinsights.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="{escape(site_name)}" />
    <meta property="og:locale" content="{og_locale}" />
    <meta property="og:title" content="{escape(og_title)}" />
    <meta property="og:description" content="{escape(seo_desc)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(og_title)}" />
    <meta name="twitter:description" content="{escape(seo_desc)}" />
    <meta name="twitter:image" content="/og.png" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <script type="application/ld+json">
{jsonld}
    </script>

{ANALYTICS_BLOCK}

    <style>{CSS_BLOCK}
.sector-cards{{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin:0;padding:0}}
.sector-card{{background:var(--bg2);border:1px solid var(--border);border-radius:8px;transition:border-color 150ms ease, transform 150ms ease}}
.sector-card:hover{{border-color:var(--accent);transform:translateY(-1px)}}
.sector-card a{{display:block;padding:18px 18px 16px;text-decoration:none;color:var(--fg)}}
.sc-head{{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:10px}}
.sc-name{{font-family:var(--font-serif);font-size:1.15rem;font-weight:600;color:var(--fg);margin:0}}
.sc-count{{color:var(--fg2);font-size:.78rem;font-variant-numeric:tabular-nums;white-space:nowrap}}
.sc-stats{{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}}
.sc-risk{{font-size:.72rem!important;padding:2px 9px}}
.sc-workers{{display:inline-block;padding:2px 9px;background:var(--bg3);border-radius:12px;font-size:.72rem;color:var(--fg2);font-variant-numeric:tabular-nums}}
.sc-samples{{font-size:.82rem;color:var(--fg2);line-height:1.5;margin:0}}
.sector-card a:hover .sc-name{{color:var(--accent-deep)}}</style>
  </head>
  <body>
    <a class="skip-link" href="#content">{escape(skip_label)}</a>
    <div class="top-banner" role="note">
      <span class="badge">UNOFFICIAL</span>
      <span>独立分析・厚労省 / jobtag / JILPT 非公式</span>
    </div>

    <div id="wrapper">
      <nav class="crumb" aria-label="パンくずリスト">
        <a href="{home_href}" rel="up">{escape(crumb_root)}</a>
        <span aria-hidden="true">›</span>
        <span>{escape(crumb_self)}</span>
      </nav>

      <header id="content">
        <h1>
          <span class="accent">{escape(h1)}</span>
        </h1>
        <p class="sub">{sub}</p>
        <p class="intro">{escape(intro)}</p>
      </header>

      <section aria-label="{escape(h_list)}">
        <h2>{escape(h_list)}</h2>
        <ul class="sector-cards">
        {cards_html}
        </ul>
      </section>

      <footer>
        <div class="footer-links">
          <a href="{home_href}">トップ</a>
          <a href="/ja/sectors">セクター</a>
          <a href="/ja/rankings">ランキング</a>
        </div>
        <div class="footer-links">
          <a href="{about_href}">{escape(about_link)}</a>
          <a href="/compliance">コンプライアンス</a>
          <a href="/privacy">プライバシー</a>
        </div>
        <div class="footer-meta">
            v1.3.0 · MIT<br />
            出典：厚生労働省・<span class="nowrap">独立行政法人 労働政策研究・研修機構（JILPT）</span><br />
            <em>※ 本サイトは独自分析サイトであり、<br />厚生労働省・job tag・JILPT の<span class="nowrap">公式見解ではありません</span>。<br />詳細は <a href="/compliance">コンプライアンス</a> ページをご確認ください。</em>
        </div>
      </footer>
    </div>
  </body>
</html>
"""


# ────────────────────────── sitemap rewrite ──────────────────────────────────

SITEMAP_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{site}/</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>{site}/privacy</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>{site}/about</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>{site}/compliance</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>{site}/llms.txt</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.2</priority>
  </url>
  <url>
    <loc>{site}/llms-full.txt</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.2</priority>
  </url>
  <!-- Sector hub pages: 16 JA hubs at /ja/sectors/<id>. Generated by scripts/build_sector_hubs.py. -->
{sectors}
  <!-- Per-occupation pages: 556 JA at /ja/<id>. Generated by scripts/build_occupations.py. -->
{occupations}</urlset>
"""


def write_sitemap(sectors: list[dict], occ_manifest: list[dict] | None, lastmod: str = DATE_MODIFIED) -> None:
    sector_lines: list[str] = []
    # Sectors index page (hub-of-hubs).
    sector_lines.append(
        f"  <url>\n"
        f"    <loc>{SITE}/ja/sectors</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>weekly</changefreq>\n"
        f"    <priority>0.8</priority>\n"
        f"  </url>\n"
    )
    for s in sectors:
        ja_u = hub_url(s["id"])
        sector_lines.append(
            f"  <url>\n"
            f"    <loc>{ja_u}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>0.7</priority>\n"
            f"  </url>\n"
        )

    occ_lines: list[str] = []
    if occ_manifest:
        for entry in occ_manifest:
            ja = entry["ja_url"]
            occ_lines.append(
                f"  <url>\n"
                f"    <loc>{ja}</loc>\n"
                f"    <lastmod>{lastmod}</lastmod>\n"
                f"    <changefreq>monthly</changefreq>\n"
                f"    <priority>0.5</priority>\n"
                f"  </url>\n"
            )

    SITEMAP_PATH.write_text(
        SITEMAP_TEMPLATE.format(
            site=SITE,
            lastmod=lastmod,
            sectors="".join(sector_lines),
            occupations="".join(occ_lines),
        ),
        encoding="utf-8",
    )


# ────────────────────────── main ─────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-sitemap", action="store_true", help="Skip rewriting sitemap.xml.")
    args = ap.parse_args()

    sectors = load_sectors()
    occupations = load_occupations()

    by_sector: dict[str, list[dict]] = {s["id"]: [] for s in sectors}
    for o in occupations:
        sid = o["sector_id"]
        if sid in by_sector:
            by_sector[sid].append(o)

    occ_counts = {sid: len(items) for sid, items in by_sector.items()}

    OUT_DIR_JA.mkdir(parents=True, exist_ok=True)

    manifest: list[dict] = []
    bytes_total = 0
    for sector in sectors:
        sid = sector["id"]
        occs = by_sector.get(sid, [])
        html = render_hub(sector, occs, sectors, occ_counts)
        path = OUT_DIR_JA / f"{sid}.html"
        path.write_text(html, encoding="utf-8")
        bytes_total += path.stat().st_size
        manifest.append({
            "sector_id": sid,
            "ja": sector["ja"],
            "occupation_count": len(occs),
            "ja_url": hub_url(sid),
        })

    # Sectors index page (hub-of-hubs) — JA only.
    idx_html = render_sectors_index(sectors, by_sector)
    idx_path = OUT_DIR_JA / "index.html"
    idx_path.write_text(idx_html, encoding="utf-8")
    bytes_total += idx_path.stat().st_size

    SECTOR_MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    pages = len(manifest) + 1  # 16 hubs + 1 index page
    print(f"Generated {pages} pages ({len(manifest)} sectors + 1 index page)")
    print(f"Total size: {bytes_total / 1024:.1f} KB · Avg: {bytes_total / pages / 1024:.1f} KB/page")
    print(f"Manifest: {SECTOR_MANIFEST_PATH}")

    if not args.no_sitemap:
        occ_manifest = None
        if OCC_MANIFEST_PATH.exists():
            occ_manifest = json.loads(OCC_MANIFEST_PATH.read_text(encoding="utf-8"))
            print(f"Loaded occupation manifest: {len(occ_manifest)} entries")
        else:
            print("WARNING: scripts/.occ_manifest.json not found — sitemap will only contain sectors + statics.")
        write_sitemap(sectors, occ_manifest)
        total_urls = 6 + pages + (len(occ_manifest) if occ_manifest else 0)
        print(f"Sitemap rewritten: {SITEMAP_PATH} ({total_urls} URLs)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
