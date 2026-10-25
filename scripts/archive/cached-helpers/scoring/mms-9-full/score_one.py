#!/usr/bin/env python3
"""Score one occupation with local grok -m grok-4.5. Retries identity refusals."""
from __future__ import annotations

import json
import math
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUN = ROOT / ".cache/scoring/mms-9-full"
PROMPTS = RUN / "prompts"
ANSWERS = RUN / "answers"
LOGS = RUN / "grok-logs"
ANSWERS.mkdir(exist_ok=True)
LOGS.mkdir(exist_ok=True)

MAX_ATTEMPTS = 5


def r1(x: float) -> float:
    return math.floor(x * 10 + 0.5 + 1e-9) / 10


def apply_formulas(obj: dict) -> dict:
    a = obj["aiois"]
    d = [float(a[f"d{i}"]) for i in range(1, 11)]
    e = (d[0] + d[1]) / 2
    m = sum(d[2:7]) / 5
    p = (d[7] + d[8]) / 2
    raw = e * (1 - m / 10) * (0.6 + 0.4 * (p + d[9]) / 20)
    raw = max(0.0, min(10.0, raw))
    a["transformation"] = r1(e)
    a["displacement"] = r1(raw)
    obj["ai_risk"] = a["transformation"]
    obj["aiois"] = a
    return obj


def extract_obj(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in grok output")
    obj = json.loads(text[start : end + 1])
    if "error" in obj and "aiois" not in obj:
        raise ValueError(f"model refused: {obj.get('error') or obj.get('message')}")
    if "id" not in obj or "aiois" not in obj:
        raise ValueError(f"not a score object: keys={list(obj)[:8]}")
    return obj


def grok_once(occ_id: int, attempt: int) -> dict:
    prompt = PROMPTS / f"{occ_id:04d}.txt"
    log = LOGS / f"{occ_id:04d}.a{attempt}.out"
    err = LOGS / f"{occ_id:04d}.a{attempt}.err"
    cmd = [
        "grok",
        "-m",
        "grok-4.5",
        "--prompt-file",
        str(prompt),
        "--output-format",
        "plain",
        "--no-subagents",
        "--disable-web-search",
        "--permission-mode",
        "dontAsk",
        "--max-turns",
        "2",
        "--no-plan",
    ]
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=360)
    log.write_text(proc.stdout)
    err.write_text(proc.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"grok exit {proc.returncode}: {proc.stderr[-400:]}")
    return extract_obj(proc.stdout)


def score(occ_id: int) -> Path:
    out = ANSWERS / f"id-{occ_id:04d}.json"
    if out.exists():
        return out
    last = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            obj = grok_once(occ_id, attempt)
            if int(obj["id"]) != occ_id:
                raise ValueError(f"id mismatch expected {occ_id} got {obj.get('id')}")
            obj = apply_formulas(obj)
            out.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")
            return out
        except Exception as e:
            last = e
            time.sleep(1.5 * attempt)
    raise RuntimeError(f"id={occ_id} failed after {MAX_ATTEMPTS}: {last}")


if __name__ == "__main__":
    occ_id = int(sys.argv[1])
    print(score(occ_id))
