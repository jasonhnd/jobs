/**
 * cookie-banner.spec.ts — compact consent bar (#320 / MOBILE_SHAPES §3.4).
 *
 * First-visit presentation only: height, type floor, 44px hit area, and
 * accept/reject still writing `localStorage.cookieConsent`. Consent-mode
 * wiring is unchanged and is not re-asserted here.
 */
import { test, expect } from '@playwright/test';

const RANKING_URL = '/rankings/ai-risk-high';

async function openFirstVisit(page: import('@playwright/test').Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.removeItem('cookieConsent'); } catch { /* ignore */ }
  });
  const resp = await page.goto(RANKING_URL, { waitUntil: 'domcontentloaded' });
  expect(resp?.ok(), `${RANKING_URL} should respond 200`).toBe(true);
  const banner = page.locator('#cookieBanner');
  await expect(banner).toBeVisible();
  return banner;
}

test('cookie bar is one compact line at 390×844 on first visit', async ({ page }) => {
  const banner = await openFirstVisit(page, 390, 844);

  await expect(banner.locator('.cb-text')).toContainText('解析のためCookieを使用します。');
  await expect(banner.locator('a[href="/privacy"]')).toHaveText('詳細');
  await expect(page.locator('#cookieReject')).toHaveText('拒否する');
  await expect(page.locator('#cookieAccept')).toHaveText('同意する');

  const fontSize = await banner.locator('.cb-text').evaluate((el) => (
    parseFloat(getComputedStyle(el).fontSize)
  ));
  expect(fontSize, 'cookie bar text must be ≥12px').toBeGreaterThanOrEqual(12);

  const box = await banner.boundingBox();
  expect(box, 'banner must have a bounding box').not.toBeNull();
  expect(box!.height, `banner height ${box!.height}px must be ≤48px at 390`).toBeLessThanOrEqual(48);

  for (const id of ['#cookieReject', '#cookieAccept'] as const) {
    const btnBox = await page.locator(id).boundingBox();
    expect(btnBox, `${id} must have a bounding box`).not.toBeNull();
    expect(btnBox!.height, `${id} hit height`).toBeGreaterThanOrEqual(44);
    expect(btnBox!.width, `${id} hit width`).toBeGreaterThanOrEqual(44);
  }

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test('cookie bar stays a single unobtrusive row at 1280px', async ({ page }) => {
  const banner = await openFirstVisit(page, 1280, 800);
  const box = await banner.boundingBox();
  expect(box, 'banner must have a bounding box').not.toBeNull();
  expect(box!.height, `desktop banner height ${box!.height}px`).toBeLessThanOrEqual(48);
  await expect(page.locator('#cookieReject')).toBeVisible();
  await expect(page.locator('#cookieAccept')).toBeVisible();
});

test('accept writes cookieConsent=accepted and hides the bar', async ({ page }) => {
  await openFirstVisit(page, 390, 844);
  await page.locator('#cookieAccept').click();
  await expect(page.locator('#cookieBanner')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('cookieConsent'))).toBe('accepted');
});

test('reject writes cookieConsent=rejected and hides the bar', async ({ page }) => {
  await openFirstVisit(page, 390, 844);
  await page.locator('#cookieReject').click();
  await expect(page.locator('#cookieBanner')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('cookieConsent'))).toBe('rejected');
});
