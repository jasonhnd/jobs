/**
 * home-native-roles.spec.ts — rendered roles for the agentic-browsing fix.
 *
 * A static grep of dist-astro/index.html cannot see the mobile TOP 10 cards:
 * renderMobileTop10() injects them after data.top10.json loads. These cases
 * read the accessibility tree after that injection.
 */
import { test, expect, type Page } from '@playwright/test';

async function openHome(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch { /* ignore */ }
  });
  const resp = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(resp?.ok()).toBe(true);
}

test('mobile home keeps button and link roles after TOP 10 renders', async ({ page }) => {
  await openHome(page, 390, 844);

  const chips = page.locator('.mobile-hero-chips button');
  await expect(chips).toHaveCount(5);
  for (const chip of await chips.all()) {
    await expect(chip).toHaveRole('button');
    await expect(chip).not.toHaveAttribute('role', /.+/);
  }
  await expect(page.locator('.mobile-hero-chips')).not.toHaveAttribute('role', /.+/);

  const cards = page.locator('#mTop10Track .m-top10-card');
  await expect(cards).toHaveCount(10, { timeout: 15_000 });
  for (const card of await cards.all()) {
    await expect(card).toHaveRole('link');
    await expect(card).toHaveAttribute('href', /./);
    await expect(card).not.toHaveAttribute('role', /.+/);
  }
  await expect(page.locator('#mTop10Track')).not.toHaveAttribute('role', /.+/);

  await expect(page.locator('ul.risk-distribution')).toHaveRole('list');
  await expect(page.locator('ul.risk-distribution > li').first()).toHaveRole('listitem');
});

test('desktop home chips keep the button role', async ({ page }) => {
  await openHome(page, 1280, 800);

  const chips = page.locator('.desktop-hero-chips button');
  await expect(chips).toHaveCount(5);
  for (const chip of await chips.all()) {
    await expect(chip).toHaveRole('button');
    await expect(chip).not.toHaveAttribute('role', /.+/);
  }
  await expect(page.locator('.desktop-hero-chips')).not.toHaveAttribute('role', /.+/);
  await expect(page.locator('ul.risk-distribution')).toHaveRole('list');
});
