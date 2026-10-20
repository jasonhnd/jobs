#!/usr/bin/env python3
"""Orchestrate local Claude Fable 5.1 for the 556-id full run. Does not score."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path("__REDACTED_LOCAL__")
RUN = ROOT / ".cache/scoring/mms-8f-full"
CLAUDE = Path("__REDACTED_LOCAL__")
CHUNK = 20
RATE_RE = re.compile(r"rate limit|usage limit|5[-\s]?hour|limit reached|out of extra usage", re.I)


def ids() -> list[int]:
    return sorted(int(p.stem) for p in (RUN / "prompts").glob("*.txt"))


def chunks_of(xs: list[int]) -> list[tuple[int, list[int]]]:
    out = []
    for i in range(0, len(xs), CHUNK):
        out.append((i // CHUNK + 1, xs[i : i + CHUNK]))
    return out


def load_meta(stdout_path: Path) -> dict:
    text = stdout_path.read_text()
    lines = text.splitlines()
    body = "\n".join(lines[1:]) if lines and lines[0].startswith("[run-chunk]") else text
    # last JSON object
    start = body.find("{")
    if start < 0:
        raise ValueError("no JSON in stdout")
    return json.loads(body[start:])


def chunk_ok(n: int, want: list[int]) -> bool:
    path = RUN / "answers" / f"chunk-{n:02d}.jsonl"
    if not path.exists():
        return False
    got = []
    try:
        for ln in path.read_text().splitlines():
            if ln.strip():
                got.append(json.loads(ln)["id"])
    except json.JSONDecodeError:
        return False
    return got == want


def rate_limited(*paths: Path) -> bool:
    for p in paths:
        if p.exists() and RATE_RE.search(p.read_text(errors="replace")):
            return True
    return False


def prompt_for(n: int, want: list[int]) -> str:
    files = "\n".join(
        f"- `.cache/scoring/mms-8f-full/prompts/{i:04d}.txt`" for i in want
    )
    out = f".cache/scoring/mms-8f-full/answers/chunk-{n:02d}.jsonl"
    return f"""Read `.cache/scoring/mms-8f-full/SCORING_INSTRUCTIONS.md` and follow it exactly.

You ARE claude-fable-5-1. If you are any other model, write nothing and reply with exactly:
STOP: not claude-fable-5-1

Score only these occupation ids: {' '.join(map(str, want))}
Read only these files:
{files}
Write the JSONL (one object per line, no markdown fences) to:
`{out}`

Do not use structured-output / forced tool-schema features. Write the file as plain text JSONL.
Do not read data/scores, sample.json, other answer chunks, or baseline scores.
Do not spawn sub-agents. Do not edit src/, docs/, or data/.
After writing, print one line: path, n, ids, problems.
"""


def run_chunk(n: int, want: list[int]) -> None:
    logs = RUN / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    (RUN / "answers").mkdir(parents=True, exist_ok=True)
    prompt_path = logs / f"chunk-{n:02d}.prompt.txt"
    stdout_path = logs / f"chunk-{n:02d}.stdout.json"
    stderr_path = logs / f"chunk-{n:02d}.stderr.log"
    prompt_path.write_text(prompt_for(n, want))
    print(f"[score] chunk {n:02d}/{len(chunks_of(ids()))} ids={want[0]}..{want[-1]} n={len(want)}", flush=True)
    t0 = time.time()
    with prompt_path.open("rb") as stdin, stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
        proc = subprocess.run(
            [
                str(CLAUDE),
                "-p",
                "--model",
                "claude-fable-5-1",
                "--effort",
                "high",
                "--permission-mode",
                "bypassPermissions",
                "--output-format",
                "json",
                "--disallowedTools",
                "Agent,Task,WebSearch,WebFetch,NotebookEdit",
            ],
            cwd=str(ROOT),
            stdin=stdin,
            stdout=stdout,
            stderr=stderr,
        )
    elapsed = time.time() - t0
    if rate_limited(stdout_path, stderr_path):
        raise SystemExit(f"RATE_LIMIT chunk {n:02d} after {elapsed:.0f}s")
    if proc.returncode != 0:
        err = stderr_path.read_text(errors="replace")[-800:]
        raise SystemExit(f"claude exit {proc.returncode} chunk {n:02d}: {err}")
    meta = load_meta(stdout_path)
    if meta.get("is_error"):
        raise SystemExit(f"is_error chunk {n:02d}: {meta.get('result')}")
    if "STOP: not claude-fable-5-1" in str(meta.get("result")):
        raise SystemExit(f"wrong model chunk {n:02d}")
    usage = meta.get("modelUsage") or {}
    if "claude-fable-5-1" not in usage:
        raise SystemExit(f"fable-5-1 missing chunk {n:02d}: {list(usage)}")
    spawned = (meta.get("subagent_stats") or {}).get("spawned", 0)
    if spawned:
        raise SystemExit(f"subagents spawned={spawned} chunk {n:02d}")
    if not chunk_ok(n, want):
        raise SystemExit(f"invalid jsonl chunk {n:02d}")
    cost = meta.get("total_cost_usd")
    print(
        f"[score] OK chunk {n:02d} {elapsed:.0f}s cost={cost} out={usage['claude-fable-5-1'].get('outputTokens')}",
        flush=True,
    )


def main() -> int:
    all_ids = ids()
    if len(all_ids) != 556:
        print(f"expected 556 prompts, got {len(all_ids)}", file=sys.stderr)
        return 2
    todo = chunks_of(all_ids)
    for n, want in todo:
        if chunk_ok(n, want):
            print(f"[score] skip chunk {n:02d} already valid", flush=True)
            continue
        run_chunk(n, want)
    print(f"DONE: {len(todo)} chunks, {len(all_ids)} ids", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
