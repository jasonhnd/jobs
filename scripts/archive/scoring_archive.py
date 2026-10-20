#!/usr/bin/env python3
"""Append-only, offline backup of scoring answers (Issue #922).

Only the build subcommand reads a source cache. Neither command executes a
cached helper or contacts a scoring provider. Supply private identifiers in
an external newline-delimited file; never commit that file.
"""

import argparse
from collections import Counter
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[2]
DATA = Path("data/_archive/scoring-raw")
HELPERS = Path("scripts/archive/cached-helpers")
SCORE_KEYS = {"id", "ai_risk", "rationale_ja", "confidence", "aiois"}
CODE_EXTENSIONS = {".mjs", ".js", ".ts", ".py", ".sh"}
PATTERNS = {
    "local_path": r"/(?:Users|home|private)/[^\s\"'`<>;,)}\]]*",
    "email": r"[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}",
    "email_domain": r"@[A-Za-z0-9.-]+\.(?:com|jp|net|org)",
    "provider_key": r"(?:sk|xai)-[A-Za-z0-9_-]+",
    "github_token": r"(?:gh[pousr]|github_pat)_[A-Za-z0-9_]+",
    "bearer": r"(?i:bearer)\s+[^\s\"'`,;]+",
    "aws_key": r"A[K]IA[A-Z0-9]*",
    "private_key": r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----",
}
SENSITIVE_FIELD = re.compile(
    r"^(?:operator|user(?:name|_id)?|account(?:_id|_name)?|email|"
    r"api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|"
    r"password|authorization|credentials|session[_-]?id|request[_-]?id)$", re.I
)


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


class Redactor:
    def __init__(self, identifiers):
        self.patterns = {key: re.compile(value, re.I) for key, value in PATTERNS.items()}
        for index, identifier in enumerate(identifiers):
            self.patterns["identifier_" + str(index)] = re.compile(re.escape(identifier), re.I)
        self.counts = Counter()

    def text(self, value):
        for key, pattern in self.patterns.items():
            value, count = pattern.subn("__REDACTED_" + key.split("_")[0].upper() + "__", value)
            self.counts[key] += count
        return value

    def value(self, value):
        if isinstance(value, dict):
            result = {}
            for key, item in value.items():
                if SENSITIVE_FIELD.fullmatch(key) and item not in (None, ""):
                    result[key] = "__REDACTED_FIELD__"
                    self.counts["sensitive_field"] += 1
                else:
                    result[self.text(key)] = self.value(item)
            return result
        if isinstance(value, list):
            return [self.value(item) for item in value]
        return self.text(value) if isinstance(value, str) else value

    def hits(self, value):
        # Scan JSON-escaped and URL-encoded forms as well as literal text.
        variants = {value, value.replace("\\/", "/"), unquote(value)}
        if "\\u" in value:
            variants.add(re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m[1], 16)), value))
        return {key for key, pattern in self.patterns.items()
                if any(pattern.search(variant) for variant in variants)}


def files_under(root):
    """Do not traverse symlinks, dependency trees, or credential directories."""
    for path in sorted(root.iterdir()):
        if path.is_symlink():
            continue
        if path.is_dir():
            if path.name not in {"node_modules", ".git", ".vercel", ".ssh"}:
                yield from files_under(path)
        elif path.is_file():
            yield path


def scores_from_text(text):
    """Extract score objects, discarding retry delimiters and transport text."""
    decoder = json.JSONDecoder()
    result = []
    offset = 0
    while True:
        start = text.find("{", offset)
        if start < 0:
            break
        try:
            value, end = decoder.raw_decode(text, start)
            offset = end
        except json.JSONDecodeError:
            offset = start + 1
            continue
        if isinstance(value, dict) and SCORE_KEYS <= value.keys():
            result.append({key: value[key] for key in sorted(SCORE_KEYS)})
    return result


