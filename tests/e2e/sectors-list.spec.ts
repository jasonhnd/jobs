/**
 * sectors-list.spec.ts — sector list-first first screen (#328 family 2).
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

test('390×844 first screen shows H1, sub, and full-list rows; prose is folded', async ({ page }) => {
  await openConsentDecided(page, '/sectors/iryo', 390, 844);

  const h1 = page.locator('h1').filter({ visible: true }).first();
  await expect(h1).toBeVisible();
  const h1Box = await h1.boundingBox();
  expect(h1Box, 'H1 must paint').not.toBeNull();
  expect(h1Box!.y + h1Box!.height).toBeLessThan(844);

  const sub = page.locator('header#content .sub');
  await expect(sub).toBeVisible();
  await expect(sub).toContainText('職業');

  const rows = page.locator('section.sec-list-sec ol.rank-list > li');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < 4; i++) {
    const box = await rows.nth(i).boundingBox();
    expect(box, `row ${i + 1} must have a box`).not.toBeNull();
    expect(box!.y, `row ${i + 1} y=${box!.y} should be on the first screen`).toBeLessThan(844);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  const rowLink = page.locator('section.sec-list-sec ol.rank-list a.rl-row').first();
  await expect(rowLink).toHaveAttribute('data-track-event', 'list_row_click');
  await expect(rowLink.locator('.rl-name')).toBeVisible();

  const chap = page.locator('details.chap');
  await expect(chap).toHaveCount(1);
  await expect(chap.locator('summary')).toHaveText('読み方・出典');
  await expect(chap).not.toHaveAttribute('open');
  await expect(page.locator('.ai-fact')).toBeHidden();
  await expect(page.locator('.intro')).toBeHidden();
  await expect(page.locator('.stats')).toBeHidden();
});

test('folded chapter opens on desktop helper at 1280 and keeps TOP5 + ai-fact', async ({ page }) => {
  await openConsentDecided(page, '/sectors/iryo', 1280, 800);
  const chap = page.locator('details.chap');
  await expect(chap).toHaveCount(1);
  await expect(chap).toHaveAttribute('open', '');
  await expect(chap.locator('.ai-fact')).toBeVisible();
  await expect(chap.locator('.stats')).toBeVisible();
  const foldedRows = chap.locator('ol.rank-list > li');
  expect(await foldedRows.count()).toBeGreaterThanOrEqual(5);
  await expect(foldedRows.first().locator('a.rl-row')).toHaveAttribute(
    'data-track-event',
    'list_row_click',
  );
});
