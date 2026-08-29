/**
 * home-first-screen.spec.ts — mobile home first screen (#325 / MOBILE_SHAPES §4.7).
 */
import { test, expect } from '@playwright/test';

async function openHome(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch { /* ignore */ }
  });
  const resp = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(resp?.ok()).toBe(true);
}

test('390×844: 調べる, movers, door cards, H1 working copy', async ({ page }) => {
  await openHome(page, 390, 844);
  await expect(page.locator('#mhSearchBtn')).toHaveText('調べる');
  await expect(page.locator('.mobile-hero-title')).toContainText('あなたの仕事は');
  await expect(page.locator('.home-movers')).toBeVisible();
  await expect(page.locator('.home-movers-head a')).toHaveAttribute('href', '/rankings');
  await expect(page.locator('.home-doors a[href="/rankings"]')).toBeVisible();
  await expect(page.locator('.home-doors a[href="/compare"]')).toBeVisible();
  await expect(page.locator('.home-doors a[href="/map"]')).toBeVisible();
  const me = page.locator('.home-doors a[href="/me"]');
  await expect(me).toBeVisible();
  await expect(me).toHaveAttribute('data-entry-source', 'home_door');
  await expect(me).toHaveAttribute('data-track-event', 'me_entry_click');
  const moversY = await page.locator('.home-movers').evaluate((el) => el.getBoundingClientRect().y);
  const doorsY = await page.locator('.home-doors').evaluate((el) => el.getBoundingClientRect().y);
  const bandY = await page.locator('.home-entry-band').evaluate((el) => el.getBoundingClientRect().y);
  expect(moversY).toBeLessThan(doorsY);
  expect(doorsY).toBeLessThan(bandY);
});

test('320px search bar: 調べる does not overflow', async ({ page }) => {
  await openHome(page, 320, 568);
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await expect(page.locator('#mhSearchBtn')).toBeVisible();
});

test('desktop ≥1280 keeps desktop hero and hides movers/doors', async ({ page }) => {
  await openHome(page, 1280, 800);
  await expect(page.locator('.desktop-hero')).toBeVisible();
  await expect(page.locator('#dhSearchBtn')).toBeVisible();
  await expect(page.locator('.home-movers')).toBeHidden();
  await expect(page.locator('.home-doors')).toBeHidden();
  await expect(page.locator('#mhSearchBtn')).toBeHidden();
});
