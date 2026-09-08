# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — consensus canonical score (mms-6) + Grok onboarding (mms-7) + Fable 5.1 / GPT-6 Astra onboarding (mms-8)

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

mms-8 (#404): two frontier models released 2026-09-01 / 2026-09-03 enter the
panel as **two new votes** — `claude-fable-5-1` (Claude Fable 5.1, in-agent,
must run inside a Fable 5.1 session, effort `high`) and `gpt-6-astra` (GPT 6
Astra, owner's local Codex CLI ≥ 0.153.1 with an explicit `--model`, effort
`high` explicit). `claude-fable-5` and `gpt-5.6-sol` stay. Panel after both
land: 7 votes (Anthropic 4 / OpenAI 2 / xAI 1). Documents are shared; scoring
runs on two tracks; landing is one PR when both 556 batches are done (5 → 7
flips once). If one track stalls, the finished one lands alone. Rubric,
formulas, and the JSONL contract of AIOIS-10 v1.0 do not change. Out of
scope: Mythos 5.1, Sonnet 5, Haiku, GPT-5.6 Terra/Luna, Daybreak/Cyber
variants, Gemini, any Vercel AI Gateway provider, any new Anthropic/OpenAI
HTTP provider.

- mms-8-doc: Issue #404, two frozen prompts (body identical to the Grok 4.6
  freeze), runbook sections for Fable 5.1 (in-agent) and GPT-6 Astra (Codex),
  two-vote C-facing copy slot in `docs/CONSENSUS_SCORE.md`, this entry, and
  `formatModelDisplay` / `modelSlug` / `inferProvider` tests for both ids.
  No scoring. No `data/scores/`. No `vercel.json`. depends_on: [mms-7c]
- mms-8F: Claude Fable 5.1 in-agent scoring — pilot 40 → owner Japanese
  `rationale_ja` sign-off → full 556 under `.cache/scoring/mms-8f/`. Drift
  vs `claude-fable-5` and vs `grok-4.6`. `--attest-model` must equal
  `--model`; JSONL answers only (Fable 5.1 rejects forced tool use).
  depends_on: [mms-8-doc]
- mms-8G: GPT-6 Astra Codex scoring on the owner's machine — preflight must
  prove the account really reaches `gpt-6-astra` (not just that `--model`
  exists); effort `high` pinned explicitly (optional runner flag whose
  default keeps the frozen 5.6 SOL argument vector, or `~/.codex/config.toml`);
  pilot 40 including security-type occupations (public Astra refuses
  advanced exploit content) → owner sign-off → full 556 under
  `.cache/scoring/mms-8g/`. Drift vs `gpt-5.6-sol` and vs `grok-4.6`.
  `CODEX_DEFAULT_MODEL` stays `gpt-5.6-sol`. depends_on: [mms-8-doc]
- mms-8c: land both batches in one PR — two append-only JSON files,
  `vercel.json` 308s for `/models/fable-5-1` and `/models/gpt-6-astra`,
  SCORE_PANEL 5 → 7, baselines, runbook 「現行 batch」 lines, and the
  two-vote on-site note filled with measured numbers. If only one track is
  done, land it alone with the one-vote note. depends_on: [mms-8F, mms-8G]

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
