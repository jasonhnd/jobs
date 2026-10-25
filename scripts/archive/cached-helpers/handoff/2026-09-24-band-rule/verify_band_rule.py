#!/usr/bin/env python3
"""verify_band_rule.py — check the built site against the band rule (owner decision 2026-09-24, option A).

Rule: every band / colour / tier word attached to a displayed score is derived from the
DISPLAYED value (banker rounding to one decimal, `displayScore`), with the canonical cut points
low < 4.0 <= mid < 7.0 <= high. Aggregate means are computed from UNROUNDED values.

Usage (from a worktree root, after `bun run build`):
  python3 __REDACTED_LOCAL__ [dist-astro]

Exit 0 when every check reports 0 mismatches, 1 otherwise. Read-only.
"""
from __future__ import annotations

import html
import json
import re
import statistics
import sys
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path

DIST = Path(sys.argv[1] if len(sys.argv) > 1 else "dist-astro")
if not (DIST / "data.search.json").exists():
    sys.exit(f"STOP: {DIST}/data.search.json not found — run `bun run build` in the worktree first")

WORD = {"low": "低め", "mid": "中程度", "high": "高め"}
Q2 = {"low": "AI に代替されにくく", "mid": "AI 影響は中程度", "high": "AI による業務変化が大きく"}
CALLOUT = {
    "低 AI 影響。": "low",
    "AI 影響度は中程度。": "mid",
    "AI 影響度が高い。": "high",
    "定型業務が中心。AI による自動化候補が多く": "high",
}
DISPLACEMENT = {
    "職そのものが大きく減るリスクは低め": "low",
    "業務の再設計が進みやすい中程度のリスク": "mid",
    "職そのものが縮小するリスクも相対的に高め": "high",
}


def shown(x: float) -> float:
    """Python twin of src/data/lib/banker-round.ts displayScore (decimal-string banker rounding)."""
    return float(Decimal(repr(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_EVEN))


def band(x: float) -> str:
    return "low" if x < 4.0 else ("mid" if x < 7.0 else "high")


def page_path(occ_id: int) -> Path:
    # occupation 404 lives at /occupations/404 because /404 is the site's not-found page
    if occ_id == 404:
        return DIST / "occupations" / "404.html"
    p = DIST / f"{occ_id}.html"
    return p if p.exists() else DIST / "occupations" / f"{occ_id}.html"


search = json.loads((DIST / "data.search.json").read_text(encoding="utf-8"))["documents"]
treemap = {r["id"]: r for r in json.loads((DIST / "data.treemap.json").read_text(encoding="utf-8"))}
raw = {d["id"]: d["ai_risk"] for d in search if d.get("ai_risk") is not None}

fails: dict[str, list[str]] = {}


def fail(check: str, detail: str) -> None:
    fails.setdefault(check, []).append(detail)


checks = [
    "data.search.json risk_band",
    "data.treemap.json risk_band",
    "data.detail/<id>.json risk_band",
    "verdict card class",
    "meta description tier word",
    "og:description tier word",
    "twitter:description tier word",
    "FAQ Q1 tier word (JSON-LD)",
    "FAQ Q2 outlook (JSON-LD)",
    "risk callout line (only where printed)",
    "displacement wording",
    "shown number = displayScore(raw)",
]

for d in search:
    oid = d["id"]
    if oid not in raw:
        continue
    v = raw[oid]
    s = shown(v)
    want = band(s)
    if d.get("risk_band") != want:
        fail(checks[0], f"{oid}: {d.get('risk_band')} (want {want}, shows {s})")
    if treemap.get(oid, {}).get("risk_band") != want:
        fail(checks[1], f"{oid}: {treemap.get(oid, {}).get('risk_band')} (want {want})")
    det = DIST / "data.detail" / f"{oid:04d}.json"
    if det.exists():
        dj = json.loads(det.read_text(encoding="utf-8"))
        if dj.get("risk_band") != want:
            fail(checks[2], f"{oid}: {dj.get('risk_band')} (want {want})")
    p = page_path(oid)
    if not p.exists():
        fail("page exists", f"{oid}: no page")
        continue
    h = p.read_text(encoding="utf-8")
    m = re.search(r"risk-card verdict-card risk-(low|mid|high)", h)
    if not m or m.group(1) != want:
        fail(checks[3], f"{oid}: {m.group(1) if m else None} (want {want}, shows {s})")
    for name, pat in (
        (checks[4], r'<meta name="description" content="([^"]*)"'),
        (checks[5], r'<meta property="og:description" content="([^"]*)"'),
        (checks[6], r'<meta name="twitter:description" content="([^"]*)"'),
    ):
        mm = re.search(pat, h)
        txt = html.unescape(mm.group(1)) if mm else ""
        t = re.search(r"AI影響度は10段階中([0-9.]+)と(低め|中程度|高め)です", txt)
        if not t:
            fail(name, f"{oid}: tier sentence not found")
            continue
        if t.group(2) != WORD[want]:
            fail(name, f"{oid}: {t.group(2)} (want {WORD[want]}, shows {t.group(1)})")
        if abs(float(t.group(1)) - s) > 1e-9:
            fail(checks[11], f"{oid}: {name} prints {t.group(1)}, displayScore is {s}")
    ld = " ".join(re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>', h))
    q1 = re.search(r"10段階中 ([0-9.]+) で、(低め|中程度|高め)で", ld)
    if not q1:
        fail(checks[7], f"{oid}: Q1 not found")
    elif q1.group(2) != WORD[want]:
        fail(checks[7], f"{oid}: {q1.group(2)} (want {WORD[want]}, shows {q1.group(1)})")
    q2 = re.search(r"AI影響度 ([0-9.]+)/10。(AI に代替されにくく|AI 影響は中程度|AI による業務変化が大きく)", ld)
    if not q2:
        fail(checks[8], f"{oid}: Q2 not found")
    elif q2.group(2) != Q2[want]:
        fail(checks[8], f"{oid}: '{q2.group(2)}' (want '{Q2[want]}', shows {q2.group(1)})")
    body = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", "", h)
    body = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body)))
    # pickRiskOneLineCallout is only the fallback when rationale_ja is empty (verdictSentence),
    # so most pages never print it; check it only where it is printed.
    got = [b for k, b in CALLOUT.items() if k in body]
    if got and got[0] != want:
        fail(checks[9], f"{oid}: {got[0]} (want {want}, shows {s})")
    for dm in re.finditer(r"仕事が減るリスクは([0-9.]+)/10で、(" + "|".join(DISPLACEMENT) + ")", body):
        if DISPLACEMENT[dm.group(2)] != band(float(dm.group(1))):
            fail(checks[10], f"{oid}: shows {dm.group(1)} but says {dm.group(2)}")
            break

