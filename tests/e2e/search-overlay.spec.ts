/**
 * search-overlay.spec.ts — global mobile top-bar search (#327).
 */
import { test, expect } from '@playwright/test';

async function openPage(
  page: import('@playwright/test').Page,
  path: string,
  width = 390,
  height = 844,
) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch { /* ignore */ }
  });
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(resp?.ok()).toBe(true);
}

async function openOverlay(page: import('@playwright/test').Page) {
  await page.locator('#mobSearchBtn').click();
  await expect(page.locator('#mobSearchOverlay')).toBeVisible();
  await expect(page.locator('#mobSearchInput')).toBeFocused();
}

test('390: search trigger is between brand and burger on home, occupation, rankings', async ({ page }) => {
  for (const path of ['/', '/156', '/rankings/ai-risk-high']) {
    await openPage(page, path);
    const btn = page.locator('#mobSearchBtn');
    await expect(btn).toBeVisible();
    const brandX = await page.locator('.mob-topbar-brand').evaluate((el) => el.getBoundingClientRect().x);
    const btnBox = await btn.boundingBox();
    const burgerX = await page.locator('#mobBurger').evaluate((el) => el.getBoundingClientRect().x);
    expect(btnBox).toBeTruthy();
    expect(brandX).toBeLessThan(btnBox!.x);
    expect(btnBox!.x).toBeLessThan(burgerX);
    expect(btnBox!.width).toBeGreaterThanOrEqual(44);
    expect(btnBox!.height).toBeGreaterThanOrEqual(44);
  }
});

test('390: 看護 lists 看護師 3.6/10', async ({ page }) => {
  await openPage(page, '/');
  await openOverlay(page);
  await page.locator('#mobSearchInput').fill('看護');
  const row = page.locator('#mobSearchOverlay a.mob-search-row', { hasText: '看護師' }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText('3.6/10');
  await expect(row).toHaveAttribute('href', '/156');
  await expect(page.locator('.mob-search-empty-head')).toBeHidden();
});

test('390: zero results shows 見つからないとき doors', async ({ page }) => {
  await openPage(page, '/156');
  await openOverlay(page);
  await page.locator('#mobSearchInput').fill('zzzznotajob');
  await expect(page.locator('.mob-search-empty-head')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.mob-search-empty-head')).toHaveText('見つからないとき');
  await expect(page.locator('.mob-search-door-row a[href="/sectors"]')).toBeVisible();
  await expect(page.locator('.mob-search-door-row a[href="/rankings"]')).toBeVisible();
  await expect(page.locator('.mob-search-door-row a[href="/me"]')).toBeVisible();
});

test('390: Esc closes and returns focus to the trigger', async ({ page }) => {
  await openPage(page, '/rankings/ai-risk-high');
  await openOverlay(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobSearchOverlay')).toBeHidden();
  await expect(page.locator('#mobSearchBtn')).toBeFocused();
});

test('390: 最近見た after a result tap, consent accepted', async ({ page }) => {
  await openPage(page, '/');
  await openOverlay(page);
  await page.locator('#mobSearchInput').fill('看護');
  const row = page.locator('#mobSearchOverlay a.mob-search-row', { hasText: '看護師' }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await Promise.all([
    page.waitForURL('**/156'),
    row.click(),
  ]);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openOverlay(page);
  await page.locator('#mobSearchInput').fill('');
  await expect(page.locator('.mob-search-recent')).toBeVisible();
  await expect(page.locator('.mob-search-recent-list a.mob-search-row').first()).toContainText('看護師');
});

test('desktop hides the search trigger', async ({ page }) => {
  await openPage(page, '/', 1280, 800);
  await expect(page.locator('#mobSearchBtn')).toBeHidden();
  await expect(page.locator('#mobSearchOverlay')).toBeHidden();
});
