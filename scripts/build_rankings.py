#!/usr/bin/env python3
"""
build_rankings.py — generate aggregate ranking pages for SEO.

These pages target high-volume search queries that individual occupation pages
cannot rank for:
  - 「AIに奪われる仕事 ランキング」
  - 「AI 影響 少ない 職業」
  - 「年収 高い AIリスク 低い」
  - 「就業者数 多い 職業」

Output:
  ja/rankings/index.html          — rankings hub
  ja/rankings/ai-risk-high.html   — top 30 highest AI risk
  ja/rankings/ai-risk-low.html    — top 30 lowest AI risk
  ja/rankings/salary-safe.html    — high salary + low AI risk
  ja/rankings/workers.html        — top 30 by workforce size

Usage:
  python3 scripts/build_rankings.py
"""
from __future__ import annotations
import json
from html import escape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DETAIL_DIR = REPO / "dist" / "data.detail"
SECTORS_PATH = REPO / "data" / "sectors" / "sectors.ja-en.json"
OUT_DIR = REPO / "ja" / "rankings"
SITE = "https://mirai-shigoto.com"
DATE_PUBLISHED = "2026-05-06"
DATE_MODIFIED = "2026-05-06"
TOP_N = 30


ANALYTICS_BLOCK = """\
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "b1588779b90341ea9d87d93769b348dc"}'></script>

    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-GLDNBDPF13"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-GLDNBDPF13');
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
h1{font-family:var(--font-serif);font-size:clamp(1.75rem,4vw,2.5rem);font-weight:600;line-height:1.25;color:var(--fg);margin-bottom:12px}
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
.rank-list{list-style:none;counter-reset:rank}
.rank-list li{counter-increment:rank;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:16px 18px;margin-bottom:8px;display:grid;grid-template-columns:36px 1fr auto;gap:14px;align-items:center}
.rank-list li:hover{border-color:var(--accent)}
.rank-list li::before{content:counter(rank);font-family:var(--font-serif);font-size:1.2rem;font-weight:700;color:var(--fg3);text-align:center}
.rank-list li:nth-child(-n+3)::before{color:var(--accent)}
.rank-list .rl-main{display:flex;flex-direction:column;gap:4px}
.rank-list .rl-name{font-family:var(--font-serif);font-size:1.05rem;font-weight:500;color:var(--fg);text-decoration:none}
.rank-list .rl-name:hover{color:var(--accent);text-decoration:underline}
.rank-list .rl-sector{font-size:.78rem;color:var(--fg2)}
.rank-list .rl-stats{display:flex;gap:12px;flex-wrap:wrap;align-items:center;white-space:nowrap}
.risk-pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums}
.risk-pill.low{background:#E0EAE2;color:#48705F}
.risk-pill.mid{background:#F4E5C7;color:#8A6A2A}
.risk-pill.high{background:#F5D5C7;color:#A24A28}
:root[data-theme="dark"] .risk-pill.low{background:#2A3D34;color:#9DC4AD}
:root[data-theme="dark"] .risk-pill.mid{background:#3D3424;color:#D4B97E}
:root[data-theme="dark"] .risk-pill.high{background:#3D2620;color:#E89A7C}
.rl-salary,.rl-workers{font-size:.82rem;color:var(--fg2);font-variant-numeric:tabular-nums}
.related-rankings{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;list-style:none}
.related-rankings li a{display:block;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--fg);font-weight:500;transition:border-color 150ms}
.related-rankings li a:hover{border-color:var(--accent);color:var(--accent-deep)}
.related-rankings .rr-desc{display:block;font-size:.82rem;color:var(--fg2);font-weight:400;margin-top:4px}
footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--border);font-size:.85rem;color:var(--fg2);text-align:center}
footer .footer-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin-bottom:14px}
footer .footer-links a{color:var(--fg2);text-decoration:none;padding:5px 14px;border:1px solid var(--border);border-radius:999px;font-size:.78rem;line-height:1.2;transition:color 150ms ease,border-color 150ms ease,background 150ms ease}
footer .footer-links a:hover{color:var(--accent);border-color:var(--accent);background:rgba(217,107,61,0.06);text-decoration:none}
footer .footer-meta{color:var(--fg2);font-size:.72rem;line-height:1.55}
footer .footer-meta a{color:var(--accent)}
@media (max-width:600px){#wrapper{padding:20px 16px 60px}.rank-list li{grid-template-columns:28px 1fr;gap:10px}.rank-list .rl-stats{margin-top:6px}}
"""


