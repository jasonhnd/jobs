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

# Build must have run before this — playwright.config.ts serves
# dist-astro/ via scripts/e2e-server.cjs. If the directory is missing, build now.
if [ ! -d "dist-astro" ]; then
  echo "[e2e] dist-astro/ missing; running build first…"
  bun run build
fi

echo "[e2e] Running Playwright tests…"
bun x playwright test "$@"
