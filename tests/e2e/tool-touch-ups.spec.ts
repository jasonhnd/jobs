/**
 * tool-touch-ups.spec.ts — /me chips + /shindan Q1 first-screen (#326).
 */
import { test, expect } from '@playwright/test';

async function open(page: import('@playwright/test').Page, path: string, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'accepted'); } catch { /* ignore */ }
  });
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(resp?.ok()).toBe(true);
}

test('/me 390: placeholder, five corpus chips, hint, preview card', async ({ page }) => {
  await open(page, '/me');
  await expect(page.locator('#meInput')).toHaveAttribute(
    'placeholder',
    '気になる職業を入力（例：看護師、営業）',
  );
  const chips = page.locator('#meEmpty [data-chip]');
  await expect(chips).toHaveCount(5);
  await expect(chips).toHaveText(['一般事務', '経理事務', 'データ入力', '看護師', '保育士']);
  await expect(page.locator('.me-empty-hint')).toHaveText('タップですぐ表示されます');
  await expect(page.locator('.me-empty-preview')).toContainText('職業を選ぶと、ここに出ます');
  await expect(page.locator('#meNoOccEntry')).toBeVisible();
  const placeholderFits = await page.evaluate(() => {
    const el = document.getElementById('meInput') as HTMLInputElement | null;
    if (!el) return false;
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.textContent = el.placeholder;
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};font-size:${cs.getPropertyValue('font-size')};`;
    const phSize = getComputedStyle(el, '::placeholder').fontSize;
    if (phSize) probe.style.fontSize = phSize;
    document.body.appendChild(probe);
    const content = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w <= content + 1;
  });
  expect(placeholderFits).toBe(true);
});

test('/me chip 一般事務 selects occupation 428', async ({ page }) => {
  await open(page, '/me');
  await page.locator('#meEmpty [data-chip="一般事務"]').click();
  await expect(page.locator('#meResults')).toHaveAttribute('data-visible', 'true', { timeout: 10_000 });
  await expect(page.locator('#meSummaryName')).toHaveText('一般事務');
  expect(new URL(page.url()).searchParams.get('id')).toBe('428');
});

test('/me chip 看護師 selects occupation 156', async ({ page }) => {
  await open(page, '/me');
  await page.locator('#meEmpty [data-chip="看護師"]').click();
  await expect(page.locator('#meResults')).toHaveAttribute('data-visible', 'true', { timeout: 10_000 });
  await expect(page.locator('#meSummaryName')).toHaveText('看護師');
  expect(new URL(page.url()).searchParams.get('id')).toBe('156');
});

test('/shindan 390 consent-decided: Q1 and both choices fit in 844px', async ({ page }) => {
  await open(page, '/shindan');
  const q1 = page.locator('.shindan-question').first();
  await expect(q1).toBeVisible();
  const choices = q1.locator('.shindan-choice-text');
  await expect(choices).toHaveCount(2);
  const last = choices.last();
  const box = await last.boundingBox();
  expect(box).toBeTruthy();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
  await expect(page.locator('#shindanProgressText')).toHaveText('0 / 9問');
  const proofY = await page.locator('.shindan-proof').evaluate((el) => el.getBoundingClientRect().y);
  const q1Y = await q1.evaluate((el) => el.getBoundingClientRect().y);
  expect(proofY).toBeGreaterThan(q1Y);
});
