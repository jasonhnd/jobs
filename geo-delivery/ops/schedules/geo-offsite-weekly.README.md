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
Gemini is the local `agy` binary with explicit model `gemini-4-argon-high` and
`--output-format stream-json`. The redacted Tech sample HAF-20261029-6560 names
the web-search tool `search_web`. That sample is not a live run of this candidate.
While `PERMISSION_ENFORCEMENT` is BLOCKED the runner does not launch `agy` and does
not probe `agy --version`. The prompt is the same system instruction plus the
question. It does not name the monitored site. Any process the runner does start
still has a 300-second process-group timeout. There are no retries.

Claude and Codex still merge stdout/stderr into one raw file. A Gemini process, if
a later change is allowed to start one, writes stdout NDJSON to `raw/gemini-N.txt`
and stderr to `raw/gemini-N.txt.stderr`. This candidate starts no Gemini process,
so those files are absent. Do not invent them.

A Gemini measurement can succeed only when the gate is open and all of these hold:
exit 0, no stderr `print timeout ... turn in progress; returning partial output`,
exactly one terminal `result` with status `SUCCESS`, a non-empty `result.response`,
at least one `search_web` step that ends DONE, and no tool step left ACTIVE.
Empty SUCCESS is ERROR even with no stderr. A nonempty partial response is still
ERROR when that print-timeout stderr is present. Exit 0, SUCCESS, or a search count
alone is not success. Pending tools, a missing terminal result, malformed events,
malformed `tool_info` when that object is present, unknown tools (command, MCP,
file, and anything other than `search_web`), unexpected models,
`permission_mode=always-proceed`, nonzero exit, and process-group timeouts are
ERROR. There is no automatic retry.

The redacted success sample's DONE `search_web` step has no `tool_info`. The parser
accepts that minimal shape. It does not treat the omission as Tech's claim that the
original stream lacked the field. If `tool_info` is present it must be an object
whose `name` matches the tool and which has no error. Citations and mention matching
use `result.response` only, never tool output, search snippets, `text_delta`, or
names listed only in `init.tools`.

`AGY_SEARCH_TOOL_NAMES` is exactly `search_web`, from that redacted sample.
`AGY_SEARCH_EVENT_SHAPE` is `REDACTED_SAMPLE_HAF-20261029-6560`. Offline fixtures
replace the removed answer and the `<数字>` usage placeholders with a dummy
sentence and integers. They are not a live CLI verification. Do not describe the
sample as acceptance of this candidate.

Permission enforcement is **BLOCKED**. The runner fail-closes before any Gemini
process, including a version probe, and writes `mentioned=ERROR`. It does not write
NOT_RUN: Gemini is a configured source, but the measurement did not run. It does
not write a success. No code path sets the gate to verified because a user setting
changed, a settings file exists, an environment variable is set, or a parser
accepted an event. The open token is not assigned in this source file.

`permissions.md` and `cli/headless.md` do not document `agy --settings` and put
allow/deny/ask rules in `~/.gemini/antigravity-cli/settings.json`, which this
runner must not modify. They say workspace file reads and writes are auto-allowed,
headless Ask actions are soft-denied with exit 0, and
`--dangerously-skip-permissions` is the skip switch. This runner does not pass
that switch. Local `agy` 1.4.10 `--help` is reported to list per-session
`--settings`. Official docs may differ. Help text does not prove the flag is
loaded, that deny rules override workspace auto-allow, or that `search_web` still
runs under those denies. The runner still records a per-question settings document
with deny rules `command(*)`, `unsandboxed(*)`, `read_file(*)`, `write_file(*)`,
`mcp(*)`, and `execute_url(*)`, and an empty allow list. It records the argv it
refused to execute. Prompt text is not a control. Event inspection after the fact
is not prevention. The environment owner has to establish actual prevention before
a separate Tech-approved change opens the gate. Do not describe a Gemini row as a
safe measurement while this gate is BLOCKED.

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
- Live raw files on a fresh date while Gemini is blocked: `YYYY-MM-DD/raw/{claude,codex}-[1-4].txt`.
  Gemini raw stdout and stderr are absent because `agy` is not started. Do not invent them.
