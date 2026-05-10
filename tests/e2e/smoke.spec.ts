/**
 * smoke.spec.ts — minimal smoke + leak tests for the most critical pages.
 *
 * These tests catch the class of bug that broke the home page in commit
 * 3a44f0c9 (nested HTML comment leaked literal text). They run a real
 * browser against the built `dist-astro/` so anything visible-but-not-
 * supposed-to-be-visible gets caught.
 *
 * Each page is checked for:
 *   1. HTTP 200 + non-empty body
 *   2. Top nav (mobile or desktop) renders
 *   3. Footer renders with share buttons
 *   4. No leaked tokens in body text (`-->`, comment fragments, build markers)
 */
import { test, expect } from '@playwright/test';

const PAGES = [
  { url: '/',                            name: 'home' },
  { url: '/ja/sectors',                  name: 'sectors index' },
  { url: '/ja/sectors/iryo',             name: 'sector item (iryo)' },
  { url: '/ja/156',                      name: 'occupation detail (looker)' },
  { url: '/ja/q/ai-de-kienai',           name: 'Q&A item' },
  { url: '/ja/rankings/ai-risk-low',     name: 'ranking item' },
];

// Strings that should NEVER appear in the user-visible body of any page.
// `-->` is the canary for nested-comment leaks. Other entries are
// build-time markers that should be stripped out.
const FORBIDDEN_TOKENS = [
  '-->',
  'FOOTER:START',
  'FOOTER:END',
  'INCLUDE: map-thumb',
  'engagement block. ',
  'TODO:',
  'FIXME:',
];

for (const page of PAGES) {
  test(`smoke: ${page.name} loads + has nav/footer + no leaks`, async ({ page: browser }) => {
    const resp = await browser.goto(page.url);
    expect(resp?.ok(), `expected 200 for ${page.url}`).toBe(true);

    // Mobile topbar OR desktop top-nav should be present
    const mobOrDesk = browser.locator('header.mob-topbar, nav.top-nav').first();
    await expect(mobOrDesk).toBeVisible();

    // Footer with share buttons
    const footer = browser.locator('footer.site-footer');
    await expect(footer).toBeVisible();
    const shareBtns = footer.locator('.share-btn');
    expect(await shareBtns.count(), 'should have at least 6 share buttons').toBeGreaterThanOrEqual(6);

    // No leaked tokens in body text
    const bodyText = await browser.locator('body').innerText();
    for (const token of FORBIDDEN_TOKENS) {
      expect(bodyText, `body should not contain leaked token \`${token}\` on ${page.name}`).not.toContain(token);
    }
  });
}

test('smoke: home page X follow CTA renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a#x-follow-cta')).toBeVisible();
});

test('smoke: drawer opens and closes (mobile)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' || (await page.viewportSize())?.width !== 393, 'mobile only');
  await page.goto('/ja/sectors');
  const burger = page.locator('#mobBurger');
  await expect(burger).toBeVisible();
  await burger.click();
  const drawer = page.locator('#mobDrawer');
  await expect(drawer).toBeVisible();
  // Close via Esc
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});
