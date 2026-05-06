#!/usr/bin/env python3
"""
build_rankings.py — generate aggregate ranking pages for SEO.

Output (10 pages):
  ja/rankings/index.html            — rankings hub (global stats + insights)
  ja/rankings/ai-risk-high.html     — top 30 highest AI risk
  ja/rankings/ai-risk-low.html      — top 30 lowest AI risk
  ja/rankings/salary-safe.html      — high salary + low AI risk
  ja/rankings/workers.html          — top 30 by workforce size
  ja/rankings/salary.html           — top 30 by salary
  ja/rankings/entry-salary.html     — top 30 by entry-level salary
  ja/rankings/young-workforce.html  — top 30 youngest average age
  ja/rankings/short-hours.html      — top 30 shortest monthly hours
  ja/rankings/high-demand.html      — top 30 highest job demand

Usage:
  python3 scripts/build_rankings.py
"""
from __future__ import annotations

import json
from collections import Counter
from html import escape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DETAIL_DIR = REPO / "dist" / "data.detail"
SECTORS_PATH = REPO / "data" / "sectors" / "sectors.ja-en.json"
OUT_DIR = REPO / "ja" / "rankings"

# Single source of truth for the site-wide footer (see partials/footer.html
# and scripts/build_partials.py).
def _get_last_commit_datetime() -> tuple[str, str]:
    """Return (display, iso) of latest git commit datetime, normalized to JST."""
    import subprocess
    from datetime import datetime, timedelta, timezone
    jst = timezone(timedelta(hours=9))
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI"],
            capture_output=True, text=True, cwd=REPO, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            dt = datetime.fromisoformat(result.stdout.strip()).astimezone(jst)
            return dt.strftime("%Y/%m/%d/%H:%M"), dt.isoformat(timespec="seconds")
    except Exception:
        pass
    now = datetime.now(jst)
    return now.strftime("%Y/%m/%d/%H:%M"), now.isoformat(timespec="seconds")


_LAST_DISPLAY, _LAST_ISO = _get_last_commit_datetime()
FOOTER_PARTIAL = (
    (REPO / "partials" / "footer.html").read_text(encoding="utf-8").rstrip("\n")
    .replace("{{LAST_UPDATED_ISO}}", _LAST_ISO)
    .replace("{{LAST_UPDATED}}", _LAST_DISPLAY)
)
SITE = "https://mirai-shigoto.com"
DATE_PUBLISHED = "2026-05-06"
DATE_MODIFIED = "2026-05-06"
TOP_N = 30

DEMAND_SCORE: dict[str, int] = {"hot": 4, "warm": 3, "cool": 2, "cold": 1}
DEMAND_JA: dict[str, str] = {"hot": "需要高", "warm": "やや高", "cool": "安定", "cold": "低"}

ALL_RANKINGS: list[tuple[str, str, str]] = [
    ("ai-risk-high", "AIに奪われる仕事 TOP30", "AI影響度が高い職業ランキング"),
    ("ai-risk-low", "AI影響が少ない仕事 TOP30", "AIリスクが低く将来性のある職業"),
    ("salary-safe", "高年収×低AIリスク TOP30", "年収が高くAI代替リスクが低い職業"),
    ("workers", "就業者数ランキング TOP30", "日本で最も就業者が多い職業"),
    ("salary", "年収ランキング TOP30", "年収が最も高い職業"),
    ("entry-salary", "初任給ランキング TOP30", "初任給が高い職業"),
    ("young-workforce", "平均年齢が若い職業 TOP30", "若手が活躍する職業"),
    ("short-hours", "労働時間が短い職業 TOP30", "ワークライフバランスに優れた職業"),
    ("high-demand", "人手不足の職業 TOP30", "求人需要が高い職業"),
]

