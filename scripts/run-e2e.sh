#!/usr/bin/env bash
# run-e2e.sh — entrypoint for `pnpm test:e2e`.
#
# We deliberately do NOT bundle @playwright/test + http-server into
# devDependencies (see playwright.config.ts:7-12 — keeps Vercel install
# slim, ~50 MB of Playwright + browsers stay out of every preview deploy).
# Instead this script installs them on demand at run time. The first run
# is slow (downloads playwright + chromium); subsequent runs reuse the
# cached store.
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

# Pin versions here, NOT in package.json. These are loosely aligned with
# the dev-environment Playwright tested against — bump in PRs after a
# local successful run.
PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-1.49.0}"
HTTP_SERVER_VERSION="${HTTP_SERVER_VERSION:-14.1.1}"
AXE_PLAYWRIGHT_VERSION="${AXE_PLAYWRIGHT_VERSION:-4.10.2}"

echo "[e2e] Installing @playwright/test@${PLAYWRIGHT_VERSION} + http-server@${HTTP_SERVER_VERSION} + @axe-core/playwright@${AXE_PLAYWRIGHT_VERSION} (on-demand)…"
# `--no-save` skips writing package.json/pnpm-lock.yaml so this stays
# self-contained and doesn't trigger Vercel's frozen-lockfile guard.
corepack pnpm add --no-save \
  "@playwright/test@${PLAYWRIGHT_VERSION}" \
  "http-server@${HTTP_SERVER_VERSION}" \
  "@axe-core/playwright@${AXE_PLAYWRIGHT_VERSION}"

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