def jsonl(scores, redactor):
    return "".join(json.dumps(redactor.value(score), ensure_ascii=False) + "\n"
                   for score in scores).encode()


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def write_new(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as file:
        file.write(data)


def pack(members, manifest):
    output = io.BytesIO()
    # Neutral ownership, timestamps and filename make the artifact reproducible.
    with gzip.GzipFile(filename="", fileobj=output, mode="wb", mtime=0, compresslevel=9) as gz:
        with tarfile.open(fileobj=gz, mode="w", format=tarfile.USTAR_FORMAT) as tar:
            for name, data in [("MANIFEST.json", encode(manifest)), *sorted(members.items())]:
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o644
                tar.addfile(info, io.BytesIO(data))
    return output.getvalue()


def build(args, redactor):
    destination = args.destination.resolve()
    cache = args.cache.resolve()
    archive_root = destination / DATA
    helper_root = destination / HELPERS
    if archive_root.exists() or helper_root.exists():
        raise ValueError("Archive destinations already exist; refusing to overwrite")
    prompt_hashes = {digest(p.read_bytes()) for p in files_under(ROOT / "data/prompts")}
    github_objects = {
        line.split()[0] for line in subprocess.check_output(
            ["git", "rev-list", "--objects", "--remotes=origin"], cwd=ROOT, text=True
        ).splitlines()
    }
    tracked_objects = set(subprocess.check_output(
        ["git", "ls-files", "--stage"], cwd=ROOT, text=True
    ).split())
    batches = []
    skipped_batches = []
    for batch in sorted((cache / "scoring").iterdir()):
        if not batch.is_dir() or batch.is_symlink():
            continue
        if re.search(r"preflight|probe", batch.name):
            skipped_batches.append((batch.name, "provider preflight/probe, not a scoring batch"))
            continue
        members = {}
        inventory = []
        excluded = Counter()
        models, dates = set(), set()
        redactions_before = redactor.counts.copy()
        for path in files_under(batch):
            relative = path.relative_to(batch)
            name = relative.as_posix()
            kind, payload = None, None
            if path.name.startswith("occupations") and path.suffix == ".json":
                value = json.loads(path.read_text())
                if not isinstance(value, dict) or not isinstance(value.get("scores"), list):
                    raise ValueError("Unexpected final scoring schema: " + name)
                model = value.get("scorer", {}).get("model")
                date = value.get("run", {}).get("run_date")
                if model:
                    models.add(model)
                if date:
                    dates.add(date)
                kind, payload = "final", encode(redactor.value(value))
            elif "prompts" in relative.parts and path.suffix in {".txt", ".md"}:
                raw = path.read_bytes()
                if digest(raw) in prompt_hashes:
                    excluded["prompt already in data/prompts"] += 1
                    continue
                kind, payload = "prompt", redactor.text(raw.decode()).encode()
            elif (("answers" in relative.parts and path.suffix in {".json", ".jsonl", ".txt"})
                  or (path.parent.name == "raw" and re.fullmatch(r"\d+\.txt", path.name))
                  or re.fullmatch(r"(?:raw-scores[^/]*|raw_gpt[^/]*)\.jsonl", path.name)):
                scores = scores_from_text(path.read_text())
                if not scores:
                    excluded["empty or non-answer raw file"] += 1
                    continue
                kind, payload = "answer", jsonl(scores, redactor)
                if path.parent.name == "raw":
                    name = str(relative.with_suffix(".jsonl"))
            elif path.name.endswith(".envelope.json"):
                value = json.loads(path.read_text())
                scores = scores_from_text(json.dumps(value.get("structuredOutput"), ensure_ascii=False))
                if not scores:
                    scores = scores_from_text(value.get("text") or "")
                peer = path.with_name(path.name.replace(".envelope.json", ".txt"))
                if peer.is_file() and scores == scores_from_text(peer.read_text()):
                    excluded["envelope answer already in raw text"] += 1
                    continue
                if not scores:
                    excluded["envelope without scoring answer"] += 1
                    continue
                kind, payload = "answer", jsonl(scores, redactor)
                name = str(relative.with_suffix(".jsonl"))
            else:
                excluded["runtime records, schemas, source inputs, reports or helpers"] += 1
                continue
            if redactor.hits(payload.decode()) or redactor.hits(name):
                raise ValueError("Unsanitized archive member: " + name)
            if name in members:
                raise ValueError("Duplicate archive member: " + name)
            members[name] = payload
            inventory.append({"source": ".cache/scoring/" + batch.name + "/" + relative.as_posix(),
                              "member": name, "kind": kind, "bytes": len(payload), "sha256": digest(payload)})
        if not members:
            skipped_batches.append((batch.name, "no answer, final scoring JSON or unique prompt"))
            continue
        # The name can establish historical provenance when no final file survives.
        if not dates:
            dates.update(re.findall(r"20\d{2}-\d{2}-\d{2}", batch.name))
        if not models:
            for model in ["claude-opus-5", "grok-4.6", "gpt-5.6-sol"]:
                if model in batch.name:
                    models.add(model)
        manifest = {"schema_version": 1, "source": ".cache/scoring/" + batch.name,
                    "models": sorted(models), "run_dates": sorted(dates),
                    "date_basis": "final run metadata or batch name; empty means unknown",
                    "excluded": dict(sorted(excluded.items())),
                    "redactions": dict(sorted((redactor.counts - redactions_before).items())),
                    "files": inventory}
        payload = pack(members, manifest)
        if len(payload) >= 50_000_000:
            raise ValueError("Archive exceeds 50 MB: " + batch.name)
        write_new(archive_root / (batch.name + ".tar.gz"), payload)
        batches.append((batch.name, manifest, len(payload), digest(payload)))

    helper_rows, duplicate_helpers = [], []
    for path in files_under(cache):
        if path.suffix not in CODE_EXTENSIONS:
            continue
        relative = path.relative_to(cache)
        raw = path.read_bytes()
        if git_blob(raw) in github_objects | tracked_objects:
            duplicate_helpers.append(relative.as_posix())
            continue
        payload = redactor.text(raw.decode()).encode()
        if redactor.hits(payload.decode()):
            raise ValueError("Unsanitized helper: " + relative.as_posix())
        write_new(helper_root / relative, payload)
        helper_rows.append((relative.as_posix(), len(payload), digest(payload)))

    total = sum(row[2] for row in batches)
    readme = ["# Sanitized historical scoring answers", "",
              "Offline, append-only backup for Issue #922 (SB-20261020-04), archived 2026-10-20.",
              "Sources are relative to the original workspace; the source cache was read without modification.",
              "These files are audit backups and are not read by the ETL or public site.", "",
              "## Contents and provenance", "",
              "Each deterministic tar/gzip contains `MANIFEST.json` plus sanitized answer, prompt and final-score members.",
              "The manifest is the complete file list: original relative source, archived member, kind, byte size and sanitized SHA-256.",
              "It also records redaction counts, excluded-file counts, dates and models. An unknown date is explicitly left unknown.",
              "Answers can include multiple attempts and historical intermediate states; this backup does not certify score correctness.", "",
              "| Source under `.cache/scoring/` / archive stem | Run date(s) | Model(s) | Answers | Prompts | Final JSON | Compressed bytes |",
              "| --- | --- | --- | ---: | ---: | ---: | ---: |"]
    for name, manifest, size, _ in batches:
        counts = Counter(row["kind"] for row in manifest["files"])
        readme.append("| `" + name + "` | " + (", ".join(manifest["run_dates"]) or "Unknown") + " | "
                      + (", ".join(manifest["models"]) or "Unknown (partial run)")
                      + " | " + " | ".join(str(counts[k]) for k in ("answer", "prompt", "final")) + " | " + str(size) + " |")
    readme += ["", f"Total: **{len(batches)} archives, {total:,} compressed bytes**. Every archive is below 50,000,000 bytes.", "",
               "## Selection and redaction", "",
               "- Preserve scoring objects from `answers/`, numeric `raw/*.txt`, and aggregate raw-score JSONL. Only score fields survive extraction; retry separators, progress and transport text do not.",
               "- Extract only scoring answers from provider envelopes when they differ from the saved raw answer. Discard thought/session/request/usage metadata and preflight/probe batches.",
               "- Preserve all surviving final `occupations*.json`, including separately named reassembled outputs. Replace nonempty operator/account/credential fields.",
               "- Preserve expanded scoring prompts unless their exact SHA-256 matches a tracked `data/prompts/` file. Sandbox prompt copies and pilot input chunks are not separate prompt records.",
               "- Replace workstation paths, emails, credential formats and privately supplied account identifiers with `__REDACTED_*__` placeholders. Never publish the private identifier list.",
               "- Exclude logs, stdout/stderr, failures, heartbeats, process state, provider preflight, schemas, input samples, drift/review documents and other Markdown notes.",
               "- Original cache files remain intact. Archived bytes are intentionally transformed; manifest hashes describe sanitized bytes, not the source or a newly accepted scoring run.", "",
               "## Skipped source directories", ""]
    readme += ["- `" + name + "`: " + reason + "." for name, reason in skipped_batches]
    readme += ["", "## Reproduction and verification", "", "Run from the repository root after fetching GitHub refs. Use an empty output directory and a private identifier file outside tracked content:", "", "```sh",
               "python3 scripts/archive/scoring_archive.py build --cache \"$SOURCE_CACHE\" --destination \"$KANBAN_TMP/rebuilt\" --identifiers-file \"$KANBAN_TMP/redact-identifiers.txt\"",
               "python3 scripts/archive/scoring_archive.py verify --root . --identifiers-file \"$KANBAN_TMP/redact-identifiers.txt\"",
               "```", "", "The verifier reads every new archive member, validates manifest hashes and safe tar metadata, checks archive limits, and scans all files under both new archive directories. It also scans decoded URL/JSON forms.",
               "To inspect manually, extract only into the executing card's temporary directory. Never overwrite a previous batch.", ""]
    write_new(archive_root / "README.md", "\n".join(readme).encode())
    helper_readme = ["# Historical cached development helpers", "",
                     "Sanitized backup for Issue #922. Files retain their original path relative to `.cache/` below `cached-helpers/`.",
                     "These are historical source artifacts, not supported entrypoints. Do not execute them: they may contain obsolete scoring, deployment, merge or branch-deletion commands. This backup executed none of them.",
                     "Local paths and private identifiers have been replaced by placeholders; manual adaptation and current authorization are required before any future use.", "",
                     "| Original cached path | Purpose | Bytes |", "| --- | --- | ---: |"]
    purposes = {"verify_band_rule.py": "Historical numerical band-rule verification.",
                "merge-queue.sh": "Historical sequential PR queue controller (inactive).",
                "mms-829-preview-check.mjs": "Historical preview browser verification.",
                "start-after-opus.sh": "Historical dependent scoring-run trigger (inactive).",
                "score_chunks.py": "Historical chunked in-session scoring helper (inactive).",
                "run-chunk.sh": "Historical pilot scoring chunk wrapper (inactive).",
                "finish.sh": "Historical scoring assembly/finalization helper (inactive).",
                "score_one.py": "Historical single-occupation scoring helper (inactive)."}
    helper_readme += [f"| `{name}` | {purposes.get(Path(name).name, 'Historical development helper (inactive).')} | {size} |"
                      for name, size, _ in helper_rows]
    helper_readme += ["", "Skipped exact GitHub/repository duplicates:", ""]
    helper_readme += ["- `" + name + "` (exact Git blob already reachable in fetched GitHub refs)." for name in duplicate_helpers]
    helper_readme += ["", "The cached `etl/build-manifest.json` is omitted: `src/data/promote.ts` regenerates it during `bun run build:data`; it records build IDs, finish time and promoted entries, rather than unique source data.",
                      "Other cached Markdown is outside this Issue. The generator and verifier are in `scoring_archive.py`.", ""]
    write_new(destination / "scripts/archive/README.md", "\n".join(helper_readme).encode())
    print(f"BUILD archives={len(batches)} compressed_bytes={total} helpers={len(helper_rows)} duplicate_helpers={len(duplicate_helpers)}")


def verify(args, redactor):
    root = args.root.resolve()
    failures = []
    scanned, archives, member_count = 0, 0, 0
    for directory in (root / DATA, root / "scripts/archive"):
        for path in files_under(directory):
            relative = path.relative_to(root).as_posix()
            if path.name.endswith(".tar.gz"):
                archives += 1
                if path.stat().st_size >= 50_000_000:
                    failures.append(relative + ": size limit")
                actual = {}
                with tarfile.open(path, "r:gz") as tar:
                    for member in tar.getmembers():
                        name = PurePosixPath(member.name)
                        if (not member.isfile() or name.is_absolute() or ".." in name.parts
                                or member.uid or member.gid or member.uname or member.gname or member.mtime):
                            failures.append(relative + ": unsafe member metadata")
                            continue
                        payload = tar.extractfile(member).read()
                        actual[member.name] = payload
                        scanned += 1
                        member_count += 1
                        for hit in redactor.hits(member.name + "\n" + payload.decode()):
                            failures.append(relative + ": " + member.name + ": " + hit)
                manifest = json.loads(actual.pop("MANIFEST.json"))
                expected = {item["member"]: item for item in manifest["files"]}
                if actual.keys() != expected.keys():
                    failures.append(relative + ": manifest member mismatch")
                for name, payload in actual.items():
                    if expected[name]["bytes"] != len(payload) or expected[name]["sha256"] != digest(payload):
                        failures.append(relative + ": manifest hash/size mismatch")
            else:
                scanned += 1
                for hit in redactor.hits(relative + "\n" + path.read_text()):
                    failures.append(relative + ": " + hit)
    print(f"SCAN files_and_members={scanned} archives={archives} archive_members={member_count}")
    print(f"Sensitive-pattern matches: {len(failures)}")
    if failures:
        # Never print sensitive matched values.
        print("\n".join(failures))
        raise SystemExit(1)
    print("Archive manifests, hashes, metadata and size limits: PASS")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    build_parser = subcommands.add_parser("build")
    build_parser.add_argument("--cache", type=Path, required=True)
    build_parser.add_argument("--destination", type=Path, required=True)
    verify_parser = subcommands.add_parser("verify")
    verify_parser.add_argument("--root", type=Path, required=True)
    for command in (build_parser, verify_parser):
        command.add_argument("--identifiers-file", type=Path, required=True)
    args = parser.parse_args()
    identifiers = [line.strip() for line in args.identifiers_file.read_text().splitlines() if line.strip()]
    if not identifiers:
        parser.error("A nonempty private identifier list is required")
    redactor = Redactor(identifiers)
    (build if args.command == "build" else verify)(args, redactor)


if __name__ == "__main__":
    main()
