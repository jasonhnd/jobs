# Weekly offsite GEO CLI observation

Schedule ID: `3aebd404`. Active, every Monday at 09:00 Asia/Tokyo (`0 9 * * 1`).
Next scheduled run after setup: **2026-10-26 09:00 JST**.
The schedule agent remains local `codex/gpt-6.1-sol`, thinking `medium`, no provider fallback.
Paseo provider inspection reports a Speed feature, but this runner does not select it.
This CLI has no schedule feature flag, so the schedule uses the provider default.
The answering Codex process does not specify `service_tier`; per the 2026-10-22
request, it does not opt into Fast mode.
Do not create a second schedule. Gemini is another source inside this same runner.

## Operation

The scheduled agent reads `geo-offsite-weekly.md`, runs `geo-offsite-weekly.py` once,
checks local evidence and returns a summary. It does not send messages or commit.
Four fixed Japanese SOP questions are asked in separate empty working directories.
Claude, ChatGPT/Codex, and Gemini use existing subscriptions only. Each family is
sequential; at most two families overlap (`max_workers=2`). Questions contain no
monitored site/brand hints.
Claude only has WebSearch/WebFetch. Codex disables shell, ignores user config and
rules, uses ephemeral/read-only mode and receives no jobs repository content.
Gemini is the local `agy` binary with explicit model `gemini-3.8-flash-medium` and
`--output-format stream-json`. Version evidence is `agy --version`, not `gemini`.
The prompt is the same system instruction plus the question. It does not name the
monitored site. Each question has a 300-second process-group timeout.
Claude and Codex still merge stdout/stderr into one raw file. Gemini writes stdout
NDJSON to `raw/gemini-N.txt` and stderr to `raw/gemini-N.txt.stderr` so a permission
notice cannot break the event stream. There are no retries.

A Gemini row is successful only when all of these hold: exit 0, exactly one terminal
`result` event with status `SUCCESS`, a non-empty `result.response`, and at least one
successful web-search tool step. An observed pattern of exit 0 plus `SUCCESS` plus an
empty response (including an about-80-second empty print) is ERROR. Citations and
mention matching use `result.response` only, never tool output, search snippets, or
`text_delta`. Missing search, malformed or incomplete events, disallowed or failed
tools, unexpected models, `permission_mode=always-proceed`, nonzero exit, and timeouts
are ERROR.

Search-tool identity is **UNVERIFIED**. Official headless docs show `step_type=tool`
with `tool_name` and `tool_info`, and they show `result.response`, but they do not
name the web-search tool. No redacted empirical agy event was supplied.
`AGY_SEARCH_TOOL_NAMES` is empty, so any real tool step is rejected. Do not guess a
name. Synthetic tests patch a fake name; that is not evidence about real agy.

Permission enforcement is **BLOCKED**. `permissions.md` and `cli/headless.md` do not
document `agy --settings`. They put allow/deny/ask rules in the global file
`~/.gemini/antigravity-cli/settings.json`, which this runner must not modify. They
say workspace file reads and writes are auto-allowed, headless Ask actions are
soft-denied with exit 0, and `--dangerously-skip-permissions` is the skip switch.
This runner does not pass that switch. It does write a per-question settings document
and passes it as `agy --settings` because that is the requested per-run hook, with
deny rules `command(*)`, `unsandboxed(*)`, `read_file(*)`, `write_file(*)`, `mcp(*)`,
and `execute_url(*)`, and an empty allow list. That is not a claim that the installed
CLI loads the flag, that deny overrides workspace auto-allow, or that a search tool
is still permitted. Prompt text is not a control. Event inspection after the fact is
not prevention. Do not describe a Gemini row as a safe measurement while this gate
is BLOCKED.

Only final answers are matched for `mirai-shigoto.com`, `未来の仕事`, or `AIOIS-10`.
Perplexity is NOT_RUN (需付费 API). Google AI Overview is NOT_RUN (无接口). Those two
sources are never invoked. Historical Gemini rows that are already NOT_RUN stay
NOT_RUN. A fresh date still has 20 rows: 12 live rows (Claude, Codex, Gemini) and
8 NOT_RUN rows. Each source has the exact four SOP questions.

## Files and checks

- Runner and prompt: `~/AgenticCoder/paseo-daily/ops/schedules/geo-offsite-weekly.{py,md}`.
- Results root: `~/AgenticCoder/paseo-daily/reports/geo-offsite/`.
- `geo-log.csv`: append-only, exact trial 13-column order. Initial 20 historical rows
  are copied byte for byte. Keys are `(run_date, source, prompt_family)`.
- Live raw files on a fresh date: `YYYY-MM-DD/raw/{claude,codex,gemini}-[1-4].txt`
  plus `gemini-[1-4].txt.stderr`.
- `YYYY-MM-DD/{source}-[1-4].meta.json`: command, CLI version, start JST, monotonic
  elapsed seconds, exit code, usage, final-answer URLs, outcome and row journal.
  Gemini metadata also stores the per-run settings document, its sha256, model,
  `permission_enforcement=BLOCKED`, and `agy_search_event_shape=UNVERIFIED`.
  CLI list-price cost telemetry is not a bill; subscription quota is not disclosed.
- `YYYY-MM-DD/summary.json`: rows, appended count, total, Claude/Codex/Gemini mention
  counts, failures (ERROR and NOT_RUN), permission gate, and search-shape gate.
- `status.json`: per-date Claude/Codex status and emitted failure-streak alerts.
  All eight Claude/Codex rows must be ERROR/NOT_RUN for a week to count as failed.
  Gemini does not change that rule. Two consecutive dates seven days apart trigger
  `ALERT: 连续两周全失败` once per failure streak; nothing is sent externally.
