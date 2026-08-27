# AGENTS.md

Guidance for coding agents (Claude Code / Codex / Gemini CLI / Grok) working in
this repository.

## Canonical documents

- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — development workflow, branch roles,
  promotion, and the Vercel operation authority boundary. Read it before
  non-trivial work.
- [`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md) — canonical pins for Bun / Node /
  Astro / Vercel planes. Do not guess versions.
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

## Verification

```bash
bun run test
bun run typecheck
bun run build
bun run verify:gates
git diff --exit-code
```

Docs-only changes still require `bun run check:docs-links`.