def load_occupations() -> list[dict]:
    out: list[dict] = []
    for f in sorted(DETAIL_DIR.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        stats = d.get("stats") or {}
        ai = d.get("ai_risk") or {}
        sector = d.get("sector") or {}
        out.append({
            "id": d["id"],
            "title_ja": (d.get("title") or {}).get("ja"),
            "ai_risk": ai.get("score"),
            "risk_band": d.get("risk_band"),
            "workers": stats.get("workers"),
            "salary": stats.get("salary_man_yen"),
            "sector_id": sector.get("id", ""),
            "sector_ja": sector.get("ja", ""),
        })
    return out


def load_sectors() -> list[dict]:
    return json.loads(SECTORS_PATH.read_text(encoding="utf-8"))["sectors"]


def fmt_int(n) -> str:
    if n is None:
        return "—"
    return f"{int(n):,}"


def risk_band(score) -> str:
    if score is None:
        return "mid"
    if score <= 3:
        return "low"
    if score <= 6:
        return "mid"
    return "high"


def render_rank_item(o: dict, show_salary: bool = True) -> str:
    title = o["title_ja"] or f"#{o['id']}"
    score = o["ai_risk"]
    score_str = "—" if score is None else f"{score}/10"
    band = risk_band(score)
    sector = o.get("sector_ja") or ""
    salary = o.get("salary")
    workers = o.get("workers")

    stats_parts = [f'<span class="risk-pill {band}">{escape(score_str)}</span>']
    if show_salary and salary:
        stats_parts.append(f'<span class="rl-salary">{int(salary)}万円</span>')
    if workers:
        stats_parts.append(f'<span class="rl-workers">{fmt_int(workers)}人</span>')

    sector_html = f'<span class="rl-sector">{escape(sector)}</span>' if sector else ""

    return (
        f'<li>'
        f'<div class="rl-main">'
        f'<a class="rl-name" href="/ja/{o["id"]}">{escape(title)}</a>'
        f'{sector_html}'
        f'</div>'
        f'<div class="rl-stats">{"".join(stats_parts)}</div>'
        f'</li>'
    )


def render_related_rankings(current_slug: str) -> str:
    rankings = [
        ("ai-risk-high", "AIに奪われる仕事 TOP30", "AI影響度が高い職業ランキング"),
        ("ai-risk-low", "AI影響が少ない仕事 TOP30", "AIリスクが低く将来性のある職業"),
        ("salary-safe", "高年収×低AIリスク TOP30", "年収が高くAI代替リスクが低い職業"),
        ("workers", "就業者数ランキング TOP30", "日本で最も就業者が多い職業"),
    ]
    items = []
    for slug, name, desc in rankings:
        if slug == current_slug:
            continue
        items.append(
            f'<li><a href="/ja/rankings/{slug}">'
            f'{escape(name)}'
            f'<span class="rr-desc">{escape(desc)}</span>'
            f'</a></li>'
        )
    return f'<ul class="related-rankings">{"".join(items)}</ul>'


def render_jsonld(canonical: str, title: str, description: str, items: list[dict]) -> str:
    item_list = []
    for i, o in enumerate(items, 1):
        item_list.append({
            "@type": "ListItem",
            "position": i,
            "url": f"{SITE}/ja/{o['id']}",
            "name": o["title_ja"] or f"#{o['id']}",
        })

    graph = [
        {
            "@type": "WebPage",
            "@id": f"{canonical}#webpage",
            "url": canonical,
            "name": title,
            "description": description,
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
                {"@type": "ListItem", "position": 1, "name": "未来の仕事", "item": f"{SITE}/"},
                {"@type": "ListItem", "position": 2, "name": "ランキング", "item": f"{SITE}/ja/rankings"},
                {"@type": "ListItem", "position": 3, "name": title, "item": canonical},
            ],
        },
        {
            "@type": "ItemList",
            "@id": f"{canonical}#list",
            "name": title,
            "numberOfItems": len(item_list),
            "itemListOrder": "https://schema.org/ItemListOrderDescending",
            "itemListElement": item_list,
        },
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)


