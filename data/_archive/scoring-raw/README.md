# Sanitized historical scoring answers

Offline, append-only backup for Issue #922 (SB-20261020-04), archived 2026-10-20.
Sources are relative to the original workspace; the source cache was read without modification.
These files are audit backups and are not read by the ETL or public site.

## Contents and provenance

Each deterministic tar/gzip contains `MANIFEST.json` plus sanitized answer, prompt and final-score members.
The manifest is the complete file list: original relative source, archived member, kind, byte size and sanitized SHA-256.
It also records redaction counts, excluded-file counts, dates and models. An unknown date is explicitly left unknown.
Answers can include multiple attempts and historical intermediate states; this backup does not certify score correctness.

| Source under `.cache/scoring/` / archive stem | Run date(s) | Model(s) | Answers | Prompts | Final JSON | Compressed bytes |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `claude-opus-5` | Unknown | claude-opus-5 | 8 | 0 | 0 | 8515 |
| `claude-opus-5-full` | 2026-07-26 | claude-opus-5 | 617 | 556 | 1 | 1091451 |
| `claude-opus-5-pilot` | 2026-07-26 | claude-opus-5 | 49 | 0 | 1 | 21189 |
| `grok-4.6` | 2026-09-06 | grok-4.6 | 3 | 0 | 1 | 21959 |
| `grok-4.6-dry-run` | Unknown | grok-4.6 | 1 | 0 | 0 | 936 |
| `grok-4.6-full-2026-09-07` | 2026-09-07 | grok-4.6 | 52 | 0 | 0 | 12126 |
| `grok-4.6-in-agent` | 2026-09-07 | grok-4.6 | 1 | 0 | 2 | 170750 |
| `grok-4.6-in-agent-2026-09-07` | 2026-09-07 | grok-4.6 | 585 | 556 | 0 | 943876 |
| `grok-4.6-pilot-2026-09-06` | 2026-09-06 | grok-4.6 | 40 | 0 | 0 | 10239 |
| `issue-126` | 2026-07-12 | gpt-5.6-sol | 2 | 0 | 2 | 123301 |
| `mms-10-full` | 2026-09-22 | grok-4.7-build-fast | 580 | 556 | 1 | 1112266 |
| `mms-10-full-high-partial` | Unknown | grok-4.7-build | 53 | 56 | 0 | 91125 |
| `mms-10-pilot` | 2026-09-22 | grok-4.7 | 43 | 40 | 1 | 90139 |
| `mms-11-full` | 2026-09-23 | claude-opus-5-5 | 590 | 556 | 1 | 1153381 |
| `mms-11-pilot` | 2026-09-23 | claude-opus-5-5 | 50 | 40 | 1 | 84740 |
| `mms-12-full` | 2026-09-23 | gpt-6-sol | 557 | 0 | 1 | 189162 |
| `mms-12-pilot` | 2026-09-23 | gpt-6-sol | 46 | 0 | 1 | 15486 |
| `mms-13-full` | 2026-10-01 | gpt-6.1-sol | 557 | 0 | 1 | 235448 |
| `mms-13-pilot` | 2026-10-01 | gpt-6.1-sol | 46 | 0 | 1 | 18897 |
| `mms-8f-full` | 2026-09-09 | claude-fable-5-1 | 586 | 556 | 1 | 1085316 |
| `mms-8f-pilot` | 2026-09-09 | claude-fable-5-1 | 49 | 40 | 1 | 89590 |
| `mms-8g-full` | 2026-09-09, 2026-09-10 | gpt-6-astra | 557 | 0 | 2 | 316414 |
| `mms-8g-pilot` | 2026-09-09 | gpt-6-astra | 46 | 0 | 1 | 21491 |
| `mms-9-full` | 2026-09-10 | grok-4.5 | 1141 | 556 | 1 | 1184240 |
| `mms-9-pilot` | 2026-09-10 | grok-4.5 | 89 | 40 | 1 | 93502 |
| `raw_gpt-5.6-sol_2026-07-12-gpt-5.6-sol-20260712T144220Z` | 2026-07-12 | gpt-5.6-sol | 40 | 0 | 0 | 9700 |
| `raw_gpt-5.6-sol_2026-07-12-gpt-5.6-sol-20260712T233113Z` | 2026-07-12 | gpt-5.6-sol | 515 | 0 | 0 | 94495 |
| `raw_gpt-5.6-sol_2026-07-12-gpt-5.6-sol-20260713T020609Z` | 2026-07-12 | gpt-5.6-sol | 1 | 0 | 0 | 910 |
| `raw_gpt-5.6-sol_2026-07-12-gpt-5.6-sol-20260713T020815Z` | 2026-07-12 | gpt-5.6-sol | 3 | 0 | 0 | 1505 |

Total: **29 archives, 8,292,149 compressed bytes**. Every archive is below 50,000,000 bytes.

## Selection and redaction

- Preserve scoring objects from `answers/`, numeric `raw/*.txt`, and aggregate raw-score JSONL. Only score fields survive extraction; retry separators, progress and transport text do not.
- Extract only scoring answers from provider envelopes when they differ from the saved raw answer. Discard thought/session/request/usage metadata and preflight/probe batches.
- Preserve all surviving final `occupations*.json`, including separately named reassembled outputs. Replace nonempty operator/account/credential fields.
- Preserve expanded scoring prompts unless their exact SHA-256 matches a tracked `data/prompts/` file. Sandbox prompt copies and pilot input chunks are not separate prompt records.
- Replace workstation paths, emails, credential formats and privately supplied account identifiers with `__REDACTED_*__` placeholders. Never publish the private identifier list.
- Exclude logs, stdout/stderr, failures, heartbeats, process state, provider preflight, schemas, input samples, drift/review documents and other Markdown notes.
- Original cache files remain intact. Archived bytes are intentionally transformed; manifest hashes describe sanitized bytes, not the source or a newly accepted scoring run.

## Skipped source directories

- `mms-10-fast-probe`: provider preflight/probe, not a scoring batch.
- `mms-10-preflight`: provider preflight/probe, not a scoring batch.
- `mms-11-preflight`: provider preflight/probe, not a scoring batch.
- `mms-12-preflight`: provider preflight/probe, not a scoring batch.
- `mms-13-preflight`: provider preflight/probe, not a scoring batch.
- `mms-8g-preflight`: provider preflight/probe, not a scoring batch.
- `raw-scores-claude-opus-5-20260727T094133Z`: no answer, final scoring JSON or unique prompt.

## Reproduction and verification

Run from the repository root after fetching GitHub refs. Use an empty output directory and a private identifier file outside tracked content:

```sh
python3 scripts/archive/scoring_archive.py build --cache "$SOURCE_CACHE" --destination "$KANBAN_TMP/rebuilt" --identifiers-file "$KANBAN_TMP/redact-identifiers.txt"
python3 scripts/archive/scoring_archive.py verify --root . --identifiers-file "$KANBAN_TMP/redact-identifiers.txt"
```

The verifier reads every new archive member, validates manifest hashes and safe tar metadata, checks archive limits, and scans all files under both new archive directories. It also scans decoded URL/JSON forms.
To inspect manually, extract only into the executing card's temporary directory. Never overwrite a previous batch.
