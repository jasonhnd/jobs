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
 * dist-astro/.
 *
 * 2026-09-17: this suite RUNS IN CI again (.github/workflows/ci.yml). It had
 * been manual-only since 2026-05-28, and in that time it rotted without anyone
 * seeing it — 16 of its 47 URLs had become 404s, and axe's `color-contrast`
 * rule was switched off. A spec that loads a missing page and asserts "no
 * violations" PASSES, so the board stayed green while a11y.spec.ts scanned the
 * 404 page for 7 of its 11 targets.
 *
 * Every other gate in this repo reads source. This is the only layer that reads
 * what a browser renders, which is the only place an inherited font-size or a
 * computed colour can be seen. Leaving it un-run is what let 46 contrast
 * failures and a 9.6px <small> ship past a green board.
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
