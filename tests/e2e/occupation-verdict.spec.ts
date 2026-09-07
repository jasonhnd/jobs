/**
 * occupation-verdict.spec.ts — numbers-first verdict card (#323 / MOBILE_SHAPES §4.2).
 */
import { test, expect } from '@playwright/test';

async function openConsentDecided(
  page: import('@playwright/test').Page,
  path: string,
  width: number,
  height: number,
) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch { /* ignore */ }
  });
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(resp?.ok(), `${path} should respond 200`).toBe(true);
}

test('390×844 /156 low-risk: numbers, なぜ守られやすいか door, disclaimer', async ({ page }) => {
  await openConsentDecided(page, '/156', 390, 844);

  const card = page.locator('.risk-card.verdict-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.v-num.main .score-num')).toContainText('/10');
  await expect(card.locator('.v-num.subn .score-num')).toContainText('/10');
  await expect(card.locator('.v-rank')).toContainText('職中');
  await expect(card.locator('.v-rank')).toContainText('先月比');
  await expect(card.locator('.v-line')).not.toHaveText('');
  await expect(card.locator('.v-facts')).toContainText('年収');
  await expect(card.locator('.v-doors a.solid')).toHaveText('なぜ守られやすいか');
  await expect(card.locator('.v-doors a.solid')).toHaveAttribute('href', '#sec-aiois');
  await expect(card.locator('.v-doors a.ghost')).toHaveText('似た仕事');
  await expect(page.locator('.aiois-disc')).toBeVisible();
  await expect(page.locator('#sec-aiois')).toBeAttached();
  await expect(page.locator('#sec-similar')).toBeAttached();
  await expect(page.locator('#sec-transfer')).toBeAttached();
  await expect(page.locator('#sec-ai-detail')).toBeAttached();
  await expect(page.locator('#worktype-verdict-title')).toBeAttached();

  const discBox = await page.locator('.aiois-disc').boundingBox();
  expect(discBox, 'disclaimer paints').not.toBeNull();
  expect(discBox!.y, 'disclaimer stays on the first screen').toBeLessThan(844);
});

test('390×844 /430 high-risk: AIで変わる作業 / 移り先 doors', async ({ page }) => {
  await openConsentDecided(page, '/430', 390, 844);
  const doors = page.locator('.v-doors a');
  await expect(doors.nth(0)).toHaveText('AIで変わる作業を見る');
  await expect(doors.nth(0)).toHaveAttribute('href', '#sec-aiois');
  await expect(doors.nth(1)).toHaveText(/移り先の候補|似た仕事/);
});

test('desktop ≥1280 keeps a two-column verdict grid', async ({ page }) => {
  await openConsentDecided(page, '/156', 1280, 800);
  const display = await page.locator('.verdict-grid').evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe('grid');
  await expect(page.locator('.v-doors a.solid')).toBeVisible();
});
