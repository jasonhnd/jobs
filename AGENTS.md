# AGENTS.md

Guidance for coding agents (Claude Code / Codex / Gemini CLI / Grok) working in
this repository.

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
- UI work follows [`docs/Design.md`](docs/Design.md) (Design v1.0):
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

## Verification

```bash
bun run test
bun run typecheck
bun run build
bun run verify:gates
git diff --exit-code
```

Docs-only changes still require `bun run check:docs-links`.

On a Cursor Cloud Agent, `.cursor/install.sh` provisions this toolchain at
checkout. What that VM can and cannot verify on its own — e2e, scoring
providers, and everything that needs a Vercel deployment — is
[`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md) §10.