- `YYYY-MM-DD/{source}-[1-4].meta.json`: command, CLI version, start JST, monotonic
  elapsed seconds, exit code, usage, final-answer URLs, outcome and row journal.
  Gemini metadata stores the per-run settings document, its sha256, model
  `gemini-4-argon-high`, `launched=false`, null CLI version, null exit, elapsed 0,
  `permission_enforcement=BLOCKED`, and
  `agy_search_event_shape=REDACTED_SAMPLE_HAF-20261029-6560`.
  CLI list-price cost telemetry is not a bill; subscription quota is not disclosed.
- `YYYY-MM-DD/summary.json`: rows, appended count, total, Claude/Codex/Gemini mention
  counts, failures (ERROR and NOT_RUN), permission gate, search-shape gate, and
  `gemini_processes=not_launched` while the gate is BLOCKED.
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
the next 20 rows. Perplexity and Google AI Overview stay NOT_RUN. Gemini rows on a
new date are ERROR while the permission gate is BLOCKED; they are not live measurements.
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

Local Tech owns installation and the single post-install acceptance. This change
does not install `agy`, does not run that acceptance, and does not copy journals
or make backup copies. Do not run acceptance from the weekly schedule, and do not
point it at `reports/geo-offsite/geo-log.csv`. While `PERMISSION_ENFORCEMENT` is
BLOCKED the runner will not start `agy`, so an acceptance run cannot succeed.
Do not retry, do not change the date to manufacture rows, and do not call the
feature complete. A later Tech-approved run, after prevention is actually in
place and the gate is opened in source, uses a separate output directory and CSV,
once. Real `agy` output on that later run has to show `search_web` ending DONE
and a non-empty `result.response`, with no print-timeout stderr. ERROR rows are
not a measured result.

```sh
python3 ops/schedules/geo-offsite-weekly.py \
  --run-date YYYY-MM-DD \
  --output-dir reports/geo-offsite-gemini-acceptance \
  --csv-path reports/geo-offsite-gemini-acceptance/geo-log.csv
```

Replace `YYYY-MM-DD` with the JST date of that one run. This is not a new schedule.
Do not run it for this candidate.

## What Tech still has to verify

Offline tests do not verify the control. These items are still open:

1. On the installed `agy` 1.4.10, per-session `--settings` is actually loaded for
   that process and is not ignored in favor of
   `~/.gemini/antigravity-cli/settings.json`. Help text that lists the flag is
   not that proof. Official docs may not mention the flag.
2. The deny rules block command, unsandboxed execution, `read_file`, `write_file`,
   MCP, and `execute_url`, including workspace paths the product auto-allows.
   A prohibited tool must not run.
3. `search_web` still reaches DONE under that policy. If it does not, the allow
   rule has to be narrow enough that command, file, MCP, and unsandboxed execution
   stay denied. This candidate does not guess that allow rule.
4. A live stream for an unrelated question matches the redacted shape: model
   `gemini-4-argon-high`, `search_web` ends DONE, and `result.response` is the
   only answer. Whether `tool_info` appears in the real stream is still unknown.
5. A real print timeout emits `print timeout ... turn in progress; returning partial output`
   on stderr and stays ERROR, with the original elapsed time and no second launch.
6. The environment owner establishes that prevention before any later change sets
   the source gate to the open token. This candidate does not set it.

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
with `KANBAN_TMP` set. The tests cover the original idempotency, lock, crash claim,
process-group timeout, 13 columns, four SOP questions, Claude/Codex parse and alert
rules, plus the redacted `search_web` fixture, print-timeout stderr, and the blocked
gate. Legacy Claude/Codex, history, lock, and alert meanings stay. The blocked-gate
test shows `observe` calls neither `agy` nor `agy --version`. Parser cases are not
a live CLI proof. Do not treat a green run as permission verification.
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
