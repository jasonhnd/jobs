#!/usr/bin/env bash
# run-e2e.sh — entrypoint for `pnpm test:e2e`.
#
# @playwright/test, http-server, and @axe-core/playwright are in
# devDependencies (pinned in pnpm-lock.yaml for reproducibility + audit
# visibility). The npm packages install everywhere, but Playwright's
# Chromium browser binary is fetched separately (below) and only on
# demand — so E2E runs locally / manually, never in a deploy.
#
# This script runs a normal pnpm install, installs Chromium, then runs the
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

echo "[e2e] Ensuring optionalDependencies (Playwright + http-server + axe) are installed via lockfile…"
# Frozen lockfile so versions exactly match the audit-visible pin in
# pnpm-lock.yaml. No --no-optional here — we WANT the e2e deps now.
corepack pnpm install --frozen-lockfile

echo "[e2e] Installing chromium browser binary…"
corepack pnpm exec playwright install --with-deps chromium

# Build must have run before this — playwright.config.ts serves
# dist-astro/ via http-server. If the directory is missing, build now.
if [ ! -d "dist-astro" ]; then
  echo "[e2e] dist-astro/ missing; running pnpm run build first…"
  corepack pnpm run build
fi

echo "[e2e] Running Playwright tests…"
corepack pnpm exec playwright test "$@"
