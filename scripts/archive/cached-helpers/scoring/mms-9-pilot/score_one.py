#!/usr/bin/env python3
"""Score one occupation with local grok -m grok-4.5. Writes answers/id-XXXX.json."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUN = ROOT / ".cache/scoring/mms-9-pilot"
PROMPTS = RUN / "prompts"
ANSWERS = RUN / "answers"
LOGS = RUN / "grok-logs"
ANSWERS.mkdir(exist_ok=True)
LOGS.mkdir(exist_ok=True)


def extract_obj(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in grok output")
    return json.loads(text[start : end + 1])


def score(occ_id: int) -> Path:
    out = ANSWERS / f"id-{occ_id:04d}.json"
    if out.exists():
        return out
    prompt = PROMPTS / f"{occ_id:04d}.txt"
    if not prompt.exists():
        raise FileNotFoundError(prompt)
    log = LOGS / f"{occ_id:04d}.out"
    err = LOGS / f"{occ_id:04d}.err"
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
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=300)
    log.write_text(proc.stdout)
    err.write_text(proc.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"grok exit {proc.returncode} for id={occ_id}: {proc.stderr[-500:]}")
    obj = extract_obj(proc.stdout)
    if int(obj["id"]) != occ_id:
        raise ValueError(f"id mismatch: expected {occ_id} got {obj.get('id')}")
    out.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")
    return out


if __name__ == "__main__":
    occ_id = int(sys.argv[1])
    path = score(occ_id)
    print(path)
