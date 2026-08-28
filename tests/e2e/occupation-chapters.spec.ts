/**
 * occupation-chapters.spec.ts — chaptered body + chip nav (#324 / MOBILE_SHAPES §4.3).
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

const CHAPTER_IDS = [
  'chp-score', 'chp-about', 'chp-path', 'chp-work', 'chp-next', 'chp-faq', 'chp-source',
];

test('390×844 /156: seven closed chapters, chip nav, FAQ still in HTML', async ({ page }) => {
  await openConsentDecided(page, '/156', 390, 844);

  const chaps = page.locator('details.chap');
  await expect(chaps).toHaveCount(7);
  for (const id of CHAPTER_IDS) {
    await expect(page.locator(`details.chap#${id}`)).toBeAttached();
    await expect(page.locator(`details.chap#${id}`)).not.toHaveAttribute('open');
  }

  const chips = page.locator('.chipnav a');
  await expect(chips).toHaveCount(7);
  await expect(chips.nth(0)).toHaveText('スコアの中身');
  await expect(chips.nth(6)).toHaveText('出典と数字');

  const faqCount = await page.locator('.faq-item').count();
  expect(faqCount, 'FAQ items stay in the initial HTML').toBeGreaterThan(0);

  await expect(page.locator('#sec-aiois')).toBeAttached();
  await expect(page.locator('.ai-fact')).toBeAttached();
  await expect(page.locator('#worktype-verdict-title')).toBeAttached();
});

test('/156 door #sec-aiois opens スコアの中身', async ({ page }) => {
  await openConsentDecided(page, '/156', 390, 844);
  await page.locator('.v-doors a.solid').click();
  await expect(page.locator('#chp-score')).toHaveAttribute('open', '');
  await expect(page.locator('#sec-aiois')).toBeVisible();
});

test('/430 door 移り先 opens 似た仕事・移り先', async ({ page }) => {
  await openConsentDecided(page, '/430', 390, 844);
  const ghost = page.locator('.v-doors a.ghost');
  await expect(ghost).toHaveAttribute('href', '#sec-transfer');
  await ghost.click();
  await expect(page.locator('#chp-next')).toHaveAttribute('open', '');
});

test('desktop ≥1280 opens every chapter', async ({ page }) => {
  await openConsentDecided(page, '/156', 1280, 800);
  const chaps = page.locator('details.chap');
  await expect(chaps).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    await expect(chaps.nth(i)).toHaveAttribute('open', '');
  }
});

test('chip tap opens the matching chapter', async ({ page }) => {
  await openConsentDecided(page, '/156', 390, 844);
  await page.locator('.chipnav a[href="#chp-about"]').click();
  await expect(page.locator('#chp-about')).toHaveAttribute('open', '');
});
