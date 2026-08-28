/**
 * rankings-list.spec.ts — list-first first screen (#321 / MOBILE_SHAPES §4.1).
 *
 * Consent-decided: hide the cookie banner so first-screen geometry is the
 * ranking payload, not the consent chrome.
 */
import { test, expect } from '@playwright/test';

async function openConsentDecided(
  page: import('@playwright/test').Page,
  url: string,
  width: number,
  height: number,
) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch { /* ignore */ }
  });
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(resp?.ok(), `${url} should respond 200`).toBe(true);
}

test('390×844 first screen shows H1, summary, and rows 1–4', async ({ page }) => {
  await openConsentDecided(page, '/rankings/ai-risk-high', 390, 844);

  const h1 = page.locator('h1').filter({ visible: true }).first();
  await expect(h1).toBeVisible();
  const h1Box = await h1.boundingBox();
  expect(h1Box, 'H1 must paint').not.toBeNull();
  expect(h1Box!.y + h1Box!.height).toBeLessThan(844);

  const sum = page.locator('.rk-sum');
  await expect(sum).toBeVisible();
  await expect(sum).toContainText('1位は');
  await expect(sum).toContainText('更新');

  const rows = page.locator('ol.rank-list > li');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < 4; i++) {
    const box = await rows.nth(i).boundingBox();
    expect(box, `row ${i + 1} must have a box`).not.toBeNull();
    expect(box!.y, `row ${i + 1} y=${box!.y} should be on the first screen`).toBeLessThan(844);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const rank1 = await rows.nth(0).boundingBox();
  expect(rank1!.y + rank1!.height).toBeLessThan(844);

  const rowLink = page.locator('ol.rank-list a.rl-row').first();
  await expect(rowLink).toHaveAttribute('data-track-event', 'list_row_click');
  await expect(rowLink.locator('.rl-name')).toBeVisible();
});

test('salary ranking still renders salary extras in the row', async ({ page }) => {
  await openConsentDecided(page, '/rankings/salary', 390, 844);
  const meta = page.locator('ol.rank-list .rl-meta').first();
  await expect(meta).toBeVisible();
  await expect(meta).toContainText('万円');
});

test('folded chapter exists and desktop helper opens it at 1280', async ({ page }) => {
  await openConsentDecided(page, '/rankings/ai-risk-high', 1280, 800);
  const chap = page.locator('details.chap');
  await expect(chap).toHaveCount(1);
  await expect(chap.locator('summary')).toHaveText('このランキングの読み方・出典');
  await expect(chap).toHaveAttribute('open', '');
  await expect(chap.locator('.ai-fact')).toBeVisible();
  await expect(chap.locator('.intro')).toBeVisible();
  await expect(chap.locator('.sub')).toBeVisible();
});