def render_page(
    slug: str,
    title: str,
    seo_desc: str,
    h1_text: str,
    sub_text: str,
    intro_text: str,
    items: list[dict],
    stat_blocks: list[tuple[str, str]],
    show_salary: bool = True,
) -> str:
    canonical = f"{SITE}/ja/rankings/{slug}"
    og_title = title[:120]
    jsonld = render_jsonld(canonical, title, seo_desc, items)

    stats_html = ""
    if stat_blocks:
        cells = "".join(
            f'<div><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>'
            for label, value in stat_blocks
        )
        stats_html = f'<dl class="stats">{cells}</dl>'

    rank_items = "".join(render_rank_item(o, show_salary=show_salary) for o in items)
    related_html = render_related_rankings(slug)

    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>(function(){{try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}}})();</script>
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(seo_desc)}" />
    <meta name="robots" content="index, follow" />

    <link rel="canonical" href="{canonical}" />

    <link rel="dns-prefetch" href="//static.cloudflareinsights.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="未来の仕事 — Mirai Shigoto（非公式）" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:title" content="{escape(og_title)}" />
    <meta property="og:description" content="{escape(seo_desc)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="{SITE}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(og_title)}" />
    <meta name="twitter:description" content="{escape(seo_desc)}" />
    <meta name="twitter:image" content="{SITE}/og.png" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <script type="application/ld+json">
{jsonld}
    </script>

{ANALYTICS_BLOCK}

    <style>{CSS_BLOCK}</style>
  </head>
  <body>
    <a class="skip-link" href="#content">本文へスキップ</a>

    <div id="wrapper">
      <nav class="crumb" aria-label="パンくずリスト">
        <a href="/" rel="up">未来の仕事</a>
        <span aria-hidden="true">›</span>
        <a href="/ja/rankings" rel="up">ランキング</a>
        <span aria-hidden="true">›</span>
        <span>{escape(h1_text)}</span>
      </nav>

      <header id="content">
        <h1><span class="accent">{escape(h1_text)}</span></h1>
        <p class="sub">{sub_text}</p>
        <p class="intro">{escape(intro_text)}</p>
      </header>

      {stats_html}

      <section aria-label="ランキング">
        <h2>TOP {len(items)}</h2>
        <ol class="rank-list">
          {rank_items}
        </ol>
      </section>

      <section aria-label="他のランキング">
        <h2>他のランキング</h2>
        {related_html}
      </section>

      <footer>
        <div class="footer-links">
          <a href="/">トップ</a>
          <a href="/ja/sectors">セクター</a>
          <a href="/ja/rankings">ランキング</a>
        </div>
        <div class="footer-links">
          <a href="/about">データについて</a>
          <a href="/compliance">コンプライアンス</a>
          <a href="/privacy">プライバシー</a>
        </div>
        <div class="footer-meta">
          &copy; <a href="/">mirai-shigoto.com</a> &middot; MIT<br>
          出典：厚生労働省・JILPT「職業情報データベース（job tag）」 v7.00 を加工して作成。AI 影響度は Claude Opus 4.7 による独自スコア。政府公式の予測ではありません。
        </div>
      </footer>
    </div>
  </body>
