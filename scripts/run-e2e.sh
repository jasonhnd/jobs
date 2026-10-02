#!/usr/bin/env bash
# run-e2e.sh — entrypoint for `bun run test:e2e`.
#
# @playwright/test and @axe-core/playwright are plain devDependencies
# (pinned in bun.lock for reproducibility + audit visibility). The static
# e2e server is scripts/e2e-server.cjs (no http-server dep). Playwright's
# Chromium browser binary is fetched separately (below) and only on
# demand — so E2E runs locally / manually, never in a deploy.
#
# Playwright is the one place the toolchain still needs Node.js under the
# hood (its CLI shells out to node, which `bun x` invokes via the bin
# shebang). The main dev/build/test loop is pure bun; e2e keeps node.
#
# This script runs a frozen install, installs Chromium, then runs the
# tests against a built dist-astro/. The first run is slow (downloads the
# chromium binary); subsequent runs reuse the cached store.
#
# GitHub Actions was removed 2026-05-28, so this now runs only locally /
# on demand. It is not part of the Vercel build gate.
#
# Exit codes:
#   0  all tests passed
#   1+ at least one test failed, or install / build failed

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[e2e] Ensuring deps (Playwright + axe) are installed via lockfile…"
# Frozen lockfile so versions exactly match the audit-visible pin in bun.lock.
bun install --frozen-lockfile

echo "[e2e] Installing chromium browser binary…"
bun x playwright install --with-deps chromium

# playwright.config.ts serves dist-astro/ via scripts/e2e-server.cjs.
#
# The build is ALWAYS redone here, with a throwaway measurement ID. A build
# made from .env.local carries the production ID, and gtag.js does not care
# that it is running on localhost — every e2e run then wrote real sessions
# into GA4 property 298707336. Measured 2026-09-21: seven runs between 8/25
# and 9/17 put ~1,870 sessions (12% of the clean window, 47% of 9/17 alone)
# into production analytics, each ~0.006s long, landing on exactly the URLs
# this suite visits. Vercel Web Analytics — first-party, and not loaded on
# localhost — saw none of them, which is how the divergence was caught.
#
# G-E2E0000000 is a well-formed ID for no property, so gtag.js still loads,
# still queues, and still fires g/collect (every assertion in
# analytics.spec.ts holds) while GA4 discards the hit. Do not remove the
# override to "save a rebuild": the build takes ~7s and the alternative is
# silently corrupting the only analytics the project has.
echo "[e2e] Rebuilding with a throwaway GA4 id (never write to production)…"
PUBLIC_GA4_MEASUREMENT_ID=G-E2E0000000 bun run build

echo "[e2e] Running Playwright tests…"
bun x playwright test "$@"
