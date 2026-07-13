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

Next active work = **mms-4d**: /models information-architecture v3 = a hub +
per-model pages, folding in the mms-4c design debt. Owner-designed 2026-07-13.
The minimal pre-land page-guard (de-hardcode counts + pair-key copy fallback)
already shipped in #144. Doc-first; owner reviews the design doc, then each
code PR's Vercel preview, before merge.

Agreed IA:
- **`/models` (hub)**: visitor magazine treatment of the CURRENT canonical
  model + consensus/divergent stories + a full-model roster/timeline, each
  model linking to its own page. This is where mms-4c's "latest featured,
  others collapse" resolves — "others" collapse to links.
- **`/models/{slug}` (per-model data page, NEW)**: one rich page per batch,
  auto-generated via getStaticPaths (new batch → new page, no hand-authoring
  of data). Slug = model id minus the `claude-` prefix (claude-opus-4-8 →
  `opus-4-8`; gpt-5.6-sol → `gpt-5.6-sol`). Content: model profile
  (display name / provider / run date / coverage) + band distribution
  (histogram + mean) + that model's highest/lowest occupations by
  transformation + drift vs its predecessor batch + links to occupation
  detail pages. All 4 models incl. current GPT get a page. Zero client JS,
  Japanese only, SEO + JSON-LD + breadcrumb. This is the new home for the
  statistics depth removed from /models in mms-4c.

```yaml
- id: mms-4d-doc
  title: Design — /models IA v3 (hub + per-model pages)
  scope: >
    One design doc (docs/MULTI_MODEL_SCORING.md, supersede/extend 2c-v2):
    (1) /models hub structure; (2) /models/{slug} per-model page spec —
    slug scheme (strip claude- prefix + a slug<->model helper), getStaticPaths
    auto-generation from data/scores/, content blocks (profile, distribution
    histogram, top/bottom occupations, drift-vs-predecessor, occupation
    links), build-time projection contract, SEO/JSON-LD/breadcrumb, zero JS;
    (3) fold the 6 mms-4c design-debt items (see Design decisions below).
    Owner reviews before merge. No code.
  depends_on: []

- id: mms-4d-code-a
  title: /models/{slug} per-model data pages (implement first)
  scope: >
    Add src/pages/models/[model].astro with getStaticPaths over the batches,
    a model<->slug helper, and the per-model projection. Rich data page per
    the merged doc. Regenerate baselines; a11y/SEO/internal-link/JSON-LD gates
    green. Merge gate: owner approves the rendered PR preview.
  depends_on:
    - mms-4d-doc

- id: mms-4d-code-b
  title: /models hub rework (visual realign + roster + CJK)
  scope: >
    Rebuild /models per the merged doc: realign to the main visitor-page
    visual language (not CANONICAL_DOC_CSS), current-model magazine feature +
    full-model roster/timeline linking to the per-model pages, CJK line-break
    fixes, name unification, detail-page score-history <details> collapse.
    Regenerate baselines; gates green. Merge gate: owner approves preview.
  depends_on:
    - mms-4d-code-a
```

### Done — GPT 5.6 SOL scoring (mms-5, closed 2026-07-13)

- mms-5-prep (#141/#142): frozen GPT prompt `data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md` + runbook Codex section.
- mms-5-exec-pilot (#126): 40-occ pilot, drift +0.48T, owner-approved.
- mms-5-exec-full (#126/#146): full 556 (+0.72T vs Fable 5, coherent), landed canonical.
- Along the way fixed `assemble-scores.ts` hardcoded `model_provider:'anthropic'`
  → added `--provider` + `inferProvider()` (gpt→openai). 5 canonical-flip fixture
  tests updated (score-history 3→4 batches, models-deep latest pair, worktypes
  pinned %, ai-fact-summary attribution).

### Design decisions folded into mms-4d-doc (from mms-4c debt, 2026-07-12)

These 6 were confirmed against code after mms-4c (#140). All fold into the
mms-4d design doc (hub = items 1,2,4,5; per-model pages absorb the removed
statistics; item 3 already shipped in #144; item 6 is the detail-page fix).

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

