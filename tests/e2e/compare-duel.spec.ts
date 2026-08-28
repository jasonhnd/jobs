/**
 * compare-duel.spec.ts — pinned duel bar + metric rows (#322 / MOBILE_SHAPES §4.4).
 */
import { test, expect } from '@playwright/test';

const PAIR = '/compare/kango-vs-helper';

async function openConsentDecided(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch { /* ignore */ }
  });
  const resp = await page.goto(PAIR, { waitUntil: 'domcontentloaded' });
  expect(resp?.ok(), `${PAIR} should respond 200`).toBe(true);
}

test('390×844 first screen: pinned duel bar, metric rows, no English leftover', async ({ page }) => {
  await openConsentDecided(page, 390, 844);

  const bar = page.locator('.duel-bar');
  await expect(bar).toBeVisible();
  await expect(page.locator('.versus-hero')).toBeHidden();
  await expect(bar.locator('a.duel-side')).toHaveCount(2);

  const risk = page.locator('.cmp-metric', { hasText: '仕事が減るリスク' });
  await expect(risk).toBeVisible();
  await expect(risk.locator('.cm-a')).toHaveText('0.6/10');
  await expect(risk.locator('.cm-b')).toHaveText('0.5/10');

  const sub = await page.locator('.sub').textContent();
  expect(sub).toContain('並べて');
  expect(sub).not.toContain('side-by-side');

  const barBox = await bar.boundingBox();
  expect(barBox, 'duel bar must paint').not.toBeNull();
  expect(barBox!.y, 'duel bar starts on the first screen under the H1').toBeLessThan(400);

  await page.evaluate(() => window.scrollTo(0, 1200));
  const pinned = await bar.boundingBox();
  expect(pinned, 'duel bar must stay after scroll').not.toBeNull();
  expect(pinned!.y, `pinned y=${pinned!.y}`).toBeLessThanOrEqual(50);
});

test('desktop ≥1280 keeps versus-hero and hides the duel bar', async ({ page }) => {
  await openConsentDecided(page, 1280, 800);
  await expect(page.locator('.versus-hero')).toBeVisible();
  await expect(page.locator('.duel-bar')).toBeHidden();
  await expect(page.locator('details.chap')).toHaveAttribute('open', '');
});