# aggregates (unrounded)
mean_raw = statistics.fmean(raw.values())
counts = {b: sum(1 for v in raw.values() if band(shown(v)) == b) for b in ("low", "mid", "high")}
llms = (DIST / "llms.txt").read_text(encoding="utf-8")
agg = []
m = re.search(r"Mean AI Impact across all \d+ occupations is ([0-9.]+)/10", llms)
agg.append(("llms.txt mean (unrounded, 2 dp)", m.group(1) if m else None, f"{mean_raw:.2f}"))
m = re.search(r"low=(\d+), mid=(\d+), high=(\d+)", llms)
agg.append(("llms.txt band counts", m.groups() if m else None, (str(counts["low"]), str(counts["mid"]), str(counts["high"]))))
for page in ("data.html", "models.html"):
    t = (DIST / page).read_text(encoding="utf-8")
    m = re.search(r"全職業の平均は ([0-9.]+) から ([0-9.]+) になります", t)
    agg.append((f"{page} update note 'after' mean", m.group(2) if m else None, f"{mean_raw:.2f}"))

print(f"occupations checked: {len(raw)}")
bad = 0
for c in checks + ["page exists"]:
    n = len(fails.get(c, []))
    bad += n
    if c == "page exists" and n == 0:
        continue
    ex = "; ".join(fails.get(c, [])[:4])
    print(f"  {n:4d}  {c}" + (f"   e.g. {ex}" if n else ""))
print("aggregates:")
for name, got, want in agg:
    ok = got == want
    bad += 0 if ok else 1
    print(f"  {'OK ' if ok else 'BAD'}  {name}: {got} (want {want})")
print("RESULT:", "PASS" if bad == 0 else f"FAIL ({bad} mismatches)")
sys.exit(0 if bad == 0 else 1)
