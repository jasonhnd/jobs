/**
 * qa-list.spec.ts — Q&A list-first first screen (#328 family 1).
 *
 * Consent-decided so the cookie bar does not steal first-screen geometry.
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

test('390×844 first screen shows H1, answer line, and rows; 直答 is folded', async ({ page }) => {
  await openConsentDecided(page, '/q/ai-de-kieru', 390, 844);

  const h1 = page.locator('h1').filter({ visible: true }).first();
  await expect(h1).toBeVisible();
  const h1Box = await h1.boundingBox();
  expect(h1Box, 'H1 must paint').not.toBeNull();
  expect(h1Box!.y + h1Box!.height).toBeLessThan(844);

  const sum = page.locator('.qa-sum');
  await expect(sum).toBeVisible();
  const sumText = await sum.innerText();
  expect(sumText).toContain('職');
  expect(sumText).toMatch(/最も高いのは|最も低いのは|先頭は/);

  const rows = page.locator('ol.rank-list > li');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < 4; i++) {
    const box = await rows.nth(i).boundingBox();
    expect(box, `row ${i + 1} must have a box`).not.toBeNull();
    expect(box!.y, `row ${i + 1} y=${box!.y} should be on the first screen`).toBeLessThan(844);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  const row1Name = (await page.locator('ol.rank-list .rl-name').first().innerText()).trim();
  expect(sumText).toContain(row1Name);

  const rowLink = page.locator('ol.rank-list a.rl-row').first();
  await expect(rowLink).toHaveAttribute('data-track-event', 'list_row_click');
  await expect(rowLink.locator('.rl-name')).toBeVisible();

  const chap = page.locator('details.chap');
  await expect(chap).toHaveCount(1);
  await expect(chap.locator('summary')).toHaveText('読み方・出典');
  await expect(chap).not.toHaveAttribute('open');
  await expect(page.locator('.qa-direct')).toBeHidden();
  await expect(page.locator('.ai-fact')).toBeHidden();
});

test('folded chapter opens on desktop helper at 1280 and keeps 直答 + ai-fact', async ({ page }) => {
  await openConsentDecided(page, '/q/ai-de-kieru', 1280, 800);
  const chap = page.locator('details.chap');
  await expect(chap).toHaveCount(1);
  await expect(chap).toHaveAttribute('open', '');
  await expect(chap.locator('.ai-fact')).toBeVisible();
  await expect(chap.locator('.qa-direct')).toBeVisible();
  await expect(chap.locator('.qa-reasoning')).toBeVisible();
});