- `.runner.lock`: prevents concurrent runs. Metadata claims prevent crash retries.
  An interrupted claim becomes ERROR on the next invocation without another CLI call.
  Preserve these files; removing them can bypass the no-retry safeguard.

Inspect the schedule and its last run:

```sh
paseo schedule ls --json
paseo schedule inspect 3aebd404 --json
paseo schedule logs 3aebd404 --json
cat ~/AgenticCoder/paseo-daily/reports/geo-offsite/2026-10-19/summary.json
```

For normal manual operation, use `paseo schedule run-once 3aebd404 --json` once.
Do not rerun a failed observation or change its date to force new calls.
The standalone runner accepts `--run-date YYYY-MM-DD --output-dir PATH`; its default
date is today in JST and its default directory is the results root above.
It never opens credential files. Existing login is used by each CLI internally.
If authentication is unavailable, do not log in automatically or create API keys.
Global CLI metadata may still differ from website sessions; CLI results are not
claims about the corresponding consumer website.

## Historical import and fresh validation (2026-10-19)

The supplied historical trial already has `run_date=2026-10-19` on all 20 rows.
Today's manual trigger therefore skips all 20 keys: **20 total, 0 appended**.
Appending another 20 today would violate the explicitly required idempotency key.
No date is rewritten, and historical answers are not described as new answers.
The eight trial Claude/Codex raw files and original metadata are copied unchanged
into `2026-10-19/`; `history-import.json` records their provenance. Historical
metadata lacks a CLI-version field; the original raw usage remains available.
Historical mention counts are ChatGPT **1/4**, Claude **0/4**; all eight answered
with search, and the 12 excluded-source rows are NOT_RUN. Those 12 include the
historical Gemini NOT_RUN rows (命令行未登录). This change does not edit them.
Historical cumulative call durations are Claude 302.304 seconds, ChatGPT 149.158
seconds; these are not fresh-run timing. The next distinct scheduled date can append
the next 20 rows, now with Gemini live and Perplexity/Google AI Overview NOT_RUN.
The leader corrected the 40-row criterion: keep the cumulative table at 20 historical
rows today and verify eight fresh calls in a separate journal. The isolated command
already used for that earlier round is:

```sh
python3 ops/schedules/geo-offsite-weekly.py --run-date 2026-10-19 \
  --output-dir reports/geo-offsite-verify \
  --csv-path reports/geo-offsite-verify/2026-10-19/geo-log.csv
```

`--csv-path` creates an empty 13-column journal without importing history. Its
status and lock live beside that CSV. Raw files, metadata and summary remain under
`--output-dir/YYYY-MM-DD/`. Deduplication and no-retry claims still apply. This
verification command was authorized for one round only; do not repeat it.

## One Gemini acceptance journal

Local Tech owns installation and the single post-install acceptance. Do not run it
from the weekly schedule, and do not point it at `reports/geo-offsite/geo-log.csv`.
Use a separate output directory and CSV. Run the runner once. Do not retry, do not
change the date to manufacture rows, and do not call the feature complete unless
real agy output shows a confirmed search tool step and a non-empty final response.
While `AGY_SEARCH_TOOL_NAMES` is empty and `PERMISSION_ENFORCEMENT` is BLOCKED, that
acceptance cannot succeed; keep the raw stdout, stderr, and metadata for a redacted
hand-back instead of treating ERROR rows as a measured result.

```sh
python3 ops/schedules/geo-offsite-weekly.py \
  --run-date YYYY-MM-DD \
  --output-dir reports/geo-offsite-gemini-acceptance \
  --csv-path reports/geo-offsite-gemini-acceptance/geo-log.csv
```

Replace `YYYY-MM-DD` with the JST date of that one run. This is not a new schedule.

## Stop or resume

Pause this schedule (keeps evidence and configuration):

```sh
paseo schedule pause 3aebd404
```

Delete this schedule instead:

```sh
paseo schedule delete 3aebd404
```

Resume a paused schedule: `paseo schedule resume 3aebd404`.
Do not create a replacement schedule while this one exists.

## Local verification

Offline tests do not call agy, Claude, or Codex. They use a synthetic 20-row history
and a synthetic SOP text inside the test harness. Production `HISTORY` and the
default output path stay on the paseo-daily locations. `KANBAN_TMP` must be a
temporary directory outside the tracked source tree.

`PYTHONDONTWRITEBYTECODE=1 python3 ops/schedules/geo-offsite-weekly.test.py`
with `KANBAN_TMP` set: 20 offline tests. They cover the original idempotency, lock,
crash claim, process-group timeout, 13 columns, Claude/Codex parse and alert rules,
plus Gemini command shape, fail-closed stream parsing, empty SUCCESS, disallowed
tools, and fresh-date row counts. Passing Gemini parser cases patch a synthetic tool
name. They are not real agy evidence.
AST parsing is the build check for this standalone standard-library Python runner;
there are no added packages or website changes. No browser is opened.

Previously recorded, not re-run by this change: the jobs dependency install passed
with Bun 1.4.2 (339 packages); jobs is unchanged. Manual schedule run succeeded:
2026-10-19 20:38:44.475–20:39:29.737 JST (45.262 seconds including orchestration);
runner invoked once, zero new answering CLI calls. Fresh rework validation completed
once: 2026-10-19, about 279.965 seconds; 8/8 successful searched answers, ChatGPT
1/4 mentions and Claude 0/4. Isolated journal:
`reports/geo-offsite-verify/2026-10-19/` (20 rows, 8 raw files, metadata, summary,
REPORT.md and verification.json). Cumulative history remained byte-identical at 20
rows. No retries or schedule changes.
