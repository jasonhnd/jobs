"""
Build compact data.json from data/occupations_full.json for the front-end treemap.

Input:  data/occupations_full.json (580 records, rich fields)
Output: data.json (root, compact bilingual-ready schema)

Per occupation in output:
  id              - integer (1..580)
  name_ja         - Japanese title
  name_en         - null until v0.0.4 translate.py runs
  salary          - annual salary in 10,000 yen units (man-yen)
  workers         - total workforce (people)
  hours           - monthly work hours
  age             - average age (years)
  recruit_wage    - monthly recruitment wage (man-yen)
  recruit_ratio   - effective job opening ratio
  education_pct   - {label: pct} for the 8 education levels
  ai_risk         - null until v0.0.4 score_ai_risk.py runs
  ai_rationale    - null until v0.0.4
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
OUTPUT = ROOT / "data.json"

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


def build():
    print(f"Reading {INPUT}...")
    with INPUT.open(encoding="utf-8") as fp:
        records = json.load(fp)

    out = []
    for r in records:
        if not r.get("ok"):
            continue
        rid = r["id"]
        stats = r.get("stats", {})
        record = {
            "id": rid,
            "name_ja": r.get("title", ""),
            "name_en": None,
            "salary": parse_number(get_stat(stats, "analytic-Work-salary")),
            "workers": parse_int(get_stat(stats, "analytic-work-human-number")),
            "hours": parse_int(get_stat(stats, "analytic-Work-time-number")),
            "age": parse_number(get_stat(stats, "analytic-Work-average-age")),
            "recruit_wage": parse_number(get_stat(stats, "analytic_recruitment_wage")),
            "recruit_ratio": parse_number(get_stat(stats, "analytic_recruitment_ratio")),
            "education_pct": extract_education(r.get("bars", [])),
            "ai_risk": None,
            "ai_rationale": None,
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


if __name__ == "__main__":
    build()
