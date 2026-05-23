#!/usr/bin/env bash
# run-e2e.sh — entrypoint for `pnpm test:e2e`.
#
# @playwright/test, http-server, and @axe-core/playwright live in
# `optionalDependencies` (NOT devDependencies). That keeps two
# properties at once:
#
#   1. Lockfile pinning — versions are recorded in pnpm-lock.yaml's
#      importers.optionalDependencies block, so they're reproducible
#      and visible to security audit.
#   2. Vercel install stays slim — vercel.json's installCommand passes
#      `--no-optional`, so ~50 MB of Playwright + browsers don't ride
#      along on every preview deploy.
#
# This script just runs a normal pnpm install (which installs optionalDeps
# by default) before the test run. The first run is slow (downloads
# playwright + chromium); subsequent runs reuse the cached store.
#
# CI uses this same script so what runs locally and what runs in GHA are
# byte-identical.
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
