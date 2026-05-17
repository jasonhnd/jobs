/**
 * Playwright config — minimal visual regression + smoke tests for the most
 * critical pages on mirai-shigoto.com. Catches the "leaked comment text"
 * class of bug at the rendered-output level (defense-in-depth alongside
 * scripts/check-nested-html-comments.cjs and scripts/check-rendered-leaks.cjs).
 *
 * NOTE: @playwright/test, http-server, and @axe-core/playwright live in
 * `optionalDependencies` (not devDependencies). They ARE pinned in
 * pnpm-lock.yaml (reproducibility + audit visibility), but Vercel's
 * installCommand passes `--no-optional` so ~50 MB of Playwright +
 * browsers stay out of every preview deploy. To run E2E locally OR in CI:
 *
 *   pnpm run test:e2e
 *
 * That entrypoint (scripts/run-e2e.sh) runs a normal `pnpm install
 * --frozen-lockfile` (no --no-optional this time, so the e2e deps come
 * in) then runs the tests against a built dist-astro/.
 * CI: see .github/workflows/e2e.yml (calls the same script).
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
    // Serves dist-astro/ over a local static server. The build must run
    // beforehand (`npm run build`).
    command: 'npx http-server dist-astro -p 4321 -s',
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
