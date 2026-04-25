"""
Build compact data.json from data/occupations_full.json for the front-end treemap.

Inputs:
  data/occupations_full.json           - 580 records, rich fields
  data/ai_scores_<YYYY-MM-DD>.json     - latest by filename date
  data/translations_<YYYY-MM-DD>.json  - latest by filename date

Output: data.json (root, flat array of records — preserved for front-end)

Per occupation in output:
  id                    - integer (1..580)
  name_ja               - Japanese title
  name_en               - English title (from translations file, null if missing)
  desc_ja               - first 250 chars of original Japanese description
  desc_en               - English summary (from translations file, null if missing)
  salary                - annual salary in 10,000 yen units (man-yen)
  workers               - total workforce (people)
  hours                 - monthly work hours
  age                   - average age (years)
  recruit_wage          - monthly recruitment wage (man-yen)
  recruit_ratio         - effective job opening ratio
  education_pct         - {label: pct} for the 8 education levels
  employment_type       - {label: pct} for the 10 employment-type categories, or null
  prior_experience      - {label: pct} for the 10 prior-experience bins, or null
  training_period_pre   - {label: pct} for the 10 pre-entry training bins, or null
  training_period_post  - {label: pct} for the 10 post-entry training bins, or null
  hourly_wage           - integer yen/hour from working_condition (一般労働者), or null
  ai_risk               - integer 0-10 (from ai_scores file, null if missing)
  ai_rationale_ja       - JA rationale (from ai_scores file, null if missing)
  ai_rationale_en       - EN rationale (from ai_scores file, null if missing)
  url                   - jobtag detail URL

Bar-section layout in occupations_full.json (5 sections, 49 entries when complete):
  [0..8]   Education            - 9 bars  (anchor: 高卒未満)
  [9..18]  Pre-entry training   - 10 bars (anchor: 特に必要ない, 1st)
  [19..28] Prior experience     - 10 bars (anchor: 特に必要ない, 2nd)
  [29..38] Post-entry training  - 10 bars (anchor: 必要でない（未経験でもすぐに即戦力）, unique)
  [39..48] Employment type      - 10 bars (anchor: 正規の職員、従業員, unique)

Observed length distribution: 49=473, 39=33 (no employment), 10=9 (employment only),
38=1 (shifted), 0=36 (no bars at all).

Extraction strategy: anchor-based scan (find unique starting labels for each section)
plus per-section label whitelist. Indices are NOT trusted because a few records have
shifted layouts. Records with no matching anchor or zero whitelist hits get null.

Usage:
  uv run python -m scripts.build_data
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "data" / "occupations_full.json"
DATA_DIR = ROOT / "data"
OUTPUT = ROOT / "data.json"

DESC_JA_MAX_CHARS = 250

EDU_LABELS = [
    "高卒未満",
    "高卒",
    "専門学校卒",
    "短大卒",
    "高専卒",
    "大卒",
    "修士課程卒（修士と同等の専門職学位を含む）",
    "博士課程卒",
]

# Whitelist for the pre-entry training section (bars[9..18]).
PRE_TRAINING_LABELS = {
    "特に必要ない",
    "1ヶ月以下",
    "1ヶ月超～6ヶ月以下",
    "6ヶ月超～1年以下",
    "1年超～2年以下",
    "2年超～3年以下",
    "3年超～5年以下",
    "5年超～10年以下",
    "10年超",
    "わからない",
}

# Whitelist for prior-experience section (bars[19..28]). Same labels as pre-training.
PRIOR_EXPERIENCE_LABELS = PRE_TRAINING_LABELS

# Whitelist for post-entry training section (bars[29..38]). Distinct first label.
POST_TRAINING_LABELS = {
    "必要でない（未経験でもすぐに即戦力）",
    "1ヶ月以下",
    "1ヶ月超～6ヶ月以下",
    "6ヶ月超～1年以下",
    "1年超～2年以下",
    "2年超～3年以下",
    "3年超～5年以下",
    "5年超～10年以下",
    "10年超",
    "わからない",
}

# Whitelist for employment-type section (bars[39..48]).
EMPLOYMENT_TYPE_LABELS = {
    "正規の職員、従業員",
    "パートタイマー",
    "派遣社員",
    "契約社員、期間従業員",
    "自営、フリーランス",
    "経営層（役員等）",
    "アルバイト（学生以外）",
    "アルバイト（学生）",
    "わからない",
    "その他",
}

# Unique anchor labels that mark the start of each section. Used to locate sections
# robustly even when bars[] length deviates from the canonical 49.
ANCHOR_POST_TRAINING = "必要でない（未経験でもすぐに即戦力）"
ANCHOR_EMPLOYMENT = "正規の職員、従業員"
ANCHOR_TRAINING_OR_EXPERIENCE = "特に必要ない"  # appears in BOTH pre-training & prior-experience

# Section length (each non-education section has exactly 10 bars).
SECTION_LEN = 10

# Hourly wage regex: capture 一般労働者 yen value from working_condition.
HOURLY_WAGE_RE = re.compile(
    r"賃金（１時間当たり）.*?一般労働者\s*([0-9,]+)\s*円",
    re.DOTALL,
)


def parse_number(s):
    if s is None:
        return None
    cleaned = re.sub(r"[,\s]", "", str(s))
    if cleaned in ("", "-", "—"):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_int(s):
    n = parse_number(s)
    return int(n) if n is not None else None


def get_stat(stats, key):
    entry = stats.get(key)
    if not entry or len(entry) < 2:
        return None
    return entry[1]


def extract_education(bars):
    edu = {}
    seen = set()
    for entry in bars:
        if not isinstance(entry, list) or len(entry) < 2:
            continue
        label, pct = entry[0], entry[1]
        if label in EDU_LABELS and label not in seen:
            edu[label] = pct
            seen.add(label)
    return edu


def _slice_section(bars, start_idx, length, whitelist):
    """Return {label: pct} for bars[start_idx : start_idx+length] filtered by whitelist.

    Returns an empty dict if no labels match (callers convert empty to None).
    Tolerates lists shorter than start_idx+length (just iterates what's available).
    """
    section = {}
    end_idx = min(start_idx + length, len(bars))
    for i in range(start_idx, end_idx):
        entry = bars[i]
        if not isinstance(entry, list) or len(entry) < 2:
            continue
        label, pct = entry[0], entry[1]
        if label in whitelist and label not in section:
            section[label] = pct
    return section


def _find_anchor(bars, anchor, occurrence=1):
    """Return the index of the `occurrence`-th appearance of `anchor` in bars,
    or -1 if not found.
    """
    seen = 0
    for i, entry in enumerate(bars):
        if not isinstance(entry, list) or len(entry) < 2:
            continue
        if entry[0] == anchor:
            seen += 1
            if seen == occurrence:
                return i
    return -1


def extract_employment_type(bars):
    """Extract the employment-type section (10 categories).

    Strategy: find anchor `正規の職員、従業員` and slice the next 10 entries through
    the employment-type whitelist. Returns None if no anchor or no matching labels.
    """
    if not bars:
        return None
    idx = _find_anchor(bars, ANCHOR_EMPLOYMENT)
    if idx < 0:
        return None
    section = _slice_section(bars, idx, SECTION_LEN, EMPLOYMENT_TYPE_LABELS)
    return section or None


def extract_post_training(bars):
    """Extract the post-entry training-period section (10 bins).

    Strategy: find unique anchor `必要でない（未経験でもすぐに即戦力）` and slice
    next 10 entries through the post-training whitelist.
    """
    if not bars:
        return None
    idx = _find_anchor(bars, ANCHOR_POST_TRAINING)
    if idx < 0:
        return None
    section = _slice_section(bars, idx, SECTION_LEN, POST_TRAINING_LABELS)
    return section or None


def extract_pre_training(bars):
    """Extract pre-entry training-period section (10 bins) — first `特に必要ない` block.

    Pre-training and prior-experience share label `特に必要ない` as their first
    entry; pre-training is the 1st occurrence in bars order.
    """
    if not bars:
        return None
    idx = _find_anchor(bars, ANCHOR_TRAINING_OR_EXPERIENCE, occurrence=1)
    if idx < 0:
        return None
    section = _slice_section(bars, idx, SECTION_LEN, PRE_TRAINING_LABELS)
    return section or None


def extract_prior_experience(bars):
    """Extract prior-experience section (10 bins) — second `特に必要ない` block."""
    if not bars:
        return None
    idx = _find_anchor(bars, ANCHOR_TRAINING_OR_EXPERIENCE, occurrence=2)
    if idx < 0:
        return None
    section = _slice_section(bars, idx, SECTION_LEN, PRIOR_EXPERIENCE_LABELS)
    return section or None


def extract_hourly_wage(working_condition):
    """Extract 一般労働者 hourly wage (yen, integer) from working_condition prose.

    Pattern: 賃金（１時間当たり）...一般労働者 N,NNN 円
    Returns None if no match.
    """
    if not working_condition:
        return None
    m = HOURLY_WAGE_RE.search(working_condition)
    if not m:
        return None
    raw = m.group(1).replace(",", "")
    try:
        return int(raw)
    except ValueError:
        return None


def find_latest_dated_file(prefix):
    """Return the latest-dated file matching `<prefix>_YYYY-MM-DD.json` in DATA_DIR.

    ISO YYYY-MM-DD sorts correctly as a string, so lexicographic max == latest date.
    Returns None if no file matches.
    """
    candidates = sorted(DATA_DIR.glob(f"{prefix}_*.json"))
    return candidates[-1] if candidates else None


def load_json(path):
    with path.open(encoding="utf-8") as fp:
        return json.load(fp)


def build():
    print(f"Reading {INPUT}...")
    records = load_json(INPUT)

    scores_path = find_latest_dated_file("ai_scores")
    translations_path = find_latest_dated_file("translations")

    if scores_path:
        print(f"Reading {scores_path.name}...")
        scores = load_json(scores_path).get("scores", {})
    else:
        print("No ai_scores_*.json found — ai_risk fields will be null.")
        scores = {}

    if translations_path:
        print(f"Reading {translations_path.name}...")
        translations = load_json(translations_path).get("translations", {})
    else:
        print("No translations_*.json found — name_en/desc_en will be null.")
        translations = {}

    out = []
    for r in records:
        if not r.get("ok"):
            continue
        rid = r["id"]
        rid_key = str(rid)
        stats = r.get("stats", {})

        score_entry = scores.get(rid_key) or {}
        translation_entry = translations.get(rid_key) or {}

        desc_full = r.get("description") or ""
        desc_ja = desc_full[:DESC_JA_MAX_CHARS] if desc_full else None

        bars = r.get("bars", []) or []
        working_condition = r.get("working_condition") or ""

        record = {
            "id": rid,
            "name_ja": r.get("title", ""),
            "name_en": translation_entry.get("name_en"),
            "desc_ja": desc_ja,
            "desc_en": translation_entry.get("desc_en"),
            "salary": parse_number(get_stat(stats, "analytic-Work-salary")),
            "workers": parse_int(get_stat(stats, "analytic-work-human-number")),
            "hours": parse_int(get_stat(stats, "analytic-Work-time-number")),
            "age": parse_number(get_stat(stats, "analytic-Work-average-age")),
            "recruit_wage": parse_number(get_stat(stats, "analytic_recruitment_wage")),
            "recruit_ratio": parse_number(get_stat(stats, "analytic_recruitment_ratio")),
            "education_pct": extract_education(bars),
            "employment_type": extract_employment_type(bars),
            "prior_experience": extract_prior_experience(bars),
            "training_period_pre": extract_pre_training(bars),
            "training_period_post": extract_post_training(bars),
            "hourly_wage": extract_hourly_wage(working_condition),
            "ai_risk": score_entry.get("r"),
            "ai_rationale_ja": score_entry.get("j"),
            "ai_rationale_en": score_entry.get("e"),
            "url": f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{rid}",
        }
        out.append(record)

    # ---------------------------------------------------------------
    # Workers normalization (jobtag stats are at the parent category
    # level: many sub-occupations share identical headcount, hours,
    # salary, age figures. Summing them naïvely 5x-overcounts the
    # workforce. We redistribute the parent total equally across
    # sub-occupations and store the original on `category_workers`.)
    # ---------------------------------------------------------------
    from collections import defaultdict
    # Group by workers value alone. jobtag's headcount is at the parent
    # category level — occupations that share the same workforce count
    # (3.7M for 公務員, 3.3M for 事務など) are members of the same category
    # in the source taxonomy. Even when secondary stats (salary, hours)
    # diverge slightly across sub-occupations, identical workforce is the
    # signal that they share a parent total.
    stats_groups: dict = defaultdict(list)
    for r in out:
        if r.get("workers"):
            stats_groups[r["workers"]].append(r)

    multi_categories = [g for g in stats_groups.values() if len(g) > 1]
    redistributed_records = 0
    for group in multi_categories:
        original = group[0]["workers"]
        share = original / len(group)
        for r in group:
            r["category_workers"] = original
            r["category_size"] = len(group)
            r["workers"] = max(1, round(share))
        redistributed_records += len(group)

    print(
        f"  Normalization: {len(multi_categories)} parent categories "
        f"redistributed across {redistributed_records} sub-occupations."
    )

    out.sort(key=lambda x: x["id"])

    print(f"Writing {OUTPUT}...")
    with OUTPUT.open("w", encoding="utf-8") as fp:
        json.dump(out, fp, ensure_ascii=False, separators=(",", ":"))

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"Done. {len(out)} occupations, {size_kb:.1f} KB.")

    salaries = [r["salary"] for r in out if r["salary"]]
    workers_total = sum(r["workers"] for r in out if r["workers"])
    print(f"  Salary range: {min(salaries):.1f} - {max(salaries):.1f} man-yen")
    print(f"  Median salary: {sorted(salaries)[len(salaries) // 2]:.1f} man-yen")
    print(f"  Total workforce represented: {workers_total:,}")

    name_en_count = sum(1 for r in out if r.get("name_en"))
    desc_en_count = sum(1 for r in out if r.get("desc_en"))
    desc_ja_count = sum(1 for r in out if r.get("desc_ja"))
    ai_risk_count = sum(1 for r in out if r.get("ai_risk") is not None)
    print(f"  Coverage: name_en={name_en_count}, desc_en={desc_en_count}, "
          f"desc_ja={desc_ja_count}, ai_risk={ai_risk_count}")

    employment_count = sum(1 for r in out if r.get("employment_type"))
    prior_exp_count = sum(1 for r in out if r.get("prior_experience"))
    pre_train_count = sum(1 for r in out if r.get("training_period_pre"))
    post_train_count = sum(1 for r in out if r.get("training_period_post"))
    hourly_count = sum(1 for r in out if r.get("hourly_wage") is not None)
    print(
        f"  Bar/wage coverage: employment_type={employment_count}, "
        f"prior_experience={prior_exp_count}, training_pre={pre_train_count}, "
        f"training_post={post_train_count}, hourly_wage={hourly_count}"
    )


if __name__ == "__main__":
    build()
