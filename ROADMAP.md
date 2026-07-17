# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — v1.8.0 release reconciliation (#175, 2026-07-17)

### Verified production baseline

- `main` at `adc35960bfcedfe33c87dd532b6a9217c95813c1` contains the GPT-5.6
  SOL canonical batch and the `/models` v2 work. GitHub Production deployment
  `5443028836` completed successfully on 2026-07-14 at
  `https://jobs-kpkfp9uit-zkscio.vercel.app`; Vercel records the same deployment
  as `dpl_AeUMDqz2jAj6JAzqap3jaYFhRUfw` with `mirai-shigoto.com` as an alias.
- A 2026-07-17 public-response audit found byte-identical final HTML between the
  custom domain and that immutable deployment for `/`, `/models`, `/shindan`,
  and `/gyakuten`. The corresponding `preview` responses were different.
- At that audit, production resolved to `main@adc35960`, while its package,
  latest Git tag, and latest GitHub release were still `1.7.0` / `v1.7.0`.

### v1.8.0 candidate boundary

- The audited release-candidate baseline is
  `preview@e4d8bde364a93176fc0a72ca19f96ef8dff45aab`, a strict descendant 22
  commits ahead of `main` with no reverse divergence. It includes the
  shared-footer newsletter restored by #196, production configuration guidance
  corrected by #197, and Resend diagnostic redaction from #200 in addition to
  the diagnostic, multi-model, feedback, performance, correctness, and
  governance work.
- This release-preparation change advances `preview`, and the required
  promotion merge advances `main` again. Neither `e4d8bde3` nor any
  predeclared SHA is the final release commit; the tag must be created only
  from the exact `main` commit verified in production.
- Production promotion is a reviewed PR with head=`preview` and base=`main`.
  The former manual `git push origin preview:main` path is retired. Freeze
  `preview` after release preparation so CI, Vercel, production smoke, and the
  eventual tag all describe one immutable candidate tree.

### Remaining production gates

- The 2026-07-17 Vercel environment-name audit found production Resend API and
  Japanese/English audience variables, but no `PUBLIC_TURNSTILE_SITE_KEY`,
  `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`, `FEEDBACK_TO_EMAIL`, or `FEEDBACK_FROM_EMAIL`.
  Although the runtime schema allows the sender override to be omitted, this
  release requires the production environment to set
  `FEEDBACK_FROM_EMAIL=feedback@mirai-shigoto.com`: Resend's default onboarding
  sender cannot deliver to the intended routed operator inbox, while the
  `mirai-shigoto.com` domain is API-verified, so that sender is permitted under
  Resend's domain rules. Configure the value in Vercel rather than committing a
  production environment file. The official Redis integration exposes
  `REDIS_URL`, but this runtime requires the Upstash REST URL/token pair and
  cannot substitute that variable. Turnstile
  authentication and the final feedback recipient route are not verified.
  Provision and verify every release-required production-scoped value before
  promotion so the production deployment is built with it; never record secret
  values in the repository or release notes.
- After the production deployment reports success for the final `main` SHA,
  smoke `/`, `/models`, `/shindan`, and `/gyakuten`; verify the active GPT-5.6
  attribution and the occupation-404 split; then submit one controlled feedback
  and one controlled newsletter request and confirm actual Resend delivery.
  Follow `docs/newsletter-production-smoke.md`; do not subscribe an uncontrolled
  address.
- Only after those checks pass may the exact verified production commit receive
  the `v1.8.0` tag and matching GitHub release. Record the final `main` and
  `preview` SHAs plus deployment evidence in #175 and the GitHub release; do not
  mark this roadmap item or #175 complete before both remote artifacts exist.

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
