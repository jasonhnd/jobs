# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — SEO+GEO on existing pages (#236)

Owner 「继续」 2026-09-09 after mms-8 close-out. No 24 type pages. Indexable
space is occupations, `/answers/*`, `/rankings`, `/methodology`, `/standard`.
Japanese public copy for new strings is posted on #272.

- seo-geo-1 (#272): four SOP-prompt landings — title / H1 / lead / FAQ JSON-LD
  use the SOP wording; name AIOIS-10, occupation count, score date above the
  fold; cross-link `/answers` ↔ `/methodology` ↔ `/rankings`.
- seo-geo-2: occupation cite-line; drop `代替リスク` as job-loss. Waits on
  owner-signed JA after #272.
- seo-geo-3: weekly off-site SOP log including Claude's cited URL.

Parked: /models observatory enhancements — update-history
surface, model-page OG cards, dimension fingerprints, release-day ritual.

## Done — consensus canonical score (mms-6) + Grok onboarding (mms-7)

Shipped on `preview` (then mms-8 replaced the public value with the vendor
flagship mean). Design: `docs/CONSENSUS_SCORE.md` (eight decisions
owner-confirmed 2026-08-31; PR #363).

- mms-6-doc: design approved (PR #363); |Δ|≥1.0, ±0.3, and C-facing
  copy locked in `docs/CONSENSUS_SCORE.md` (#364).
- mms-6a: `pickConsensusScore()` engine (median, per-model latest vote,
  6-month window, floor 5) + rationale selector + unit tests.
- mms-6b: wire canonical projections to the consensus; add panel metadata.
- mms-6c: occupation-page surface — consensus headline, unattributed
  rationale, latest-observation line, attributed history fold.
- mms-6d: sitewide copy sweep under the no-model-names-on-C-surfaces rule.
- mms-6e: /models hub alignment (current-model card becomes consensus summary).
- mms-6f: regenerate baselines; consolidate canonical-pinned fixtures.
- mms-6g: switch release with old-vs-new drift report + on-site update note.
- mms-7a: Grok 4.6 scoring path on in-agent (`grok-4.6`) + prompt freeze.
- mms-7b: Grok 40-occupation pilot + owner Japanese-quality sign-off.
- mms-7c: Grok full 556 batch lands as the 5th vote (in-agent, #387).

## Done — vendor-flagship mean + Claude Fable 5.1 + GPT-6 Astra (mms-8, closed 2026-09-09)

Shipped on `preview`. Public value is the arithmetic mean of each vendor's
latest comparable AIOIS-10 run (Anthropic / OpenAI / xAI). Median, 6-month
vote window, and floor 5 left the public surface. `pickConsensusScore` and
the one-off drift scripts stay as history (owner A on #444). Promotion to
`main` is owner-held: texts posted on #436 and #442; agent does not open
`preview → main`.

Design: `docs/CONSENSUS_SCORE.md` 改訂 2 (owner 2026-09-08). C-facing copy
stays 「複数のAI」; FAQ and `/standard` say 「現在は3社の最新モデルの平均」.
Claude Fable 5.1 (`claude-fable-5-1`, in-agent) replaced Opus 5 as
Anthropic's entry; GPT-6 Astra (`gpt-6-astra`, owner-machine Codex CLI)
replaced GPT 5.6 SOL. `/models` is three vendor lanes.

- mms-8.1 (#408/#445): design doc 「改訂 2」.
- mms-8.2 (#409/#446): owner-signed copy → 「確定文案（mms-8）」.
- mms-8.3 (#410/#447): `DATA_ARCHITECTURE.md` スコア選択 + `MULTI_MODEL_SCORING.md` 2c-v4.
- mms-8.4 (#411/#448): frozen prompt Claude Fable 5.1 + body-hash test.
- mms-8.5 (#412/#449): frozen prompt GPT-6 Astra + body-hash test.
- mms-8.6 (#413/#450): `SCORING_RUNBOOK.md` mms-8 section + providers table + `TOOLCHAIN.md` §10.1.
- mms-8.7 (#414/#451): ROADMAP, CHANGELOG, display/slug/vendor tests.
- mms-8.8 (#415/#452): `provider` on `ScoreHistEntry` / `ScoreHistoryEntry`.
- mms-8.9 (#416/#453): `VENDOR_WHITELIST` / `isWhitelistedVendor` / `formatVendorDisplay`.
- mms-8.10 (#417/#454): `pickFlagshipMeanScore` engine (not wired).
- mms-8.11 (#418/#455): live-data tests; deprecate `pickConsensusScore`.
- mms-8.12 (#419/#456): Codex `--reasoning-effort` flag + frozen-argv test.
- mms-8.13 (#420/#457): wire public value to the new engine.
- mms-8.14 (#421/#458): detail `stale_vote` / `consensus_vendor_count`.
- mms-8.15 (#422/#459): `SCORE_PANEL` v2.
- mms-8.16 (#423/#460): `scripts/flagship-switch-drift.ts`.
- mms-8.17 (#424/#461): `consensus-copy.ts` signed constants.
- mms-8.18 (#425/#462): `/standard`, `/methodology`, `/about` prose + JSON-LD.
- mms-8.19 (#426/#463): README + GEO English vendor-mean wording.
- mms-8.20 (#427/#464): per-run `in_panel` note + `提供元` xAI.
- mms-8.21 (#428/#465): `models-deep` projection v2 (vendor lanes).
- mms-8.22 (#429/#466): `/models` view model v2.
- mms-8.23 (#430/#467): `/models` vendor-lane markup + CSS.
- mms-8.24 (#431/#468): canonical-pinned tests from `latestRunPerVendor()`.
- mms-8.25 (#432): Fable 5.1 pilot 40 (in-agent; Issue comments; no PR).
- mms-8.26 (#433): Fable 5.1 full 556 (in-agent; Issue comments; no PR).
- mms-8.27 (#434/#469): land Fable 5.1 batch (file, 308, runbook, baseline).
- mms-8.28 (#435/#470): switch note + `docs/FLAGSHIP_SWITCH_DRIFT.md` (4.73→4.67).
- mms-8.29 (#436): preview checklist + promotion PR text (owner-held; not opened).
- mms-8.30 (#437/#471): `/models` editorial after Fable 5.1.
- mms-8.31 (#438): Astra entitlement preflight (Issue comments; no PR).
- mms-8.32 (#439): Astra pilot 40 (Codex CLI; Issue comments; no PR).
- mms-8.33 (#440): Astra full 556 (Codex CLI; Issue comments; no PR).
- mms-8.34 (#441/#472): `scripts/vendor-update-drift.ts`.
- mms-8.35 (#442/#473): land Astra batch + update note; promotion text (owner-held; not opened).
- mms-8.36 (#443/#474): `/models` editorial after Astra.
- mms-8.37 (#444/#475): close-out. Owner A: keep deprecated median engine as history.
- Tracker #407 closes after this PR. Promotion PR texts: #436 / #442; owner opens.

## Done — occupation-first /me consolidation (#233, production 2026-08-21)

Shipped on `preview`, then promoted (`#273`, `main@b2606e3c`). Umbrella #233
closes on the product ship. It does **not** wait on #236.

#236 (SEO/GEO) is a separate programme (Active). #234 closed 2026-08-22
on the existing 17-day cut (~1.5× `me_open`, not 10×). Owner: do not wait
another 28 days.

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
