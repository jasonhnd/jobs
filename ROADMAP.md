# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — consensus canonical score (mms-6) + Grok onboarding (mms-7) + vendor-flagship mean, Fable 5.1, GPT-6 Astra (mms-8)

Design: `docs/CONSENSUS_SCORE.md` (eight decisions owner-confirmed 2026-08-31;
PR #363 merged. mms-6-doc locks |Δ|≥1.0, rationale ±0.3, and C-facing copy).
Canonical flips from `pickLatestScore` (latest model wins) to the median of
comparable batches (per-model latest vote, 6-month validity, floor of 5).
C-facing surfaces drop model names entirely; precise attribution stays in the
history fold, /models, citation fact, footer, and JSON-LD. Vendor whitelist is
OpenAI / Anthropic / xAI (Gemini excluded for now, owner 2026-08-31).

- mms-6-doc: design approved (PR #363); |Δ|≥1.0, ±0.3, and C-facing
  copy locked in `docs/CONSENSUS_SCORE.md` (#364). depends_on: []
- mms-6a: `pickConsensusScore()` engine (median, per-model latest vote,
  6-month window, floor 5) + rationale selector + unit tests.
  depends_on: [mms-6-doc]
- mms-6b: wire canonical projections to the consensus; add panel metadata;
  keep payload gates. depends_on: [mms-6a]
- mms-6c: occupation-page surface — consensus headline, unattributed
  rationale, latest-observation line, attributed history fold.
  depends_on: [mms-6b]
- mms-6d: sitewide copy sweep under the no-model-names-on-C-surfaces rule
  (footer, FAQ templates, citation fact, JSON-LD, OG). depends_on: [mms-6b]
- mms-6e: /models hub alignment (current-model card becomes consensus summary
  + latest run); full hub rework stays out of scope. depends_on: [mms-6b]
- mms-6f: regenerate baselines; consolidate canonical-pinned fixtures.
  depends_on: [mms-6c, mms-6d, mms-6e]
- mms-6g: switch release with old-vs-new drift report + on-site update note;
  owner preview approval before landing. depends_on: [mms-6f]
- mms-7a: Grok 4.6 scoring path on in-agent (`grok-4.6`) + prompt freeze.
  No Vercel AI Gateway. No bespoke xAI provider. depends_on: [mms-6g]
- mms-7b: Grok 40-occupation pilot + owner Japanese-quality sign-off.
  depends_on: [mms-7a]
- mms-7c: Grok full 556 batch lands as the 5th vote (in-agent, #387).
  depends_on: [mms-6g, mms-7b]

mms-8 (owner decisions 2026-09-08, `docs/CONSENSUS_SCORE.md` 改訂 2): each
vendor scores with one flagship model; the public value is the arithmetic
mean of those latest comparable runs (3 vendors today: Anthropic / OpenAI /
xAI). Median, 6-month vote window, and floor 5 are retired. Claude Fable 5.1
(`claude-fable-5-1`, in-agent) lands first and replaces Opus 5 as Anthropic's
entry; GPT-6 Astra (`gpt-6-astra`, owner-machine Codex CLI) lands only after
that and replaces GPT 5.6 SOL. The rule switch happens on the Fable 5.1
landing day with one on-site note; Astra gets a later vendor-update note.
`/models` becomes three vendor lanes. C-facing copy stays 「複数のAI」;
FAQ and `/standard` say 「現在は3社の最新モデルの平均」. Latest-observation
and aging notes stay; aging wording 票 → 採点. Gemini stays out.

- mms-8.1: design doc 「改訂 2」 in `docs/CONSENSUS_SCORE.md` (#408). depends_on: []
- mms-8.2: owner-signed copy → 「確定文案（mms-8）」 (#409). depends_on: [mms-8.1]
- mms-8.3: `DATA_ARCHITECTURE.md` スコア選択 + `MULTI_MODEL_SCORING.md` 2c-v4 (#410). depends_on: [mms-8.1]
- mms-8.4: Frozen prompt Claude Fable 5.1 + body-hash test (#411). depends_on: [mms-8.1]
- mms-8.5: Frozen prompt GPT-6 Astra + body-hash test (#412). depends_on: [mms-8.4]
- mms-8.6: `SCORING_RUNBOOK.md` mms-8 section + providers table + `TOOLCHAIN.md` §10.1 (#413). depends_on: [mms-8.4, mms-8.5]
- mms-8.7: ROADMAP, CHANGELOG, display/slug/vendor tests (#414). depends_on: [mms-8.6]
- mms-8.8: `provider` on `ScoreHistEntry` / `ScoreHistoryEntry` (5 construction sites) (#415). depends_on: [mms-8.7]
- mms-8.9: `VENDOR_WHITELIST` / `isWhitelistedVendor` / `formatVendorDisplay` + `check-score-batch` advisory (#416). depends_on: [mms-8.8]
- mms-8.10: Engine `pickFlagshipMeanScore` + `toFlagshipCanonicalScoreEntry` + `flagshipPanelMeta` + unit tests (not wired) (#417). depends_on: [mms-8.9]
- mms-8.11: Live-data tests; deprecate `pickConsensusScore`; prove not wired (#418). depends_on: [mms-8.10]
- mms-8.12: Codex runner `--reasoning-effort` flag + audit + frozen-argv test + runbook flag doc (#419). depends_on: [mms-8.6]
- mms-8.13: Wire `indexes` / `loader` / `geo-facts` to the new engine; `flagshipByOcc` (#420). depends_on: [mms-8.11]
- mms-8.14: Detail projection fields `stale_vote` / `consensus_vendor_count` (#421). depends_on: [mms-8.13]
- mms-8.15: `SCORE_PANEL` v2 + build invariant + all readers compile (#422). depends_on: [mms-8.14]
- mms-8.16: `scripts/flagship-switch-drift.ts` + synthetic test (#423). depends_on: [mms-8.15]
- mms-8.17: `consensus-copy.ts` constants + direct consumers (#424). depends_on: [mms-8.2, mms-8.15]
- mms-8.18: `/standard`, `/methodology`, `/about` prose + JSON-LD (#425). depends_on: [mms-8.17]
- mms-8.19: README + `geo-render.ts` English + regenerate GEO files (#426). depends_on: [mms-8.18]
- mms-8.20: Per-run page `in_panel` note + `提供元` xAI (#427). depends_on: [mms-8.17]
- mms-8.21: `models-deep` projection v2 (vendor lanes, 3-way spread) (#428). depends_on: [mms-8.20]
- mms-8.22: `/models` view model (#429). depends_on: [mms-8.21]
- mms-8.23: `/models` page markup + CSS (#430). depends_on: [mms-8.22]
- mms-8.24: Baseline regeneration + pinned-test consolidation + all gates (#431). depends_on: [mms-8.19, mms-8.23]
- mms-8.25: Fable 5.1 pilot 40 (in-agent) (#432). depends_on: [mms-8.24]
- mms-8.26: Fable 5.1 full 556 (#433). depends_on: [mms-8.25]
- mms-8.27: Land Fable 5.1 batch (file, 308, runbook, build, baseline) (#434). depends_on: [mms-8.26]
- mms-8.28: Switch note: drift doc, numbers, `/data` + `/models`, design-doc 実測 (#435). depends_on: [mms-8.27]
- mms-8.29: Preview checklist + promotion PR text (#436). depends_on: [mms-8.28]
- mms-8.30: `/models` content after Fable 5.1 (personality + story sentences) (#437). depends_on: [mms-8.29]
- mms-8.31: Astra entitlement preflight (owner's machine) (#438). depends_on: [mms-8.27, mms-8.12]
- mms-8.32: Astra pilot 40 incl. security-type occupations (#439). depends_on: [mms-8.31]
- mms-8.33: Astra full 556 (#440). depends_on: [mms-8.32]
- mms-8.34: `scripts/vendor-update-drift.ts` + synthetic test (#441). depends_on: [mms-8.16]
- mms-8.35: Land Astra batch + update note + promotion text (#442). depends_on: [mms-8.33, mms-8.34]
- mms-8.36: `/models` content after Astra (#443). depends_on: [mms-8.35]
- mms-8.37: Close-out: ROADMAP Done, CHANGELOG, deprecated-engine decision (#444). depends_on: [mms-8.36]

Parked (returns after mms-8): /models observatory enhancements — update-history
surface, model-page OG cards, dimension fingerprints, release-day ritual.

## Done — occupation-first /me consolidation (#233, production 2026-08-21)

Shipped on `preview`, then promoted (`#273`, `main@b2606e3c`). Umbrella #233
closes on the product ship. It does **not** wait on #236.

#236 (SEO/GEO) is a separate programme and is parked until the owner starts
it. #234 closed 2026-08-22 on the existing 17-day cut (~1.5× `me_open`,
not 10×). Owner: do not wait another 28 days.

- acq-2-funnel (#256 / #261): `shindan_start` + `shindan_step` (`value` 1..9).
- acq-3-screen2 (#257 / #262): 9 questions on `/me` behind `#meQuizOpen`.
- acq-4-screen3 (#258 / #263): occupation gap as `/me` screen 3; no `gap` in URL.
- acq-5-no-occ (#259 / #265): `/shindan` is `NO_OCC_PATH`; `/me/start` redirects there.
- acq-6-redirect (#260 / #265): humans `/shindan?job=` → `/me`; scrapers keep OG.
  Bare `/shindan` is **not** 301'd (owner lock 2026-08-17, supersedes the original table).
- Follow-ups: `/me` cream body (#266); desktop top nav 「自分の現在地」 (#267).
- JA copy in `docs/ME_CONSOLIDATION.md` §4.6 signed by owner 2026-08-20
  (`hidden_risk`: この仕事での進め方は、これから変えていけます).
- acq-7-share (#237): share text and worktype OG are measurement-led when a
  job is known (`{職業}のAI影響度は{点数}`). No-occupation shares stay identity.

## Done — v1.8.0 release reconciliation (#175, closed 2026-07-17)

### Production and release record

- Release preparation #198 set `package.json` to `1.8.0` and reconciled the
  complete post-v1.7 changelog. Owner decision #202 then permanently removed
  the feedback/newsletter forms, their APIs, Resend delivery, Turnstile, and
  form-only rate limiting in #205; none of those capabilities ships in v1.8.0.
- Reviewed promotion PR #206 advanced Production from the old
  `main@adc35960bfcedfe33c87dd532b6a9217c95813c1` baseline to the reconciled
  candidate at `main@b0a6432df9cb47b32f54ce76018d054dc98b8760` on 2026-07-17.
  Main CI run `29574329115` and Vercel deployment
  `dpl_7he94YGU8PyJWskChn1pakefCRcz` completed successfully.
- Production smoke covered `/`, `/models`, `/shindan`, `/gyakuten`, the active
  GPT-5.6 attribution, the `/404` versus `/occupations/404` route split, the
  form-free footer, and 404 responses for both retired API paths. The final
  documentation-only release record followed the same reviewed
  `preview` -> `main` path.
- The annotated `v1.8.0` tag and matching GitHub release identify the exact
  final `main` commit verified in Production. Issue #175 preserves the final
  `main` and `preview` SHAs, immutable deployment evidence, and smoke results.

### Shipped boundary

- v1.8.0 publishes the AI work-style diagnostic, the complete GPT-5.6 SOL
  556-occupation batch, multi-model comparison pages, ranking and diagnostic
  integrity fixes, performance work, and repository governance gates recorded
  in `CHANGELOG.md`.
- The experimental MBTI phase-1 route surface was reverted before release and
  is not shipped. Feedback submission, newsletter signup, Resend, Turnstile,
  and their dedicated infrastructure are also outside the product boundary.
- Post-production deletion of proven jobs-only external form configuration and
  historical records is tracked separately in #204 so release evidence remains
  distinct from account-level cleanup.

## Done — /models v2 design-debt rework (mms-4d, closed 2026-07-14)

- mms-4d-doc (#148): design for /models IA v3: hub + per-model pages.
- mms-4d-code-a (#149/#150): `/models/{slug}` per-model data pages.
- mms-4d-code-b (#151/#152): `/models` hub rework, roster/timeline,
  CJK line-break fixes, and detail-page score-history scaling.
- mms-4d-visual-fix (#153/#154): post-land visual cleanup for the hub and
  per-model page treatment.
- Umbrella tracker #121 closed as completed series hygiene.

## Done — GPT 5.6 SOL scoring (mms-5, closed 2026-07-13)

- mms-5-prep (#141/#142): frozen GPT prompt `data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md` + runbook Codex section.
- mms-5-exec-pilot (#126): 40-occ pilot, drift +0.48T, owner-approved.
- mms-5-exec-full (#126/#146): full 556 (+0.72T vs Fable 5, monotonic), landed canonical.
- Along the way fixed `assemble-scores.ts` hardcoded `model_provider:'anthropic'`
  → added `--provider` + `inferProvider()` (gpt→openai). 5 canonical-flip fixture
  tests updated (score-history 3→4 batches, models-deep latest pair, worktypes
  pinned %, ai-fact-summary attribution).
