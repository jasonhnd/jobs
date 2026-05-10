/**
 * Playwright config — minimal visual regression + smoke tests for the most
 * critical pages on mirai-shigoto.com. Catches the "leaked comment text"
 * class of bug at the rendered-output level (defense-in-depth alongside
 * scripts/check-nested-html-comments.cjs and scripts/check-rendered-leaks.cjs).
 *
 * Usage:
 *   npm run build && npx playwright test
 * Or for smoke only (no screenshot baseline updates):
 *   npx playwright test --grep smoke
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
