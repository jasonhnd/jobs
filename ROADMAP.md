# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — /models v2 design-debt rework (mms-4d), next up (2026-07-13)

GPT 5.6 SOL scoring (mms-5) is DONE — the full 556 batch landed as the
site-wide canonical on `preview` (#146, batch `occupations_gpt-5.6-sol_2026-07-12`,
mean transformation ~4.89). Preview validated + owner-approved. `main` (production)
push is the owner's manual `git push origin preview:main`.

Next active work = the parked /models v2 design debt below (mms-4d). The
minimal pre-land page-guard (de-hardcode counts + pair-key copy fallback) already
shipped in #144; mms-4d is the full visitor-facing rework. Doc-first as usual.

### Done — GPT 5.6 SOL scoring (mms-5, closed 2026-07-13)

- mms-5-prep (#141/#142): frozen GPT prompt `data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md` + runbook Codex section.
- mms-5-exec-pilot (#126): 40-occ pilot, drift +0.48T, owner-approved.
- mms-5-exec-full (#126/#146): full 556 (+0.72T vs Fable 5, coherent), landed canonical.
- Along the way fixed `assemble-scores.ts` hardcoded `model_provider:'anthropic'`
  → added `--provider` + `inferProvider()` (gpt→openai). 5 canonical-flip fixture
  tests updated (score-history 3→4 batches, models-deep latest pair, worktypes
  pinned %, ai-fact-summary attribution).

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
