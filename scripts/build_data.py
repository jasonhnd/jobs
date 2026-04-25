"""
Build compact data.json from data/occupations_full.json for the front-end treemap.

Inputs:
  data/occupations_full.json           - 580 records, rich fields
  data/ai_scores_<YYYY-MM-DD>.json     - latest by filename date
  data/translations_<YYYY-MM-DD>.json  - latest by filename date

Output: data.json (root, flat array of records — preserved for front-end)

Per occupation in output:
  id              - integer (1..580)
  name_ja         - Japanese title
  name_en         - English title (from translations file, null if missing)
  desc_ja         - first 250 chars of original Japanese description
  desc_en         - English summary (from translations file, null if missing)
  salary          - annual salary in 10,000 yen units (man-yen)
  workers         - total workforce (people)
  hours           - monthly work hours
  age             - average age (years)
  recruit_wage    - monthly recruitment wage (man-yen)
  recruit_ratio   - effective job opening ratio
  education_pct   - {label: pct} for the 8 education levels
  ai_risk         - integer 0-10 (from ai_scores file, null if missing)
  ai_rationale_ja - JA rationale (from ai_scores file, null if missing)
  ai_rationale_en - EN rationale (from ai_scores file, null if missing)
  url             - jobtag detail URL

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
            "education_pct": extract_education(r.get("bars", [])),
            "ai_risk": score_entry.get("r"),
            "ai_rationale_ja": score_entry.get("j"),
            "ai_rationale_en": score_entry.get("e"),
            "url": f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{rid}",
        }
        out.append(record)

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


if __name__ == "__main__":
    build()
