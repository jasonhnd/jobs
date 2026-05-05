"""
Generate prompt.ja.md and prompt.en.md — single-file Markdown bundles of all 552
Japanese occupation records, designed to be copy-pasted into an LLM for analysis
and conversation about AI exposure of the Japanese job market.

Inspired by karpathy/jobs `make_prompt.py` and adapted for the Japanese dataset:
  - bilingual outputs (JA + EN)
  - 万円 / man-yen pay formatting
  - top-education extraction from the 8-bucket education_pct distribution
  - tier breakdown using the karpathy 0-1 / 2-3 / 4-5 / 6-7 / 8-9 / 10 anchors

Usage:
  uv run python -m scripts.make_prompt
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
# v1.0.8: source switched from repo-root data.json (deleted in Phase 4) to the
# treemap projection. Same flat record shape (name_ja / ai_risk / salary / education_pct etc.)
# so the rest of this file is unchanged.
INPUT = ROOT / "dist" / "data.treemap.json"
OUTPUT_DIR = ROOT / "data" / "prompts"
OUTPUT_JA = OUTPUT_DIR / "prompt.ja.md"
OUTPUT_EN = OUTPUT_DIR / "prompt.en.md"

SCORING_LLM = "Claude Opus 4.7 (Anthropic)"
SCORED_ON = "2026-04-25"
TRANSLATED_ON = "2026-04-25"
JOBTAG_URL = "https://shigoto.mhlw.go.jp/User/"
LIVE_URL = "https://mirai-shigoto.com/"

# 8 official MHLW education buckets (in display order)
EDU_LABELS_JA = [
    "高卒未満",
    "高卒",
    "専門学校卒",
    "短大卒",
    "高専卒",
    "大卒",
    "修士課程卒（修士と同等の専門職学位を含む）",
    "博士課程卒",
]

EDU_LABEL_JA_SHORT = {
    "高卒未満": "高卒未満",
    "高卒": "高卒",
    "専門学校卒": "専門学校",
    "短大卒": "短大",
    "高専卒": "高専",
    "大卒": "大卒",
    "修士課程卒（修士と同等の専門職学位を含む）": "修士",
    "博士課程卒": "博士",
}

EDU_LABEL_EN_SHORT = {
    "高卒未満": "Below HS",
    "高卒": "High school",
    "専門学校卒": "Vocational",
    "短大卒": "Junior college",
    "高専卒": "Tech college",
    "大卒": "Bachelor's",
    "修士課程卒（修士と同等の専門職学位を含む）": "Master's",
    "博士課程卒": "Doctoral",
}


# ─────────────────────────── Formatting helpers ────────────────────────────


def fmt_pay(salary: float | None, lang: str) -> str:
    """Salary is in man-yen (万円). e.g. 366.2 -> '366万円'."""
    if salary is None:
        return "?"
    rounded = int(round(salary))
    if lang == "ja":
        return f"{rounded:,}万円"
    return f"¥{rounded:,}万"


def fmt_workers(n: int | None) -> str:
    if n is None:
        return "?"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def fmt_age(age: float | None) -> str:
    if age is None:
        return "?"
    return f"{age:.1f}"


def fmt_recruit_ratio(r: float | None) -> str:
    if r is None:
        return "?"
    return f"{r:.2f}"


def fmt_total_wages(total_wages_man_yen: float, lang: str) -> str:
    """Total wages summed in man-yen; render as 兆円 (trillion yen)."""
    # 1 兆円 = 10^12 円 = 10^8 万円
    trillions = total_wages_man_yen / 1e8
    if lang == "ja":
        return f"{trillions:.1f} 兆円"
    return f"¥{trillions:.1f}T"


def fmt_workers_total(n: int, lang: str) -> str:
    if lang == "ja":
        if n >= 10_000:
            return f"{n:,}人（{n / 10_000:.0f}万人）"
        return f"{n:,}人"
    if n >= 1_000_000:
        return f"{n:,} ({n / 1e6:.1f}M)"
    return f"{n:,}"


def top_education(edu_pct: dict[str, float] | None) -> str | None:
    """Return the JA bucket label with the highest pct, or None."""
    if not edu_pct:
        return None
    items = [
        (label, pct) for label, pct in edu_pct.items()
        if isinstance(pct, (int, float))
    ]
    if not items:
        return None
    order = {label: i for i, label in enumerate(EDU_LABELS_JA)}
    items.sort(key=lambda kv: (-kv[1], order.get(kv[0], 99)))
    label, pct = items[0]
    if pct <= 0:
        return None
    return label


def edu_short(edu_ja_label: str | None, lang: str) -> str:
    if edu_ja_label is None:
        return "?"
    if lang == "ja":
        return EDU_LABEL_JA_SHORT.get(edu_ja_label, edu_ja_label)
    return EDU_LABEL_EN_SHORT.get(edu_ja_label, edu_ja_label)


def clean_cell(text: str | None) -> str:
    """Sanitize text for Markdown table cells: no pipes, no newlines."""
    if not text:
        return ""
    return text.replace("|", "/").replace("\n", " ").replace("\r", " ").strip()


# ─────────────────────────── Aggregation helpers ───────────────────────────


def weighted_avg(records: list[dict[str, Any]], value_key: str, weight_key: str) -> float:
    s = 0.0
    w = 0.0
    for r in records:
        v = r.get(value_key)
        wt = r.get(weight_key)
        if v is None or not wt:
            continue
        s += v * wt
        w += wt
    return s / w if w else 0.0


def load_records() -> list[dict[str, Any]]:
    with INPUT.open(encoding="utf-8") as fp:
        records = json.load(fp)
    for r in records:
        r["_top_edu_ja"] = top_education(r.get("education_pct"))
    records.sort(key=lambda r: (-(r.get("ai_risk") or 0), -(r.get("workers") or 0)))
    return records


# ─────────────────────────── Section builders ──────────────────────────────


TIERS = [
    ("0-1", 0, 1),
    ("2-3", 2, 3),
    ("4-5", 4, 5),
    ("6-7", 6, 7),
    ("8-9", 8, 9),
    ("10", 10, 10),
]

PAY_BANDS = [
    ("<300", 0, 300),
    ("300-500", 300, 500),
    ("500-700", 500, 700),
    ("700-1000", 700, 1000),
    ("1000+", 1000, float("inf")),
]


def build_header(lang: str) -> list[str]:
    lines: list[str] = []
    if lang == "ja":
        lines.append("# 日本の職業 552 と AI リスク")
        lines.append("")
        lines.append(
            "厚生労働省 jobtag（職業情報提供サイト）に掲載されている **552 の日本の職業** を、"
            "0〜10 の AI リスクスコア付きで構造化したデータです。"
            "LLM に貼り付けて、日本の労働市場が AI でどう再構成されるかを議論・分析する目的で生成されています。"
        )
        lines.append("")
        lines.append(f"- ライブ可視化: {LIVE_URL}")
        lines.append(f"- 元データ出典: 厚生労働省 jobtag（{JOBTAG_URL}）")
        lines.append("")
        lines.append("## 採点メソドロジー")
        lines.append("")
        lines.append(f"- **採点 LLM:** {SCORING_LLM}")
        lines.append(f"- **採点日:** {SCORED_ON}")
        lines.append(f"- **英訳日:** {TRANSLATED_ON}")
        lines.append("- **就業者・賃金データ:** 厚労省 2023 年度委託調査（jobtag 掲載値）")
        lines.append("- **採点スケール:** 独自設計の 0〜10 ルーブリック（業務代替性・自動化深度・人間判断要素を 5 段階アンカーで採点）")
        lines.append("")
        lines.append(
            "AI リスクは 0〜10 の単一軸で「AI が今後その職業をどれほど作り変えるか」を推定します。"
            "直接的な自動化（AI が仕事をする）と間接的な効果（AI による生産性向上で必要人員が減る）の両方を含みます。"
        )
        lines.append("")
        lines.append("**判断軸:** 「自宅の PC 1 台で完結できるか？」が yes ほど高得点。")
        lines.append("")
        lines.append("**スケールアンカー:**")
        lines.append("- 0–1 最小：物理・現場仕事（潜水士、林業作業）")
        lines.append("- 2–3 低：肉体労働＋対人（電気工事士、美容師）")
        lines.append("- 4–5 中：物理＋知識作業の混合（看護師、警察官）")
        lines.append("- 6–7 高：知識労働＋判断（教員、弁護士、会計士）")
        lines.append("- 8–9 非常に高い：ほぼ PC 完結（プログラマー、翻訳者）")
        lines.append("- 10 最大：完全に定型のデジタル処理（データ入力）")
        lines.append("")
        lines.append(
            "**重要:** 高得点 ≠ 仕事が消える。多くの高得点職は「置換」ではなく「再構成」される見込みです。"
            "プログラマーは 9/10 ですが AI で生産性が上がる結果、需要が増える可能性もあります。"
        )
        lines.append("")
        return lines

    # English
    lines.append("# Japan's 552 Occupations × AI Risk")
    lines.append("")
    lines.append(
        "Structured data on **552 Japanese occupations** sourced from MHLW jobtag, "
        "each scored on a 0–10 AI risk axis. Designed to be pasted into an LLM "
        "for analyzing and discussing how AI will reshape Japan's labor market."
    )
    lines.append("")
    lines.append(f"- Live visualization: {LIVE_URL}")
    lines.append(
        f"- Original data: MHLW Occupational Information Site / jobtag ({JOBTAG_URL})"
    )
    lines.append("")
    lines.append("## Scoring methodology")
    lines.append("")
    lines.append(f"- **Scoring LLM:** {SCORING_LLM}")
    lines.append(f"- **Scored on:** {SCORED_ON}")
    lines.append(f"- **Translated on:** {TRANSLATED_ON}")
    lines.append("- **Workforce / wage data:** MHLW FY2023 commissioned survey (via jobtag)")
    lines.append("- **Scoring scale:** In-house 0–10 rubric (task substitutability, automation depth, residual human-judgment requirements via 5-step anchors)")
    lines.append("")
    lines.append(
        "AI risk is a single 0–10 axis estimating how much AI will reshape each occupation. "
        "Combines direct automation (AI doing the work) and indirect effects "
        "(AI making workers so productive that fewer are needed)."
    )
    lines.append("")
    lines.append(
        '**Heuristic:** "Can the job be done entirely from a home computer?" '
        "— if yes, the score is naturally high, since AI is advancing fastest in digital domains."
    )
    lines.append("")
    lines.append("**Scale anchors:**")
    lines.append("- 0–1 Minimal: physical/field work (commercial diver, logger)")
    lines.append("- 2–3 Low: manual labor + some interpersonal (electrician, hair stylist)")
    lines.append("- 4–5 Moderate: mix of physical and knowledge work (nurse, police officer)")
    lines.append("- 6–7 High: knowledge work with judgment (teacher, lawyer, accountant)")
    lines.append("- 8–9 Very high: predominantly computer-based (programmer, translator)")
    lines.append("- 10 Maximum: pure routine digital processing (data entry)")
    lines.append("")
    lines.append(
        "**Important caveat:** A high score does NOT predict the job disappearing. "
        "Programmers score 9/10, but AI-driven productivity gains may grow total demand. "
        "Most high-exposure jobs will be reshaped, not replaced."
    )
    lines.append("")
    return lines


def build_aggregates(records: list[dict[str, Any]], lang: str) -> list[str]:
    lines: list[str] = []
    total_workers = sum(r.get("workers") or 0 for r in records)
    total_wages = sum(
        (r.get("salary") or 0) * (r.get("workers") or 0) for r in records
    )
    w_avg = weighted_avg(records, "ai_risk", "workers")

    if lang == "ja":
        lines.append("## 集計統計")
        lines.append("")
        lines.append(f"- **職業数:** {len(records):,}")
        lines.append(f"- **総就業者数:** {fmt_workers_total(total_workers, 'ja')}")
        lines.append(f"- **総年間賃金（推定）:** {fmt_total_wages(total_wages, 'ja')}")
        lines.append(f"- **就業者数加重 AI リスク平均:** {w_avg:.2f}/10")
        lines.append("")
    else:
        lines.append("## Aggregate statistics")
        lines.append("")
        lines.append(f"- **Occupations:** {len(records):,}")
        lines.append(f"- **Total workforce:** {fmt_workers_total(total_workers, 'en')}")
        lines.append(
            f"- **Total estimated annual wages:** {fmt_total_wages(total_wages, 'en')}"
        )
        lines.append(f"- **Job-weighted average AI risk:** {w_avg:.2f}/10")
        lines.append("")

    # Tier breakdown
    if lang == "ja":
        lines.append("### AI リスク帯別の内訳")
        lines.append("")
        lines.append("| 帯 | 職業数 | 就業者 | 就業者比 | 賃金総額 | 賃金比 | 平均年収 |")
        lines.append("|----|------|------|--------|--------|------|--------|")
    else:
        lines.append("### Breakdown by AI risk tier")
        lines.append("")
        lines.append(
            "| Tier | Occupations | Workers | % workers | Wages | % wages | Avg pay |"
        )
        lines.append("|------|-------------|---------|-----------|-------|---------|---------|")

    for label, lo, hi in TIERS:
        group = [
            r for r in records
            if r.get("ai_risk") is not None and lo <= r["ai_risk"] <= hi
        ]
        g_workers = sum(r.get("workers") or 0 for r in group)
        g_wages = sum(
            (r.get("salary") or 0) * (r.get("workers") or 0) for r in group
        )
        avg_pay_str = fmt_pay(g_wages / g_workers, lang) if g_workers else "?"
        pct_w = (g_workers / total_workers * 100) if total_workers else 0
        pct_wages = (g_wages / total_wages * 100) if total_wages else 0
        lines.append(
            f"| {label} | {len(group)} | {fmt_workers(g_workers)} | "
            f"{pct_w:.1f}% | {fmt_total_wages(g_wages, lang)} | "
            f"{pct_wages:.1f}% | {avg_pay_str} |"
        )
    lines.append("")

    # Pay-band breakdown
    if lang == "ja":
        lines.append("### 年収帯別の AI リスク（就業者数加重平均）")
        lines.append("")
        lines.append("| 年収帯（万円） | AI リスク平均 | 職業数 | 就業者 |")
        lines.append("|----------------|--------------|--------|--------|")
    else:
        lines.append("### Avg AI risk by salary band (job-weighted)")
        lines.append("")
        lines.append("| Salary band (万円) | Avg AI risk | Occupations | Workers |")
        lines.append("|--------------------|------------|-------------|---------|")

    for label, lo, hi in PAY_BANDS:
        group = [
            r for r in records
            if r.get("salary") is not None
            and lo <= r["salary"] < hi
            and r.get("ai_risk") is not None
            and r.get("workers")
        ]
        g_workers = sum(r["workers"] for r in group)
        if not g_workers:
            continue
        ws = sum(r["ai_risk"] * r["workers"] for r in group)
        avg = ws / g_workers
        lines.append(
            f"| {label} | {avg:.2f} | {len(group)} | {fmt_workers(g_workers)} |"
        )
    lines.append("")

    # Education breakdown
    if lang == "ja":
        lines.append("### 最頻学歴別の AI リスク（就業者数加重平均）")
        lines.append("")
        lines.append(
            "各職業について `education_pct` で最も比率の高い学歴ラベルでグルーピング。"
        )
        lines.append("")
        lines.append("| 学歴 | AI リスク平均 | 職業数 | 就業者 |")
        lines.append("|------|--------------|--------|--------|")
    else:
        lines.append("### Avg AI risk by top-education level (job-weighted)")
        lines.append("")
        lines.append(
            "Each occupation is grouped by the education label with the highest share "
            "in `education_pct`."
        )
        lines.append("")
        lines.append("| Education | Avg AI risk | Occupations | Workers |")
        lines.append("|-----------|------------|-------------|---------|")

    for ja_label in EDU_LABELS_JA:
        group = [
            r for r in records
            if r.get("_top_edu_ja") == ja_label
            and r.get("ai_risk") is not None
            and r.get("workers")
        ]
        if not group:
            continue
        g_workers = sum(r["workers"] for r in group)
        ws = sum(r["ai_risk"] * r["workers"] for r in group)
        avg = ws / g_workers
        short = edu_short(ja_label, lang)
        lines.append(
            f"| {short} | {avg:.2f} | {len(group)} | {fmt_workers(g_workers)} |"
        )
    lines.append("")
    return lines


def _occ_name(r: dict[str, Any], lang: str) -> str:
    ja = clean_cell(r.get("name_ja"))
    en = clean_cell(r.get("name_en"))
    if lang == "ja":
        return f"{ja}（{en}）" if en else ja
    return f"{en} ({ja})" if en else ja


def _format_basic_col(r: dict[str, Any], key: str, lang: str) -> str:
    if key == "name":
        return _occ_name(r, lang)
    if key == "ai_risk":
        v = r.get("ai_risk")
        return f"{v}/10" if v is not None else "?"
    if key == "workers":
        return fmt_workers(r.get("workers"))
    if key == "salary":
        return fmt_pay(r.get("salary"), lang)
    return clean_cell(str(r.get(key) or ""))


def build_notable_lists(records: list[dict[str, Any]], lang: str) -> list[str]:
    lines: list[str] = []

    def make_table(
        title_ja: str,
        title_en: str,
        rows: list[dict[str, Any]],
        cols: list[tuple[str, str, str]],
    ) -> None:
        lines.append(f"### {title_ja if lang == 'ja' else title_en}")
        lines.append("")
        header = ["#"] + [c[0 if lang == "ja" else 1] for c in cols]
        lines.append("| " + " | ".join(header) + " |")
        lines.append("|" + "|".join("---" for _ in header) + "|")
        for i, r in enumerate(rows, 1):
            cells = [str(i)] + [_format_basic_col(r, c[2], lang) for c in cols]
            lines.append("| " + " | ".join(cells) + " |")
        lines.append("")

    if lang == "ja":
        lines.append("## 注目リスト")
    else:
        lines.append("## Notable lists")
    lines.append("")

    by_risk_desc = sorted(
        records, key=lambda r: (-(r.get("ai_risk") or 0), -(r.get("workers") or 0))
    )[:20]
    by_risk_asc = sorted(
        records, key=lambda r: (r.get("ai_risk") or 99, -(r.get("workers") or 0))
    )[:20]
    by_workers = sorted(
        [r for r in records if r.get("workers") is not None],
        key=lambda r: -(r.get("workers") or 0),
    )[:20]
    by_pay = sorted(
        [r for r in records if r.get("salary") is not None],
        key=lambda r: -(r.get("salary") or 0),
    )[:20]

    cols_basic = [
        ("職業", "Occupation", "name"),
        ("AI リスク", "AI risk", "ai_risk"),
        ("就業者", "Workers", "workers"),
        ("年収", "Pay", "salary"),
    ]

    make_table(
        "AI リスクが最も高い 20 職業", "Top 20 highest AI risk", by_risk_desc, cols_basic
    )
    make_table(
        "AI リスクが最も低い 20 職業", "Top 20 lowest AI risk", by_risk_asc, cols_basic
    )
    make_table(
        "就業者数が最も多い 20 職業", "Top 20 by workforce", by_workers, cols_basic
    )
    make_table("年収が最も高い 20 職業", "Top 20 by salary", by_pay, cols_basic)

    return lines


def build_full_table(records: list[dict[str, Any]], lang: str) -> list[str]:
    lines: list[str] = []
    if lang == "ja":
        lines.append(f"## 全 {len(records)} 職業（AI リスク順）")
        lines.append("")
        lines.append("AI リスク降順 → 就業者数降順でソート。")
        lines.append("")
        lines.append(
            "| # | 職業 | 年収 | 就業者 | 平均年齢 | 求人倍率 | 最頻学歴 | AI リスク | 根拠 |"
        )
        lines.append("|---|------|------|--------|--------|--------|--------|-----------|------|")
    else:
        lines.append(f"## All {len(records)} occupations (AI risk order)")
        lines.append("")
        lines.append("Sorted by AI risk descending, then by workforce descending.")
        lines.append("")
        lines.append(
            "| # | Occupation | Pay | Workers | Avg age | Recruit ratio | Top edu | AI risk | Rationale |"
        )
        lines.append(
            "|---|-----------|-----|---------|---------|---------------|---------|---------|-----------|"
        )

    for i, r in enumerate(records, 1):
        if lang == "ja":
            rationale = clean_cell(r.get("ai_rationale_ja")) or clean_cell(
                r.get("ai_rationale_en")
            )
        else:
            rationale = clean_cell(r.get("ai_rationale_en")) or clean_cell(
                r.get("ai_rationale_ja")
            )

        risk = r.get("ai_risk")
        risk_str = f"{risk}/10" if risk is not None else "?"

        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    _occ_name(r, lang),
                    fmt_pay(r.get("salary"), lang),
                    fmt_workers(r.get("workers")),
                    fmt_age(r.get("age")),
                    fmt_recruit_ratio(r.get("recruit_ratio")),
                    edu_short(r.get("_top_edu_ja"), lang),
                    risk_str,
                    rationale,
                ]
            )
            + " |"
        )
    lines.append("")
    return lines


# ───────────────────────────────── Main ────────────────────────────────────


def render(records: list[dict[str, Any]], lang: str) -> str:
    parts: list[str] = []
    parts.extend(build_header(lang))
    parts.extend(build_aggregates(records, lang))
    parts.extend(build_notable_lists(records, lang))
    parts.extend(build_full_table(records, lang))
    return "\n".join(parts) + "\n"


def main() -> None:
    if not INPUT.exists():
        raise SystemExit(
            f"Missing {INPUT}. Run `uv run python -m scripts.build_data` first."
        )

    records = load_records()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for lang, out_path in (("ja", OUTPUT_JA), ("en", OUTPUT_EN)):
        text = render(records, lang)
        out_path.write_text(text, encoding="utf-8", newline="\n")
        n_lines = text.count("\n")
        size_kb = out_path.stat().st_size / 1024
        print(
            f"Wrote {out_path.name} ({len(text):,} chars, "
            f"{n_lines:,} lines, {size_kb:.1f} KB)"
        )


if __name__ == "__main__":
    main()