FAQS: dict[str, list[tuple[str, str]]] = {
    "ai-risk-high": [
        ("AIに奪われやすい仕事の特徴は？", "データ入力・定型処理・パターン認識が中心の業務はAI代替リスクが高い傾向にあります。反復的なルーティンワークほどスコアが高くなります。"),
        ("AIリスクが高い仕事は将来なくなりますか？", "「なくなる」のではなく「変わる」可能性が高いです。AIはタスクの一部を代替・補助しますが、職業そのものが消滅するとは限りません。"),
        ("AIリスクが高い職業から転職するには？", "身体性・対人スキル・創造性を活かせる職種への転換が有効です。同セクター内でより安全な職業を探すのも一つの方法です。"),
    ],
    "ai-risk-low": [
        ("AIに奪われない仕事の共通点は？", "身体的な動作、対面での人間関係構築、高度な状況判断が必要な職業はAI代替が難しい傾向にあります。"),
        ("AI影響度が低い仕事は将来安泰ですか？", "AI代替リスクは低いですが、少子高齢化や産業構造変化など他の要因も考慮が必要です。"),
        ("AIリスクが低くて年収も高い職業は？", "医師・弁護士・建設系専門職などが該当します。「高年収×低AIリスク」ランキングもご覧ください。"),
    ],
    "salary-safe": [
        ("年収が高くてAIに奪われにくい仕事は？", "医師・法律専門家・建設系技術者などが代表的です。専門性と対人スキルの組み合わせが強みになっています。"),
        ("高年収×低AIリスクの職業に就くには？", "多くが国家資格や高度な専門教育を必要としますが、建設・保安分野では実務経験重視のキャリアパスもあります。"),
        ("AIリスクが低くても年収に差があるのはなぜ？", "必要な資格の難易度、労働条件、需給バランスなどが年収を左右します。"),
    ],
    "workers": [
        ("日本で最も就業者が多い職業は？", "一般事務職が最も多く、次いで販売・接客系の職業が続きます。生活に密接な職業ほど就業者が多い傾向です。"),
        ("就業者が多い職業のAIリスクは？", "事務・販売系は比較的AI影響度が高い傾向にあり、大規模な職業構造の変化が予想されます。"),
        ("就業者数と求人数は比例しますか？", "必ずしも比例しません。就業者が多くても離職率が低ければ求人は少なく、人手不足の分野では就業者が少なくても求人が多い場合があります。"),
    ],
    "salary": [
        ("日本で最も年収が高い職業は？", "医師・パイロット・弁護士など高度な専門資格を必要とする職業が上位に入ります。"),
        ("高年収の職業に共通する特徴は？", "高度な資格・長期の教育投資・強い参入障壁のいずれかを持つ職業が多い傾向にあります。"),
        ("AI時代でも高年収を維持できる職業は？", "身体性や対人関係が重要な高専門職はAI影響度が低く、高年収を維持しやすいと考えられます。"),
    ],
    "entry-salary": [
        ("初任給が高い職業は？", "IT系エンジニア・医療系専門職・法律系など、即戦力としての専門知識が評価される職業が上位です。"),
        ("初任給と平均年収の関係は？", "初任給が高い職業は平均年収も高い傾向にありますが、昇給カーブは職種によって大きく異なります。"),
        ("新卒で高い初任給を得るには？", "理工系・医療系の専門学位、IT関連の資格やスキルが評価される傾向にあります。"),
    ],
    "young-workforce": [
        ("若い人が多い職業の特徴は？", "IT・クリエイティブ・サービス業など、比較的新しい産業や体力を要する職種で平均年齢が低い傾向にあります。"),
        ("平均年齢が低い職業は離職率が高い？", "一概には言えませんが、若年層が多い職種では業界内の流動性が高い傾向にあります。"),
        ("若い人が多い職業のAIリスクは？", "IT系は高め、サービス・建設系は低めと、業種によって二極化しています。"),
    ],
    "short-hours": [
        ("残業が少ない職業は？", "教育系・公務系・一部の専門職で月間労働時間が短い傾向にあります。データは統計上の平均値です。"),
        ("労働時間が短くて年収が高い職業は？", "医師（一部の科）・大学教員・法律専門家などが該当しますが、個人差が大きい点に注意が必要です。"),
        ("ワークライフバランスの良い職業の見つけ方は？", "労働時間だけでなく、勤務時間帯の柔軟性やリモートワーク可否なども合わせて検討すると良いでしょう。"),
    ],
    "high-demand": [
        ("今、最も求人が多い職業は？", "介護・建設・IT系が人手不足の傾向が強く、求人需要が高い状態が続いています。"),
        ("人手不足の職業は年収が上がる？", "需要と供給のバランスから、人手不足の職業では賃金上昇圧力が生じやすい傾向にあります。"),
        ("求人需要が高い職業に転職するメリットは？", "採用されやすく待遇改善の交渉もしやすい傾向にあります。ただし人手不足の理由も確認が重要です。"),
    ],
}


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
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:32px 0}
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
.demand-pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums}
.demand-pill.hot{background:#E0EAE2;color:#48705F}
.demand-pill.warm{background:#F4E5C7;color:#8A6A2A}
.demand-pill.cool{background:#D8E4F0;color:#3A5F7A}
.demand-pill.cold{background:#E8E4DF;color:#7A6F5E}
:root[data-theme="dark"] .demand-pill.hot{background:#2A3D34;color:#9DC4AD}
:root[data-theme="dark"] .demand-pill.warm{background:#3D3424;color:#D4B97E}
:root[data-theme="dark"] .demand-pill.cool{background:#253040;color:#8AB4D8}
:root[data-theme="dark"] .demand-pill.cold{background:#2E2722;color:#B8AC95}
.rl-salary,.rl-workers,.rl-extra{font-size:.82rem;color:var(--fg2);font-variant-numeric:tabular-nums}
.rl-extra{color:var(--accent-deep);font-weight:600}
.highlights{margin:24px 0}
.highlights ul{list-style:none;display:flex;flex-direction:column;gap:8px}
.highlights li{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent-deep);padding:10px 16px;border-radius:0 6px 6px 0;font-size:.9rem;color:var(--fg)}
.sector-chart{margin:24px 0}
.sc-title{font-size:.85rem;color:var(--fg2);margin-bottom:10px;font-weight:500}
.sb-row{display:grid;grid-template-columns:110px 1fr 44px;gap:8px;align-items:center;margin-bottom:5px;font-size:.8rem}
.sb-label{color:var(--fg2);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-track{height:14px;background:var(--bg3);border-radius:3px;overflow:hidden}
.sb-fill{display:block;height:100%;background:var(--accent-deep);border-radius:3px;min-width:3px;transition:width .3s}
.sb-count{color:var(--fg3);font-variant-numeric:tabular-nums;text-align:right}
.faq{margin:48px 0}
.faq details{background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-bottom:8px}
.faq summary{padding:14px 18px;cursor:pointer;font-weight:500;font-size:.95rem;color:var(--fg);list-style:none}
.faq summary::before{content:"Q. ";color:var(--accent);font-weight:700}
.faq summary::-webkit-details-marker{display:none}
.faq .faq-a{padding:0 18px 14px;font-size:.9rem;color:var(--fg2);line-height:1.7}
.related-rankings{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;list-style:none}
.related-rankings li a{display:block;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--fg);font-weight:500;transition:border-color 150ms}
.related-rankings li a:hover{border-color:var(--accent);color:var(--accent-deep)}
.related-rankings .rr-desc{display:block;font-size:.82rem;color:var(--fg2);font-weight:400;margin-top:4px}
.insights{margin:48px 0}
.insights ul{list-style:none;display:flex;flex-direction:column;gap:8px}
.insights li{background:var(--bg2);border:1px solid var(--border);padding:12px 16px;border-radius:6px;font-size:.9rem;color:var(--fg)}
.insights li strong{color:var(--accent-deep)}
footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--border);font-size:.85rem;color:var(--fg2);text-align:center}
footer .footer-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin-bottom:14px}
footer .footer-links a{color:var(--fg2);text-decoration:none;padding:5px 14px;border:1px solid var(--border);border-radius:999px;font-size:.78rem;line-height:1.2;transition:color 150ms ease,border-color 150ms ease,background 150ms ease}
footer .footer-links a:hover{color:var(--accent);border-color:var(--accent);background:rgba(217,107,61,0.06);text-decoration:none}
footer .footer-meta{color:var(--fg2);font-size:.7rem;opacity:.92;text-wrap:pretty;line-height:1.65}
footer .footer-meta a{color:var(--accent)}
footer .footer-meta .nowrap{white-space:nowrap}
@media (max-width:540px){footer .footer-meta{font-size:.66rem;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere}}
@media (max-width:600px){#wrapper{padding:20px 16px 60px}.rank-list li{grid-template-columns:28px 1fr;gap:10px}.rank-list .rl-stats{margin-top:6px}.sb-row{grid-template-columns:80px 1fr 36px}}
"""


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

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
            "monthly_hours": stats.get("monthly_hours"),
            "average_age": stats.get("average_age"),
            "recruit_wage": stats.get("recruit_wage_man_yen"),
            "demand_band": d.get("demand_band"),
            "sector_id": sector.get("id", ""),
            "sector_ja": sector.get("ja", ""),
        })
    return out


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

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


def safe_mean(items: list[dict], key: str) -> float:
    vals = [o[key] for o in items if o.get(key) is not None]
    return sum(vals) / len(vals) if vals else 0


def top_sector(items: list[dict]) -> tuple[str, int]:
    sectors = Counter(o["sector_ja"] for o in items if o.get("sector_ja"))
    if not sectors:
        return ("", 0)
    return sectors.most_common(1)[0]


# ---------------------------------------------------------------------------
# Render components
# ---------------------------------------------------------------------------

def render_rank_item(
    o: dict,
    show_salary: bool = True,
    extra_cols: list[str] | None = None,
) -> str:
    title = o["title_ja"] or f"#{o['id']}"
    score = o["ai_risk"]
    score_str = "—" if score is None else f"{score}/10"
    band = risk_band(score)
    sector = o.get("sector_ja") or ""
    salary = o.get("salary")
    workers = o.get("workers")

    stats_parts = [f'<span class="risk-pill {band}">{escape(score_str)}</span>']
    if extra_cols:
        stats_parts.extend(extra_cols)
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


def render_highlights(items: list[dict], slug: str) -> str:
    if not items:
        return ""
    hl: list[str] = []
    top = items[0]
    name = top["title_ja"] or ""

    if slug in ("ai-risk-high", "ai-risk-low"):
        score = top["ai_risk"]
        hl.append(f'1位は「{name}」（AI影響度 {score}/10）')
    elif slug == "salary":
        hl.append(f'1位は「{name}」（年収 {int(top["salary"])}万円）')
    elif slug == "entry-salary":
        hl.append(f'1位は「{name}」（初任給 {int(top["recruit_wage"])}万円）')
    elif slug == "young-workforce":
        hl.append(f'1位は「{name}」（平均年齢 {top["average_age"]:.1f}歳）')
    elif slug == "short-hours":
        hl.append(f'1位は「{name}」（月間 {int(top["monthly_hours"])}時間）')
    elif slug == "high-demand":
        hl.append(f'1位は「{name}」（求人需要：{DEMAND_JA.get(top.get("demand_band", ""), "")}）')
    else:
        hl.append(f'1位は「{name}」')

    sec, cnt = top_sector(items)
    if sec:
        hl.append(f'TOP{len(items)}の中で「{sec}」セクターが{cnt}件と最多')

    mean_sal = safe_mean(items, "salary")
    mean_risk = safe_mean(items, "ai_risk")
    if mean_sal > 0:
        hl.append(f'TOP{len(items)}の平均年収は{int(mean_sal)}万円、平均AI影響度は{mean_risk:.1f}/10')

    items_html = "".join(f"<li>{escape(h)}</li>" for h in hl)
    return f'<div class="highlights"><ul>{items_html}</ul></div>'


def render_sector_chart(items: list[dict]) -> str:
    sectors = Counter(o["sector_ja"] for o in items if o.get("sector_ja"))
    if not sectors:
        return ""
    ordered = sectors.most_common()
    max_count = ordered[0][1] if ordered else 1
    rows = []
    for sec, cnt in ordered[:6]:
        pct = int(cnt / max_count * 100)
        rows.append(
            f'<div class="sb-row">'
            f'<span class="sb-label">{escape(sec)}</span>'
            f'<span class="sb-track"><span class="sb-fill" style="width:{pct}%"></span></span>'
            f'<span class="sb-count">{cnt}件</span>'
            f'</div>'
        )
    return (
        f'<div class="sector-chart">'
        f'<div class="sc-title">セクター内訳（TOP{len(items)}）</div>'
        f'{"".join(rows)}'
        f'</div>'
    )


def render_faq_html(faq_items: list[tuple[str, str]]) -> str:
    if not faq_items:
        return ""
    details = []
    for q, a in faq_items:
        details.append(
            f'<details><summary>{escape(q)}</summary>'
            f'<div class="faq-a">{escape(a)}</div></details>'
        )
    return (
        f'<section class="faq" aria-label="よくある質問">'
        f'<h2>よくある質問</h2>'
        f'{"".join(details)}'
        f'</section>'
    )


def render_related_rankings(current_slug: str) -> str:
    items = []
    for slug, name, desc in ALL_RANKINGS:
        if slug == current_slug:
            continue
        items.append(
            f'<li><a href="/ja/rankings/{slug}">'
            f'{escape(name)}'
            f'<span class="rr-desc">{escape(desc)}</span>'
            f'</a></li>'
        )
    return f'<ul class="related-rankings">{"".join(items)}</ul>'


def render_jsonld(
    canonical: str,
    title: str,
    description: str,
    items: list[dict],
    faq_items: list[tuple[str, str]] | None = None,
) -> str:
    item_list = [
        {
            "@type": "ListItem",
            "position": i,
            "url": f"{SITE}/ja/{o['id']}",
            "name": o["title_ja"] or f"#{o['id']}",
        }
        for i, o in enumerate(items, 1)
    ]

    graph: list[dict] = [
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
        # SEO Phase 9: Article schema — frames ranking pages as editorial content
        # for content/article-rich-snippet eligibility (vs pure data list).
        {
            "@type": "Article",
            "@id": f"{canonical}#article",
            "headline": title,
            "description": description,
            "image": f"{SITE}/og.png",
            "url": canonical,
            "datePublished": DATE_PUBLISHED,
            "dateModified": DATE_MODIFIED,
            "author": {"@id": f"{SITE}/#organization"},
            "publisher": {"@id": f"{SITE}/#organization"},
            "inLanguage": "ja",
            "mainEntityOfPage": {"@id": f"{canonical}#webpage"},
            "isPartOf": {"@id": f"{canonical}#webpage"},
            "articleSection": "ランキング",
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

    if faq_items:
        graph.append({
            "@type": "FAQPage",
            "@id": f"{canonical}#faq",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": q,
                    "acceptedAnswer": {"@type": "Answer", "text": a},
                }
                for q, a in faq_items
            ],
        })

    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Page templates
# ---------------------------------------------------------------------------

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
    extra_col_fn: callable | None = None,
    faq_items: list[tuple[str, str]] | None = None,
) -> str:
    canonical = f"{SITE}/ja/rankings/{slug}"
    og_title = title[:120]
    jsonld = render_jsonld(canonical, title, seo_desc, items, faq_items=faq_items)

    stats_html = ""
    if stat_blocks:
        cells = "".join(
            f'<div><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>'
            for label, value in stat_blocks
        )
        stats_html = f'<dl class="stats">{cells}</dl>'

    highlights_html = render_highlights(items, slug)
    sector_html = render_sector_chart(items)

    rank_items_parts: list[str] = []
    for o in items:
        extra = extra_col_fn(o) if extra_col_fn else None
        rank_items_parts.append(render_rank_item(o, show_salary=show_salary, extra_cols=extra))
    rank_items = "".join(rank_items_parts)

    faq_html = render_faq_html(faq_items) if faq_items else ""
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
      {highlights_html}
      {sector_html}

      <section aria-label="ランキング">
        <h2>TOP {len(items)}</h2>
        <ol class="rank-list">
          {rank_items}
        </ol>
      </section>

      {faq_html}

      <section aria-label="他のランキング">
        <h2>他のランキング</h2>
        {related_html}
      </section>

      <!-- FOOTER:START -->
      {FOOTER_PARTIAL}
      <!-- FOOTER:END -->
    </div>
  </body>
</html>
"""


def render_index(
    rankings_meta: list[tuple[str, str, str, int, str]],
    global_stats: list[tuple[str, str]],
    insights: list[str],
) -> str:
    canonical = f"{SITE}/ja/rankings"
    title = "職業ランキング｜AI影響度・年収・就業者数・初任給・労働時間で比較 | 未来の仕事"
    seo_desc = "日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに奪われやすい仕事、高年収×低AIリスクの職業などを一覧。"

    cards = []
    for slug, name, desc, count, preview in rankings_meta:
        preview_html = f'<span class="rr-preview">{escape(preview)}</span>' if preview else ""
        cards.append(
            f'<li><a href="/ja/rankings/{slug}">'
            f'<span class="rr-title">{escape(name)}</span>'
            f'<span class="rr-desc">{escape(desc)}</span>'
            f'{preview_html}'
            f'<span class="rr-count">{count} 職業</span>'
            f'</a></li>'
        )
    cards_html = "".join(cards)

    gs_cells = "".join(
        f'<div><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>'
        for label, value in global_stats
    )
    gs_html = f'<dl class="stats">{gs_cells}</dl>' if global_stats else ""

    insights_items = "".join(f"<li>{h}</li>" for h in insights)
    insights_html = (
        f'<section class="insights" aria-label="データから見える傾向">'
        f'<h2>データから見える傾向</h2>'
        f'<ul>{insights_items}</ul>'
        f'</section>'
    ) if insights else ""

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
.rr-desc{{font-size:.88rem;color:var(--fg2);display:block;margin-bottom:6px}}
.rr-preview{{display:block;font-size:.78rem;color:var(--accent-deep);margin-bottom:6px;font-weight:500}}
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
        <p class="sub"><strong>556 職業</strong> を AI 影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点で比較</p>
        <p class="intro">日本の職業を様々な視点でランキング。AI に代替されやすい仕事、将来性のある仕事、高年収かつ低リスクの職業、初任給が高い職業、労働時間が短い職業、人手不足の職業などを一覧できます。</p>
      </header>

      {gs_html}

      <section aria-label="ランキング一覧">
        <h2>ランキング一覧</h2>
        <ul class="ranking-cards">
          {cards_html}
        </ul>
      </section>

      {insights_html}

      <!-- FOOTER:START -->
      {FOOTER_PARTIAL}
      <!-- FOOTER:END -->
    </div>
  </body>
</html>
"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def make_preview(items: list[dict], metric_fn) -> str:
    if not items:
        return ""
    top = items[0]
    name = top["title_ja"] or ""
    return f"\U0001f947 {name}（{metric_fn(top)}）"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    occs = load_occupations()
    bytes_total = 0
    pages_written = 0

    scored = [o for o in occs if o["ai_risk"] is not None]
    with_salary = [o for o in occs if o.get("salary") and o["ai_risk"] is not None]
    all_mean_risk = safe_mean(scored, "ai_risk")
    all_mean_salary = safe_mean([o for o in occs if o.get("salary")], "salary")
    all_workers = sum(o["workers"] for o in occs if o.get("workers"))

    def write_page(filename: str, html: str) -> int:
        path = OUT_DIR / filename
        path.write_text(html, encoding="utf-8")
        return path.stat().st_size

    # --- Ranking data preparation ---

    # 1. AI risk high
    ai_high = sorted(scored, key=lambda o: (-o["ai_risk"], o["id"]))[:TOP_N]
    mean_high = safe_mean(ai_high, "ai_risk")

    # 2. AI risk low
    ai_low = sorted(scored, key=lambda o: (o["ai_risk"], o["id"]))[:TOP_N]
    mean_low = safe_mean(ai_low, "ai_risk")

    # 3. Salary x safe
    salary_safe = sorted(
        [o for o in with_salary if o["ai_risk"] <= 5],
        key=lambda o: (-(o["salary"] or 0), o["ai_risk"], o["id"]),
    )[:TOP_N]
    mean_salary_ss = safe_mean(salary_safe, "salary")
    mean_risk_ss = safe_mean(salary_safe, "ai_risk")

    # 4. Workers
    by_workers = sorted(
        [o for o in occs if o.get("workers")],
        key=lambda o: -(o["workers"] or 0),
    )[:TOP_N]
    total_workers_top = sum(o["workers"] for o in by_workers)

    # 5. Salary (pure)
    by_salary = sorted(
        [o for o in occs if o.get("salary")],
        key=lambda o: (-(o["salary"] or 0), o["id"]),
    )[:TOP_N]
    mean_salary_top = safe_mean(by_salary, "salary")

    # 6. Entry salary
    by_entry = sorted(
        [o for o in occs if o.get("recruit_wage")],
        key=lambda o: (-(o["recruit_wage"] or 0), o["id"]),
    )[:TOP_N]
    mean_entry = safe_mean(by_entry, "recruit_wage")

    # 7. Young workforce
    by_young = sorted(
        [o for o in occs if o.get("average_age")],
        key=lambda o: (o["average_age"], o["id"]),
    )[:TOP_N]
    mean_age_young = safe_mean(by_young, "average_age")

    # 8. Short hours
    by_hours = sorted(
        [o for o in occs if o.get("monthly_hours")],
        key=lambda o: (o["monthly_hours"], o["id"]),
    )[:TOP_N]
    mean_hours = safe_mean(by_hours, "monthly_hours")

    # 9. High demand
    with_demand = [o for o in occs if o.get("demand_band") and DEMAND_SCORE.get(o["demand_band"], 0) >= 3]
    if len(with_demand) < TOP_N:
        with_demand = [o for o in occs if o.get("demand_band")]
    by_demand = sorted(
        with_demand,
        key=lambda o: (-DEMAND_SCORE.get(o.get("demand_band", ""), 0), -(o.get("salary") or 0), o["id"]),
    )[:TOP_N]
    hot_count = sum(1 for o in by_demand if o.get("demand_band") == "hot")
    warm_count = sum(1 for o in by_demand if o.get("demand_band") == "warm")

    # --- Generate ranking pages ---

    bytes_total += write_page("ai-risk-high.html", render_page(
        slug="ai-risk-high",
        title="AIに奪われる仕事ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"AI影響度が最も高い職業TOP{TOP_N}。平均スコア{mean_high:.1f}/10。AI代替リスク・年収・就業者数を一覧比較。Claude Opus 4.7独自分析（非公式）。",
        h1_text=f"AIに奪われる仕事 TOP{TOP_N}",
        sub_text=f"AI 影響度が最も <strong>高い</strong> 職業ランキング（{len(scored)} 職業中）",
        intro_text="厚労省の職業データに基づき、Claude Opus 4.7がタスクレベルでAI影響度を分析。10段階中スコアが高い職業ほど、業務の多くがAIで代替・補助される可能性があります。ただし「仕事がなくなる」という意味ではありません。",
        items=ai_high,
        stat_blocks=[
            ("対象職業数", f"{len(scored)}"),
            ("TOP30 平均 AI 影響", f"{mean_high:.1f} / 10"),
            ("TOP30 平均年収", f"{int(safe_mean(ai_high, 'salary'))} 万円"),
            ("TOP30 平均年齢", f"{safe_mean(ai_high, 'average_age'):.1f} 歳"),
        ],
        faq_items=FAQS["ai-risk-high"],
    ))
    pages_written += 1

    bytes_total += write_page("ai-risk-low.html", render_page(
        slug="ai-risk-low",
        title="AI影響が少ない仕事ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"AIに代替されにくい職業TOP{TOP_N}。平均スコア{mean_low:.1f}/10。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。",
        h1_text=f"AI影響が少ない仕事 TOP{TOP_N}",
        sub_text=f"AI 影響度が最も <strong>低い</strong> 職業ランキング（{len(scored)} 職業中）",
        intro_text="身体性・対人関係・創造性が求められる職業はAIによる代替が難しく、スコアが低くなる傾向があります。「AIに奪われない仕事」をお探しの方に、将来性の高い職業を年収データと共に紹介します。",
        items=ai_low,
        stat_blocks=[
            ("対象職業数", f"{len(scored)}"),
            ("TOP30 平均 AI 影響", f"{mean_low:.1f} / 10"),
            ("TOP30 平均年収", f"{int(safe_mean(ai_low, 'salary'))} 万円"),
            ("TOP30 平均年齢", f"{safe_mean(ai_low, 'average_age'):.1f} 歳"),
        ],
        faq_items=FAQS["ai-risk-low"],
    ))
    pages_written += 1

    bytes_total += write_page("salary-safe.html", render_page(
        slug="salary-safe",
        title="高年収×低AIリスクの職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"年収が高くAI代替リスクが低い職業TOP{TOP_N}。平均年収{int(mean_salary_ss)}万円・平均AI影響{mean_risk_ss:.1f}/10。将来性と収入を両立できる仕事を一覧。",
        h1_text=f"高年収×低AIリスク TOP{TOP_N}",
        sub_text="年収が高く、かつ AI 影響度が <strong>5以下</strong> の職業",
        intro_text="高い年収を得ながらAIに代替されにくい——そんな職業を探している方へ。AI影響度5以下（10段階）かつ年収が高い順にランキングしました。",
        items=salary_safe,
        stat_blocks=[
            ("TOP30 平均年収", f"{int(mean_salary_ss)} 万円"),
            ("TOP30 平均 AI 影響", f"{mean_risk_ss:.1f} / 10"),
            ("TOP30 平均年齢", f"{safe_mean(salary_safe, 'average_age'):.1f} 歳"),
        ],
        faq_items=FAQS["salary-safe"],
    ))
    pages_written += 1

    bytes_total += write_page("workers.html", render_page(
        slug="workers",
        title="就業者数が多い職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"日本で最も就業者が多い職業TOP{TOP_N}。合計{fmt_int(total_workers_top)}人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。",
        h1_text=f"就業者数ランキング TOP{TOP_N}",
        sub_text="日本で最も <strong>就業者が多い</strong> 職業",
        intro_text="厚労省の職業情報データベース（job tag）に基づく就業者数ランキング。最も多くの人が従事している職業をAI影響度・年収データと共に一覧できます。",
        items=by_workers,
        stat_blocks=[
            ("TOP30 合計就業者数", f"{fmt_int(total_workers_top)} 人"),
            ("TOP30 平均 AI 影響", f"{safe_mean(by_workers, 'ai_risk'):.1f} / 10"),
            ("TOP30 平均年収", f"{int(safe_mean(by_workers, 'salary'))} 万円"),
        ],
        faq_items=FAQS["workers"],
    ))
    pages_written += 1

    # 5. Salary (pure)
    bytes_total += write_page("salary.html", render_page(
        slug="salary",
        title="年収が高い職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"日本で最も年収が高い職業TOP{TOP_N}。平均年収{int(mean_salary_top)}万円。AI影響度・就業者数も合わせて比較。",
        h1_text=f"年収ランキング TOP{TOP_N}",
        sub_text=f"年収が最も <strong>高い</strong> 職業ランキング",
        intro_text="厚労省の職業情報データベースに基づく年収ランキング。年収が高い職業をAI影響度・就業者数と共に一覧できます。",
        items=by_salary,
        stat_blocks=[
            ("TOP30 平均年収", f"{int(mean_salary_top)} 万円"),
            ("TOP30 平均 AI 影響", f"{safe_mean(by_salary, 'ai_risk'):.1f} / 10"),
            ("TOP30 平均年齢", f"{safe_mean(by_salary, 'average_age'):.1f} 歳"),
            ("TOP30 平均月間労働", f"{int(safe_mean(by_salary, 'monthly_hours'))} 時間"),
        ],
        faq_items=FAQS["salary"],
    ))
    pages_written += 1

    # 6. Entry salary
    def entry_extra(o: dict) -> list[str]:
        rw = o.get("recruit_wage")
        if rw:
            return [f'<span class="rl-extra">初任給 {int(rw)}万円</span>']
        return []

    bytes_total += write_page("entry-salary.html", render_page(
        slug="entry-salary",
        title="初任給が高い職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"初任給が最も高い職業TOP{TOP_N}。平均初任給{int(mean_entry)}万円。年収・AI影響度も合わせて比較。就活・転職の参考に。",
        h1_text=f"初任給ランキング TOP{TOP_N}",
        sub_text=f"初任給が最も <strong>高い</strong> 職業ランキング",
        intro_text="新卒・未経験からのスタート時の給与が高い職業をランキング。平均年収やAI影響度も合わせて確認できます。",
        items=by_entry,
        stat_blocks=[
            ("TOP30 平均初任給", f"{int(mean_entry)} 万円"),
            ("TOP30 平均年収", f"{int(safe_mean(by_entry, 'salary'))} 万円"),
            ("TOP30 平均 AI 影響", f"{safe_mean(by_entry, 'ai_risk'):.1f} / 10"),
        ],
        extra_col_fn=entry_extra,
        faq_items=FAQS["entry-salary"],
    ))
    pages_written += 1

    # 7. Young workforce
    def age_extra(o: dict) -> list[str]:
        age = o.get("average_age")
        if age:
            return [f'<span class="rl-extra">{age:.1f}歳</span>']
        return []

    bytes_total += write_page("young-workforce.html", render_page(
        slug="young-workforce",
        title="平均年齢が若い職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"平均年齢が最も低い職業TOP{TOP_N}。平均{mean_age_young:.1f}歳。若手が活躍する職業を年収・AI影響度と共に一覧。",
        h1_text=f"平均年齢が若い職業 TOP{TOP_N}",
        sub_text=f"平均年齢が最も <strong>低い</strong> 職業ランキング",
        intro_text="若い世代が多く活躍する職業をランキング。IT・クリエイティブ・サービス業など、比較的新しい産業や体力を要する職種で平均年齢が低い傾向にあります。",
        items=by_young,
        stat_blocks=[
            ("TOP30 平均年齢", f"{mean_age_young:.1f} 歳"),
            ("TOP30 平均年収", f"{int(safe_mean(by_young, 'salary'))} 万円"),
            ("TOP30 平均 AI 影響", f"{safe_mean(by_young, 'ai_risk'):.1f} / 10"),
        ],
        extra_col_fn=age_extra,
        faq_items=FAQS["young-workforce"],
    ))
    pages_written += 1

    # 8. Short hours
    def hours_extra(o: dict) -> list[str]:
        h = o.get("monthly_hours")
        if h:
            return [f'<span class="rl-extra">月{int(h)}h</span>']
        return []

    bytes_total += write_page("short-hours.html", render_page(
        slug="short-hours",
        title="労働時間が短い職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"月間労働時間が最も短い職業TOP{TOP_N}。平均{int(mean_hours)}時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。",
        h1_text=f"労働時間が短い職業 TOP{TOP_N}",
        sub_text=f"月間労働時間が最も <strong>短い</strong> 職業ランキング",
        intro_text="ワークライフバランスを重視する方向けに、月間労働時間が短い職業をランキング。年収やAI影響度も合わせて確認できます。",
        items=by_hours,
        stat_blocks=[
            ("TOP30 平均月間労働", f"{int(mean_hours)} 時間"),
            ("TOP30 平均年収", f"{int(safe_mean(by_hours, 'salary'))} 万円"),
            ("TOP30 平均 AI 影響", f"{safe_mean(by_hours, 'ai_risk'):.1f} / 10"),
            ("TOP30 平均年齢", f"{safe_mean(by_hours, 'average_age'):.1f} 歳"),
        ],
        extra_col_fn=hours_extra,
        faq_items=FAQS["short-hours"],
    ))
    pages_written += 1

    # 9. High demand
    def demand_extra(o: dict) -> list[str]:
        db = o.get("demand_band", "")
        label = DEMAND_JA.get(db, "")
        if label:
            return [f'<span class="demand-pill {db}">{escape(label)}</span>']
        return []

    bytes_total += write_page("high-demand.html", render_page(
        slug="high-demand",
        title="人手不足の職業ランキング TOP30【2026年版】| 未来の仕事",
        seo_desc=f"求人需要が最も高い職業TOP{TOP_N}。「需要高」{hot_count}件・「やや高」{warm_count}件。転職・就活の参考に。",
        h1_text=f"人手不足の職業 TOP{TOP_N}",
        sub_text="求人需要が最も <strong>高い</strong> 職業ランキング",
        intro_text="人手不足が深刻な職業を求人需要の高い順にランキング。採用されやすく待遇改善も期待できる職業を年収・AI影響度と共に確認できます。",
        items=by_demand,
        stat_blocks=[
            ("「需要高」職業数", f"{hot_count}"),
            ("「やや高」職業数", f"{warm_count}"),
            ("TOP30 平均年収", f"{int(safe_mean(by_demand, 'salary'))} 万円"),
            ("TOP30 平均 AI 影響", f"{safe_mean(by_demand, 'ai_risk'):.1f} / 10"),
        ],
        extra_col_fn=demand_extra,
        faq_items=FAQS["high-demand"],
    ))
    pages_written += 1

    # --- Hub page ---

    global_stats = [
        ("総職業数", "556"),
        ("全体平均 AI 影響", f"{all_mean_risk:.1f} / 10"),
        ("全体平均年収", f"{int(all_mean_salary)} 万円"),
        ("総就業者数", f"{all_workers / 10000:.0f} 万人"),
    ]

    # Compute insights from sector data
    sector_risks = {}
    sector_counts: dict[str, int] = Counter()
    for o in scored:
        sid = o.get("sector_ja", "")
        if sid:
            sector_risks.setdefault(sid, []).append(o["ai_risk"])
            sector_counts[sid] += 1

    sector_mean_risks = {s: sum(v) / len(v) for s, v in sector_risks.items() if v}
    highest_risk_sector = max(sector_mean_risks, key=sector_mean_risks.get, default="")
    lowest_risk_sector = min(sector_mean_risks, key=sector_mean_risks.get, default="")

    insights = [
        f'<strong>{escape(highest_risk_sector)}</strong>セクターはAI影響度平均{sector_mean_risks.get(highest_risk_sector, 0):.1f}と全セクターで最高',
        f'<strong>{escape(lowest_risk_sector)}</strong>セクターはAI影響度平均{sector_mean_risks.get(lowest_risk_sector, 0):.1f}と最も低い',
        f'年収上位30職業の平均AI影響度は<strong>{safe_mean(by_salary, "ai_risk"):.1f}/10</strong>と中程度',
        f'就業者数上位は事務・販売系が占めるが、AI影響度は<strong>高め</strong>の傾向',
        f'AI影響度が低い職業ほど<strong>身体性・対人スキル</strong>を求められる傾向',
    ]

    rankings_meta = [
        ("ai-risk-high", "AIに奪われる仕事 TOP30", "AI影響度が高い職業ランキング", len(ai_high),
         make_preview(ai_high, lambda o: f"AI影響 {o['ai_risk']}/10")),
        ("ai-risk-low", "AI影響が少ない仕事 TOP30", "AIリスクが低く将来性のある職業", len(ai_low),
         make_preview(ai_low, lambda o: f"AI影響 {o['ai_risk']}/10")),
        ("salary-safe", "高年収×低AIリスク TOP30", "年収が高くAI代替リスクが低い職業", len(salary_safe),
         make_preview(salary_safe, lambda o: f"{int(o['salary'])}万円")),
        ("workers", "就業者数ランキング TOP30", "日本で最も就業者が多い職業", len(by_workers),
         make_preview(by_workers, lambda o: f"{fmt_int(o['workers'])}人")),
        ("salary", "年収ランキング TOP30", "年収が最も高い職業", len(by_salary),
         make_preview(by_salary, lambda o: f"{int(o['salary'])}万円")),
        ("entry-salary", "初任給ランキング TOP30", "初任給が高い職業", len(by_entry),
         make_preview(by_entry, lambda o: f"初任給 {int(o['recruit_wage'])}万円")),
        ("young-workforce", "平均年齢が若い職業 TOP30", "若手が活躍する職業", len(by_young),
         make_preview(by_young, lambda o: f"平均{o['average_age']:.1f}歳")),
        ("short-hours", "労働時間が短い職業 TOP30", "ワークライフバランスに優れた職業", len(by_hours),
         make_preview(by_hours, lambda o: f"月{int(o['monthly_hours'])}時間")),
        ("high-demand", "人手不足の職業 TOP30", "求人需要が高い職業", len(by_demand),
         make_preview(by_demand, lambda o: DEMAND_JA.get(o.get("demand_band", ""), ""))),
    ]

    idx_html = render_index(rankings_meta, global_stats, insights)
    bytes_total += write_page("index.html", idx_html)
    pages_written += 1

    print(f"Generated {pages_written} ranking pages → ja/rankings/")
    print(f"Total size: {bytes_total / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
