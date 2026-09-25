# AGENTS.md

Guidance for coding agents (Claude Code / Codex / Gemini CLI / Grok) working in
this repository.

This file is the shared contract for **every** executor that works here —
local agents, cloud agents, and project-level supervisors alike. Many of them
cannot read any instructions outside this repository, so everything an
executor must obey is written here or in the documents linked below. When this
file and a brief disagree, stop and say so in the PR instead of guessing.

## Canonical documents

- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — development workflow, branch roles,
  promotion, and the Vercel operation authority boundary. Read it before
  non-trivial work.
- [`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md) — canonical pins for Bun / Node /
  Astro / Vercel planes. Do not guess versions.
- [`docs/Design.md`](docs/Design.md) — UI/UX canon: colour tokens, type scale,
  heading levels, page classes, spacing, breakpoints, contrast contract.
  **Read §0 (a 40-line quick card) before touching any CSS, markup, or visual
  copy.** Do not guess a font size or a colour — every value is a token.
- [`docs/DESIGN_CONFORMANCE.md`](docs/DESIGN_CONFORMANCE.md) — per-surface
  migration ledger. Tells you which surfaces the Design gates enforce on, what
  the next migration step is, and the completion checklist for each surface.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR flow and required verification.

## Hard rules

- Repository records (Issues, PRs, commit messages, `docs/`) are written in
  English or Japanese only.
- Base PRs on `preview`. Never target `main` directly; `preview → main`
  promotion is owner-approved.
- Vercel access (MCP `https://mcp.vercel.com` and the authenticated CLI)
  carries owner-level permissions:
  - Read/diagnose freely: deployment status, build logs, usage, analytics,
    firewall overview, alert listings.
  - Owner approval required before any state change: promote / rollback /
    redeploy, env vars, firewall rules and `publish`, rolling-release config,
    alias / domain / DNS / project settings, and any `vercel api` write
    (POST / PATCH / PUT / DELETE).
  - Never use firewall Challenge actions — they block AI crawlers and break
    the GEO policy ([`docs/EDGE_SECURITY.md`](docs/EDGE_SECURITY.md)).
    Rate-limit exceeded action is `log` or `deny` (429) only.
- Score batches are append-only; never overwrite existing runs.
- Do not commit secrets or generated `dist-astro/`.
- UI work follows [`docs/Design.md`](docs/Design.md) (Design v1.2):
  - No raw `font-size`, `color`, `padding`, `border-radius`, or `z-index` in
    page CSS. Use the `var(--*)` tokens.
  - No `!important` on `font-size`. Heading variants branch on
    `body[data-page-class]` inside `canonical-css.ts` (§4.9).
  - No `:root{}` in a page `<style>` (§18.4).
  - Serif is Display / H1 / H2 only. H3 and below are sans (§4.4). Minimum
    font size site-wide is 12px (§4.2).
  - Every new page belongs to a page class (§6.5).
  - Adding a scale step, a role, or a token means updating `docs/Design.md`
    **first** (§19.4). A version bump is owner-approved — an agent must never
    revise the canon on its own (§20.6).
  - Before starting a surface migration, read its row in
    [`docs/DESIGN_CONFORMANCE.md`](docs/DESIGN_CONFORMANCE.md); when finished,
    update that row in the same PR.

## Branches and merge authority

| Branch | Role | Who may push | Who may merge into it |
| --- | --- | --- | --- |
| `preview` | Integration branch. Every topic branch starts from the latest `origin/preview`; every PR targets it. | Nobody pushes directly. | The supervisor (the person or agent that dispatched the work), after reading the diff and an independent review. Never the executor. |
| `main` | Vercel production. | Nobody pushes directly. | Only a promotion PR with head=`preview`, merged after the owner explicitly approves that promotion. CI enforces the head rule (`Enforce preview-to-main promotion` in `.github/workflows/ci.yml`). |
| topic branch | One Issue, one focused change. | The executor assigned to that Issue. | — |

- `pre.mirai-shigoto.com` is the preview **alias**, not a branch. There is no
  `pre` branch.
- `preview` is not the default branch, so `Closes #N` in a PR does **not**
  auto-close the Issue on merge. The supervisor closes it after merging.
- Start from the latest `preview`: `git fetch origin && git switch -c <branch> origin/preview`.
  If `preview` moves while your PR is open and GitHub reports a conflict or
  "not up to date", run `git fetch origin && git merge origin/preview`,
  resolve, and push normally. Do not rebase a branch that is already pushed.

## Delivery: one Issue, one PR

1. Work only from an Issue. If there is no Issue, there is no PR.
2. One Issue maps to exactly one PR (unless the Issue itself splits the work).
3. Commit after every completed step, with a conventional English message
   (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, …).
4. The PR description contains, in this order:
   - `Closes #N` on the first line;
   - what changed, mapped to the Issue's steps;
   - the real output of every verification command you ran;
   - anything not done, deviations from the Issue, and open questions.
5. Stop after opening the PR (and after pushing any follow-up commits the
   Issue asks for). Review and merging are someone else's job.

## Forbidden operations

Unless the Issue explicitly says otherwise, an executor must never:

- force-push (`--force`, `--force-with-lease`, `-f`) or rewrite pushed history;
- delete branches (local or remote) or delete files outside the Issue's scope;
- merge, close, or reopen PRs; close or edit Issues;
- push to `preview` or `main`, or open a PR whose base is `main`;
- change CI or deployment configuration: `.github/workflows/**`,
  `vercel.json` (except the CSP hashes that `bun run build` regenerates —
  commit those only when the Issue's change explains them), `.cursor/**`,
  `.vercelignore`, `bunfig.toml`, `astro.config.mjs`;
- run any Vercel state change (see Hard rules), or the live GA4 setup under
  `analytics/` (`setup`, `setup:check`, `discover`, `oauth-init`) — only
  `node analytics/setup-ga4.mjs --dry-run` is credential-free;
- upgrade globally installed tools (e.g. `bun upgrade`). If an Issue needs a
  specific tool version, install it into a private directory and put it
  first on `PATH` for your commands.

## Acceptance commands

Run these from the repository root before opening a PR. All of them were
confirmed to pass on `preview` (`66ec643e`, 2026-09-25):

```bash
unset PUBLIC_GA4_MEASUREMENT_ID PUBLIC_X_PIXEL_ID PUBLIC_META_PIXEL_ID
bun install --frozen-lockfile
bun run test          # read the "N pass" / "N fail" lines, not only the last line
bun run typecheck
bun run build
REQUIRE_BUILT_ARTIFACTS=1 bun test scripts/home-css-loading.test.ts src/site/models-built.test.ts
bun run verify:gates
bun x playwright test --reporter=line   # the CI "rendered-output checks" step
git diff --exit-code
```

- Docs-only changes still require `bun run check:docs-links`.
- There is **no lint script** in this repository. Do not invent one; the
  gates above (`verify:gates`, `check:*`) are the static checks.
- Unset the `PUBLIC_*` analytics variables before building: with them set,
  the build emits tracker blocks, which changes the CSP hashes written into
  `vercel.json` and sends local test traffic to production analytics.
- Playwright uses port 4321 (fixed in `playwright.config.ts`); do not run two
  suites on the same machine at the same time.
- CI (`quality`) runs the same chain plus the Playwright suite on Ubuntu.

On a Cursor Cloud Agent, `.cursor/install.sh` provisions this toolchain at
checkout. What that VM can and cannot verify on its own — e2e, scoring
providers, and everything that needs a Vercel deployment — is
[`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md) §10.

## Repository-specific constraints

- **Public copy is Japanese only.** The site dropped its English UI in v1.4.0;
  do not add English UI strings or a language switcher.
- **Public Japanese copy is owner-signed.** Page text, meta descriptions, OG
  card text, and other visitor-facing Japanese must be used exactly as quoted
  in the Issue. Do not write, rephrase, or "improve" public Japanese copy on
  your own; if the Issue does not quote the string, stop and ask in the PR.
- **Independence and data-source wording.** The site is an independent,
  unofficial analysis (see `/about`, `/compliance`, and the OG card frame).
  Do not add wording that implies affiliation with, or endorsement by, the
  Ministry of Health, Labour and Welfare (jobtag), JILPT, or any model vendor.
  Changes to `/compliance`, `/privacy`, attribution, or licence text need
  owner-signed wording in the Issue.
- **Design, all three widths.** Any layout or typography change is checked at
  1440 / 768 / 375 px before the PR. Column padding uses only `var(--gutter)`
  and widths only `--content-max` (`src/lib/canonical-css.ts`); new pages
  must not define their own spacing values.
- **Scores and data.** Score batches are append-only. The consensus-score
  rules live in [`docs/CONSENSUS_SCORE.md`](docs/CONSENSUS_SCORE.md) and the
  rounding rules in [`docs/DATA_ARCHITECTURE.md`](docs/DATA_ARCHITECTURE.md):
  bands, colours, and tier words follow the displayed one-decimal value,
  while averages are computed from the unrounded values.
- **Production traffic.** Never crawl or poll the production domain
  `mirai-shigoto.com` from a script: platform DDoS mitigation will challenge
  your IP, and a challenge that reaches real crawlers breaks the GEO policy.
  Full-URL checks go to `pre.mirai-shigoto.com` or a deployment alias, with
  concurrency ≤ 4, once.
- **Toolchain pins** ([`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md)): keep
  `bun.lock` at `lockfileVersion: 1`; do not add `engines.node`; do not add
  `@astrojs/vercel`; keep `@vercel/og` pinned to exactly `1.0.1`
  (1.0.2 / 1.0.3 abort on import).

## Autonomy

Complete the work autonomously. Do not stop to ask questions — nobody will
answer. (自律的に完了させること。途中で止まって質問しないこと。誰も答えない。)

## Operational commands (read-only)

Free to run without approval, per the authority boundary in
[`docs/WORKFLOW.md`](docs/WORKFLOW.md):

- `vercel alerts --ai` — check unresolved production alerts at session start.
- `vercel ls` / `vercel inspect <url> --logs` — deployment states, build logs.
- `vercel usage --group-by project` — cost attribution.
- `vercel firewall overview` — WAF / rate-limit / attack-mode state.

Incident procedures and the platform-state ledger live in
[`docs/INCIDENT_RUNBOOK.md`](docs/INCIDENT_RUNBOOK.md). Every state-changing
command there is owner-approval-gated.
