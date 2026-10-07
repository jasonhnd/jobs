#!/usr/bin/env python3
"""mms-11 chunk runner — local Claude Code writes AIOIS-10 answers as claude-opus-5-5.

Adapted from .cache/scoring/mms-8f-full/score_chunks.py (Claude Fable 5.1, mms-8.26).
This script never scores. Every chunk is written by a separate
`claude -p --model claude-opus-5-5 --effort high` process, and the script only
checks what that process wrote. Validation and appending stay with
`bun scripts/run-scoring.ts --provider in-agent ... --resume`.

Run from the lane worktree root (the directory that has scripts/run-scoring.ts):

  # pilot: 40 prompts, chunks of 5
  python3 <this> --run .cache/scoring/mms-11-pilot --chunk 5 --expect 40
  # full: 556 prompts, chunks of 20
  python3 <this> --run .cache/scoring/mms-11-full --chunk 20 --expect 556
  # re-score listed ids into answers/chunk-rescored-r1a.jsonl (max 20 ids);
  # a later round uses --name rescored-r2a (then rescored-r1b, rescored-r2b, ...)
  # so the later file sorts after the earlier one
  python3 <this> --run .cache/scoring/mms-11-full --ids 12,34 --name rescored-r1a
  # add --dry-run to any of the above: prints the plan and chunk 1 prompt, spawns nothing

Each chunk's claude process is killed after --timeout seconds (default 3600) and the
run stops with a TIMEOUT transport failure; re-running the same command retries it.

Stops (non-zero exit) on: timeout, rate limit, claude exit != 0, is_error, the model saying it
is not claude-opus-5-5, modelUsage without claude-opus-5-5, any modelUsage key other
than claude-opus-5-5 or a claude-haiku-* helper, sub-agents spawned, a malformed chunk,
or a tracked file changed in the worktree. Re-running skips chunks that are already valid.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

MODEL = "claude-opus-5-5"
HELPER_PREFIX = "claude-haiku-"
TEMPLATE = Path(__file__).with_name("opus55_SCORING_INSTRUCTIONS.template.md")
RATE_RE = re.compile(r"rate limit|usage limit|5[-\s]?hour|limit reached|out of extra usage", re.I)
DISALLOWED = "Agent,Task,WebSearch,WebFetch,NotebookEdit"
CHUNK_TIMEOUT_S = 3600


def fail(msg: str) -> "None":
    print(f"STOP: {msg}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--run", required=True, help="run dir relative to the worktree root, e.g. .cache/scoring/mms-11-full")
    p.add_argument("--chunk", type=int, default=20)
    p.add_argument("--expect", type=int, help="number of prompt files that must exist (40 pilot, 556 full)")
    p.add_argument("--ids", help="comma-separated ids to re-score into answers/chunk-<name>.jsonl")
    p.add_argument("--name", default="rescored", help="chunk file suffix for --ids")
    p.add_argument("--timeout", type=int, default=CHUNK_TIMEOUT_S,
                   help="seconds before one chunk's claude process is killed (default 3600)")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


def prompt_ids(run: Path) -> list[int]:
    return sorted(int(p.stem) for p in (run / "prompts").glob("*.txt"))


def plan(args: argparse.Namespace, run: Path) -> list[tuple[str, list[int]]]:
    all_ids = prompt_ids(run)
    if args.ids:
        want = [int(x) for x in args.ids.split(",") if x.strip()]
        missing = [i for i in want if i not in set(all_ids)]
        if missing:
            fail(f"no prompt file for ids {missing}")
        if not 0 < len(want) <= 20:
            fail("--ids takes 1-20 ids")
        if (run / "answers" / f"chunk-{args.name}.jsonl").exists():
            fail(f"answers/chunk-{args.name}.jsonl already exists — pick a new --name (rescored-r1b, rescored-r2a, ...)")
        return [(f"chunk-{args.name}", want)]
    if args.expect is None:
        fail("--expect is required unless --ids is given")
    if len(all_ids) != args.expect:
        fail(f"expected {args.expect} prompt files in {run}/prompts, found {len(all_ids)}")
    if args.chunk < 1:
        fail("--chunk must be positive")
    out = []
    for i in range(0, len(all_ids), args.chunk):
        out.append((f"chunk-{i // args.chunk + 1:02d}", all_ids[i : i + args.chunk]))
    return out


def ensure_instructions(run: Path, run_rel: str) -> None:
    target = run / "SCORING_INSTRUCTIONS.md"
    if target.exists():
        if "__RUN_DIR__" in target.read_text() or MODEL not in target.read_text():
            fail(f"{target} is not the Opus 5.5 instruction file for this run")
        return
    if not TEMPLATE.exists():
        fail(f"template missing: {TEMPLATE}")
    target.write_text(TEMPLATE.read_text().replace("__RUN_DIR__", run_rel))


def prompt_for(run_rel: str, stem: str, want: list[int]) -> str:
    files = "\n".join(f"- `{run_rel}/prompts/{i:04d}.txt`" for i in want)
    out = f"{run_rel}/answers/{stem}.jsonl"
    return f"""Read `{run_rel}/SCORING_INSTRUCTIONS.md` and follow it exactly.

You ARE {MODEL}. If you are any other model, write nothing and reply with exactly:
STOP: not {MODEL}

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


def chunk_ok(run: Path, stem: str, want: list[int]) -> bool:
    path = run / "answers" / f"{stem}.jsonl"
    if not path.exists():
        return False
    got = []
    try:
        for ln in path.read_text().splitlines():
            if ln.strip():
                got.append(json.loads(ln)["id"])
    except (json.JSONDecodeError, KeyError, TypeError):
        return False
    return sorted(got) == sorted(want) and len(got) == len(want)


