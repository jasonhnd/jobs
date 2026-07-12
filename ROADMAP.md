# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — GPT 5.6 SOL scoring (2026-07-12)

Owner reprioritized: run the GPT 5.6 SOL scoring FIRST, /models v2 rework
AFTER. mms-4c (v2 magazine page) shipped in #140 but the owner then flagged
design debt (see Parked block below); the full rework is deferred.

Immediate track: execute #126 scoring, gated per `docs/SCORING_RUNBOOK.md`.
Prerequisite discovered: there is NO frozen GPT 5.6 SOL prompt yet, and the
runbook only documents the Fable-5 / in-agent path — the Codex CLI path
(`scripts/run-scoring-codex.ts`, built in #122) is undocumented. So Phase 1
is a doc/prompt PR (no scoring quota), owner-reviewed, before any pilot.

```yaml
- id: mms-5-prep
  title: GPT 5.6 SOL frozen prompt + runbook Codex section (doc/prompt only)
  scope: >
    Author data/prompts/<date>_gpt-5.6-sol-aiois10.ja.md by faithfully
    porting the frozen Fable-5 prompt (2026-06-13_claude-fable-5-aiois10.ja.md)
    to gpt-5.6-sol: same AIOIS-10 v1.0 output contract (strict JSONL, full
    d1..d10 + transformation + displacement, ai_risk === transformation,
    0-10 one-decimal, silent-fallback + anchoring forbidden), swap model id
    / provider (openai) / date / prompt-version (AIOIS-10-v1.0-gpt-5.6-sol).
    Add a GPT-5.6-SOL / Codex-CLI scoring section to docs/SCORING_RUNBOOK.md
    (baseline = latest AIOIS-10 batch claude-fable-5 2026-06-13; runner =
    run-scoring-codex.ts; pilot artifacts under .cache/scoring/). Doc/prompt
    only — NO scoring run, no data/scores change. Owner reviews before merge.
  depends_on: []

- id: mms-5-exec-pilot
  title: GPT 5.6 SOL pilot (30-50) → drift report (gated, quota)
  scope: >
    make-pilot-sample (baseline Fable 5) → run-scoring-codex pilot →
    assemble --mode aiois → check → aiois-drift-report vs Fable 5. Artifacts
    only under .cache/scoring/, never data/scores/. Burns Codex quota; starts
    only on an explicit owner go-ahead. Owner reviews the drift report.
  depends_on:
    - mms-5-prep

- id: mms-5-exec-full
  title: GPT 5.6 SOL full 556 batch + pre-land page patch (gated, quota)
  scope: >
    After pilot approval: full 556 run into
    data/scores/occupations_gpt-5.6-sol_<date>.json (append-only). BEFORE the
    batch lands, ship a minimal /models patch (de-hardcode 3つの/556 counts +
    pair-key the story/personality copy with safe generic fallback) so the
    live page never misstates model count or shows stale-pair copy when the
    latest pair advances to Fable 5 → GPT 5.6. Landing flips pickLatestScore
    site-wide. Each run starts only on explicit owner go-ahead.
  depends_on:
    - mms-5-exec-pilot
```

## Parked — /models v2 design debt (2026-07-12, deferred behind GPT 5.6)

After mms-4c shipped (#140), the owner flagged that /models v2 still reads
wrong. Confirmed against code; fix folded into a future mms-4d rework once
GPT 5.6 scoring is done. Agreed design decisions:

1. **Visual system**: /models uses CANONICAL_DOC_CSS (the formal doc-page
   stylesheet, serif-heavy) — reads like /standard, not like the main
   visitor pages. Realign to the main visitor-page visual language (shared
   fonts + palette, sans-dominant).
2. **Model scaling (3 → 10, 20)**: page body always features only the LATEST
   adjacent pair (2 models); all other models collapse into a compact
   timeline/strip. Hardcoded "3つの" / "556" strings in models.astro must be
   computed from data (breaks the day GPT 5.6 lands).
3. **Batch-landing lifecycle**: decouple data landing from page copy — data
   landing is automatic/safe (append-only, old scores persist in per-occ
   history + models timeline); pair-key the curated copy so a new latest pair
   auto-falls-back to generic templated copy (never shows stale-pair copy);
   hand-written curation becomes an optional follow-up quality pass, not a
   release blocker.
4. **Discoverability / naming**: keep /models footer-only (no top nav, per
   owner); unify the nav name across footer / breadcrumb / detail-page link
   to one label; H1 stays the editorial hook.
5. **CJK line-break (must-fix)**: add Japanese line-break rules
   (line-break:strict, overflow-wrap, word-break:keep-all where needed).
6. **Detail-page score-history scaling (must-fix)**: at N models, show the
   current score prominently + collapse older history behind native
   `<details>` (zero JS), so 556 pages don't each grow an N-row table.
```

## Pending — gated operations (not dispatchable)

```yaml
- id: mms-5-exec
  title: Execute gpt-5.6-sol scoring (issue #126)
  scope: >
    Pilot 30-50 occupations -> drift report -> owner approval -> full 556
    batch into data/scores/. Consumes Codex CLI subscription quota and runs
    for hours on the operator machine; each run starts only on an explicit
    owner go-ahead. Landing the full batch flips the site-wide canonical
    score to gpt-5.6-sol.
  depends_on: []
```
