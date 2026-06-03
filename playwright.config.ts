/**
 * Playwright config — minimal visual regression + smoke tests for the most
 * critical pages on mirai-shigoto.com. Catches the "leaked comment text"
 * class of bug at the rendered-output level (defense-in-depth alongside
 * scripts/check-nested-html-comments.cjs and scripts/check-rendered-leaks.cjs).
 *
 * NOTE: @playwright/test and @axe-core/playwright are in
 * devDependencies (pinned in bun.lock). The npm packages install in
 * every environment, but Playwright's Chromium *browser binary* is fetched
 * separately and only on demand, so E2E runs locally / manually and never
 * in the Vercel build gate (a ~150 MB browser has no place in a deploy).
 * To run E2E:
 *
 *   bun run test:e2e
 *
 * That entrypoint (scripts/run-e2e.sh) runs `bun install --frozen-lockfile`,
 * installs the Chromium binary, then runs the tests against a built
 * dist-astro/. GitHub Actions was removed 2026-05-28, so E2E is not part of
 * any automated CI — it is a manual pre-merge / release gate.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Serves dist-astro/ via a static server that mirrors Vercel's
    // cleanUrls + trailingSlash:false (see scripts/e2e-server.cjs). A plain
    // static server 302-redirects hub paths like /ja/sectors to a sibling
    // directory and 404s; this server serves /ja/sectors.html like Vercel.
    // The build must run beforehand (`bun run build`).
    command: 'bun scripts/e2e-server.cjs',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