</html>
"""


def render_index(rankings: list[tuple[str, str, str, int]]) -> str:
    canonical = f"{SITE}/ja/rankings"
    title = "職業ランキング｜AI影響度・年収・就業者数で比較 | 未来の仕事"
    seo_desc = "日本556職業をAI影響度・年収・就業者数で多角的にランキング。AIに奪われやすい仕事、AI影響が少ない職業、高年収×低AIリスクの職業などを一覧。"

    cards = []
    for slug, name, desc, count in rankings:
        cards.append(
            f'<li><a href="/ja/rankings/{slug}">'
            f'<span class="rr-title">{escape(name)}</span>'
            f'<span class="rr-desc">{escape(desc)}</span>'
            f'<span class="rr-count">{count} 職業</span>'
            f'</a></li>'
        )
    cards_html = "".join(cards)

    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": f"{canonical}#webpage",
                "url": canonical,
                "name": "職業ランキング",
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
                    {"@type": "ListItem", "position": 1, "name": "未来の仕事", "item": f"{SITE}/"},
                    {"@type": "ListItem", "position": 2, "name": "ランキング", "item": canonical},
                ],
            },
        ],
    }, ensure_ascii=False, indent=2)

    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>(function(){{try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}}})();</script>
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(seo_desc)}" />
    <meta name="robots" content="index, follow" />

    <link rel="canonical" href="{canonical}" />

    <link rel="dns-prefetch" href="//static.cloudflareinsights.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="未来の仕事 — Mirai Shigoto（非公式）" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:title" content="{escape(title)}" />
    <meta property="og:description" content="{escape(seo_desc)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="{SITE}/og.png" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(title)}" />
    <meta name="twitter:description" content="{escape(seo_desc)}" />
    <meta name="twitter:image" content="{SITE}/og.png" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <script type="application/ld+json">
{jsonld}
    </script>

{ANALYTICS_BLOCK}

    <style>{CSS_BLOCK}
.ranking-cards{{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}}
.ranking-cards li a{{display:block;padding:20px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--fg);transition:border-color 150ms,transform 150ms}}
.ranking-cards li a:hover{{border-color:var(--accent);transform:translateY(-1px)}}
.rr-title{{font-family:var(--font-serif);font-size:1.15rem;font-weight:600;display:block;margin-bottom:8px}}
.rr-desc{{font-size:.88rem;color:var(--fg2);display:block;margin-bottom:8px}}
.rr-count{{font-size:.78rem;color:var(--fg3);font-variant-numeric:tabular-nums}}</style>
  </head>
  <body>
    <a class="skip-link" href="#content">本文へスキップ</a>

    <div id="wrapper">
      <nav class="crumb" aria-label="パンくずリスト">
        <a href="/" rel="up">未来の仕事</a>
        <span aria-hidden="true">›</span>
        <span>ランキング</span>
      </nav>

      <header id="content">
        <h1><span class="accent">職業ランキング</span></h1>
        <p class="sub"><strong>556 職業</strong> を AI 影響度・年収・就業者数で多角的に比較</p>
        <p class="intro">日本の職業を様々な視点でランキング。AI に代替されやすい仕事、AI 影響が少なく将来性のある仕事、高年収かつ低リスクの職業などを一覧できます。</p>
      </header>

      <section aria-label="ランキング一覧">
        <h2>ランキング一覧</h2>
        <ul class="ranking-cards">
          {cards_html}
        </ul>
      </section>

      <footer>
        <div class="footer-links">
          <a href="/">トップ</a>
          <a href="/ja/sectors">セクター</a>
          <a href="/ja/rankings">ランキング</a>
        </div>
        <div class="footer-links">
          <a href="/about">データについて</a>
          <a href="/compliance">コンプライアンス</a>
          <a href="/privacy">プライバシー</a>
        </div>
        <div class="footer-meta">
          &copy; <a href="/">mirai-shigoto.com</a> &middot; MIT<br>
          出典：厚生労働省・JILPT「職業情報データベース（job tag）」 v7.00 を加工して作成。AI 影響度は Claude Opus 4.7 による独自スコア。政府公式の予測ではありません。
        </div>
      </footer>
    </div>
  </body>
</html>
"""


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    occs = load_occupations()
    bytes_total = 0

    scored = [o for o in occs if o["ai_risk"] is not None]
    with_salary = [o for o in occs if o.get("salary") and o["ai_risk"] is not None]

    # 1. AI risk high
    ai_high = sorted(scored, key=lambda o: (-o["ai_risk"], o["id"]))[:TOP_N]
    mean_high = sum(o["ai_risk"] for o in ai_high) / len(ai_high) if ai_high else 0
    html = render_page(
        slug="ai-risk-high",
        title="AIに奪われる仕事ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"AI影響度が最も高い職業TOP{TOP_N}を発表。平均スコア{mean_high:.1f}/10。各職業のAI代替リスク・年収・就業者数を一覧で比較。Claude Opus 4.7による独自分析（非公式）。",
        h1_text=f"AIに奪われる仕事 TOP{TOP_N}",
        sub_text=f"AI 影響度が最も <strong>高い</strong> 職業ランキング（{len(scored)} 職業中）",
        intro_text=f"厚労省の職業データに基づき、Claude Opus 4.7がタスクレベルでAI影響度を分析。10段階中スコアが高い職業ほど、業務の多くがAIで代替・補助される可能性があります。ただし「仕事がなくなる」という意味ではありません。",
        items=ai_high,
        stat_blocks=[
            ("対象職業数", f"{len(scored)}"),
            ("TOP30 平均 AI 影響", f"{mean_high:.1f} / 10"),
        ],
    )
    path = OUT_DIR / "ai-risk-high.html"
    path.write_text(html, encoding="utf-8")
    bytes_total += path.stat().st_size

    # 2. AI risk low
    ai_low = sorted(scored, key=lambda o: (o["ai_risk"], o["id"]))[:TOP_N]
    mean_low = sum(o["ai_risk"] for o in ai_low) / len(ai_low) if ai_low else 0
    html = render_page(
        slug="ai-risk-low",
        title="AI影響が少ない仕事ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"AIに代替されにくい職業TOP{TOP_N}。平均スコア{mean_low:.1f}/10。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。Claude Opus 4.7独自分析（非公式）。",
        h1_text=f"AI影響が少ない仕事 TOP{TOP_N}",
        sub_text=f"AI 影響度が最も <strong>低い</strong> 職業ランキング（{len(scored)} 職業中）",
        intro_text=f"身体性・対人関係・創造性が求められる職業はAIによる代替が難しく、スコアが低くなる傾向があります。「AIに奪われない仕事」をお探しの方に、将来性の高い職業を年収データと共に紹介します。",
        items=ai_low,
        stat_blocks=[
            ("対象職業数", f"{len(scored)}"),
            ("TOP30 平均 AI 影響", f"{mean_low:.1f} / 10"),
        ],
    )
    path = OUT_DIR / "ai-risk-low.html"
    path.write_text(html, encoding="utf-8")
    bytes_total += path.stat().st_size

    # 3. Salary × safe (high salary, low AI risk)
    salary_safe = sorted(
        [o for o in with_salary if o["ai_risk"] <= 5],
        key=lambda o: (-(o["salary"] or 0), o["ai_risk"], o["id"]),
    )[:TOP_N]
    mean_salary = sum(o["salary"] for o in salary_safe) / len(salary_safe) if salary_safe else 0
    mean_risk_ss = sum(o["ai_risk"] for o in salary_safe) / len(salary_safe) if salary_safe else 0
    html = render_page(
        slug="salary-safe",
        title="高年収×低AIリスクの職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"年収が高くAI代替リスクが低い職業TOP{TOP_N}。平均年収{int(mean_salary)}万円・平均AI影響{mean_risk_ss:.1f}/10。将来性と収入を両立できる仕事を一覧。",
        h1_text=f"高年収×低AIリスク TOP{TOP_N}",
        sub_text="年収が高く、かつ AI 影響度が <strong>5以下</strong> の職業",
        intro_text="高い年収を得ながらAIに代替されにくい——そんな職業を探している方へ。AI影響度5以下（10段階）かつ年収が高い順にランキングしました。",
        items=salary_safe,
        stat_blocks=[
            ("TOP30 平均年収", f"{int(mean_salary)} 万円"),
            ("TOP30 平均 AI 影響", f"{mean_risk_ss:.1f} / 10"),
        ],
    )
    path = OUT_DIR / "salary-safe.html"
    path.write_text(html, encoding="utf-8")
    bytes_total += path.stat().st_size

    # 4. Workers (biggest workforce)
    by_workers = sorted(
        [o for o in occs if o.get("workers")],
        key=lambda o: -(o["workers"] or 0),
    )[:TOP_N]
    total_workers = sum(o["workers"] for o in by_workers)
    html = render_page(
        slug="workers",
        title="就業者数が多い職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"日本で最も就業者が多い職業TOP{TOP_N}を一覧。合計{fmt_int(total_workers)}人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。",
        h1_text=f"就業者数ランキング TOP{TOP_N}",
        sub_text=f"日本で最も <strong>就業者が多い</strong> 職業",
        intro_text="厚労省の職業情報データベース（job tag）に基づく就業者数ランキング。最も多くの人が従事している職業をAI影響度・年収データと共に一覧できます。",
        items=by_workers,
        stat_blocks=[
            ("TOP30 合計就業者数", f"{fmt_int(total_workers)} 人"),
        ],
        show_salary=True,
    )
    path = OUT_DIR / "workers.html"
    path.write_text(html, encoding="utf-8")
    bytes_total += path.stat().st_size

    # 5. Index page
    rankings_meta = [
        ("ai-risk-high", "AIに奪われる仕事 TOP30", "AI影響度が高い職業ランキング", len(ai_high)),
        ("ai-risk-low", "AI影響が少ない仕事 TOP30", "AIリスクが低く将来性のある職業", len(ai_low)),
        ("salary-safe", "高年収×低AIリスク TOP30", "年収が高くAI代替リスクが低い職業", len(salary_safe)),
        ("workers", "就業者数ランキング TOP30", "日本で最も就業者が多い職業", len(by_workers)),
    ]
    idx_html = render_index(rankings_meta)
    idx_path = OUT_DIR / "index.html"
    idx_path.write_text(idx_html, encoding="utf-8")
    bytes_total += idx_path.stat().st_size

    pages = 5  # 4 ranking pages + 1 index
    print(f"Generated {pages} ranking pages → ja/rankings/")
    print(f"Total size: {bytes_total / 1024:.1f} KB")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