def load_meta(stdout_path: Path) -> dict:
    text = stdout_path.read_text()
    start = text.find("{")
    if start < 0:
        raise ValueError("no JSON in stdout")
    return json.loads(text[start:])


def tracked_changes(root: Path) -> str:
    res = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=no"],
        cwd=str(root), capture_output=True, text=True,
    )
    return res.stdout.strip()


def run_chunk(
    root: Path, run: Path, run_rel: str, claude: str, stem: str, want: list[int], total: int,
    timeout_s: int = CHUNK_TIMEOUT_S,
) -> None:
    logs = run / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    (run / "answers").mkdir(parents=True, exist_ok=True)
    prompt_path = logs / f"{stem}.prompt.txt"
    stdout_path = logs / f"{stem}.stdout.json"
    stderr_path = logs / f"{stem}.stderr.log"
    prompt_path.write_text(prompt_for(run_rel, stem, want))
    print(f"[score] {stem} of {total} ids={want[0]}..{want[-1]} n={len(want)}", flush=True)
    t0 = time.time()

    def reject(msg: str) -> None:
        # Move whatever was written out of answers/ so the in-agent provider never
        # loads it and a re-run cannot mistake it for a valid chunk.
        written = run / "answers" / f"{stem}.jsonl"
        if written.exists():
            written.rename(logs / f"{stem}.rejected-{int(time.time())}.jsonl")
        fail(msg)

    with prompt_path.open("rb") as stdin, stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
        try:
            proc = subprocess.run(
                [
                    claude, "-p",
                    "--model", MODEL,
                    "--effort", "high",
                    "--permission-mode", "bypassPermissions",
                    "--output-format", "json",
                    "--disallowedTools", DISALLOWED,
                ],
                cwd=str(root), stdin=stdin, stdout=stdout, stderr=stderr,
                timeout=timeout_s,
            )
        except subprocess.TimeoutExpired:
            # subprocess.run has already killed and reaped the child.
            proc = None
    elapsed = time.time() - t0
    if proc is None:
        reject(
            f"TIMEOUT {stem} after {timeout_s}s — claude was killed (transport failure); "
            "re-run the same command to retry this chunk"
        )

    if RATE_RE.search(stdout_path.read_text(errors="replace") + stderr_path.read_text(errors="replace")):
        reject(f"RATE_LIMIT {stem} after {elapsed:.0f}s — wait for the usage window, then re-run the same command")
    if proc.returncode != 0:
        reject(f"claude exit {proc.returncode} {stem}: {stderr_path.read_text(errors='replace')[-800:]}")
    try:
        meta = load_meta(stdout_path)
    except (ValueError, json.JSONDecodeError) as err:
        reject(f"unreadable claude output {stem}: {err}")
    if meta.get("is_error"):
        reject(f"is_error {stem}: {meta.get('result')}")
    if f"STOP: not {MODEL}" in str(meta.get("result")):
        reject(f"wrong model {stem}")
    usage = meta.get("modelUsage") or {}
    if MODEL not in usage:
        reject(f"{MODEL} missing from modelUsage {stem}: {list(usage)}")
    foreign = [k for k in usage if k != MODEL and not k.startswith(HELPER_PREFIX)]
    if foreign:
        reject(f"foreign model in modelUsage {stem}: {foreign}")
    spawned = (meta.get("subagent_stats") or {}).get("spawned", 0)
    if spawned:
        reject(f"sub-agents spawned={spawned} {stem}")
    if not chunk_ok(run, stem, want):
        reject(f"invalid jsonl {stem}")
    changed = tracked_changes(root)
    if changed:
        reject(f"tracked files changed after {stem}:\n{changed}")
    print(
        f"[score] OK {stem} {elapsed:.0f}s cost={meta.get('total_cost_usd')} "
        f"out={usage[MODEL].get('outputTokens')} keys={sorted(usage)}",
        flush=True,
    )


def main() -> int:
    args = parse_args()
    if args.timeout < 1:
        fail("--timeout must be a positive number of seconds")
    root = Path.cwd()
    if not (root / "scripts" / "run-scoring.ts").exists():
        fail("run this from the lane worktree root (scripts/run-scoring.ts not found)")
    run_rel = args.run.rstrip("/")
    run = root / run_rel
    if not (run / "prompts").is_dir():
        fail(f"{run}/prompts does not exist — emit prompts with run-scoring.ts first")
    claude = shutil.which("claude")
    if not claude:
        fail("claude CLI not found on PATH")
    version = subprocess.run([claude, "--version"], capture_output=True, text=True).stdout.strip()
    todo = plan(args, run)
    ensure_instructions(run, run_rel)
    print(f"[plan] claude={claude} ({version}) model={MODEL} run={run_rel} chunks={len(todo)}", flush=True)
    if args.dry_run:
        for stem, want in todo:
            print(f"[plan] {stem}: {len(want)} ids {want[0]}..{want[-1]}")
        print("----- prompt for the first chunk -----")
        print(prompt_for(run_rel, todo[0][0], todo[0][1]))
        return 0
    if tracked_changes(root):
        fail("worktree has tracked changes before scoring; commit or stash them first")
    for stem, want in todo:
        if not args.ids and chunk_ok(run, stem, want):
            print(f"[score] skip {stem} already valid", flush=True)
            continue
        run_chunk(root, run, run_rel, claude, stem, want, len(todo), args.timeout)
    print(f"DONE: {len(todo)} chunk(s), {sum(len(w) for _, w in todo)} ids", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
