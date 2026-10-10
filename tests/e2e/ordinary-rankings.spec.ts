import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const slugs = ['ai-risk-high', 'workers', 'ai-risk-low', 'high-demand', 'salary-safe', 'short-hours', 'hourly-wage', 'salary'];
const metricLabels: Record<string, string> = {
  'ai-risk-high': 'AI変化度', 'ai-risk-low': 'AI変化度', workers: '就業者数',
  'high-demand': '求人需要', 'salary-safe': '年収', 'short-hours': '月間労働時間', 'hourly-wage': '換算時給', salary: '年収',
};
for (const width of [1440, 768, 375]) {
  for (const slug of ['index', ...slugs]) {
    test(`${slug}: ordinary first screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => { localStorage.setItem('cookieConsent', 'rejected'); });
      const path = slug === 'index' ? '/rankings' : `/rankings/${slug}`;
      const response = await page.goto(path, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('#content .ordinary-lead')).toBeVisible();
      const cta = page.locator('#content a[data-track-event="me_entry_click"]');
      await expect(cta).toHaveAttribute('href', '/me');
      await expect(cta).toHaveText('自分の仕事を探す');
      const box = await cta.boundingBox();
      expect(box!.y + box!.height, 'CTA must be in the first screen').toBeLessThan(900);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator('details.chap, .mover-row, .insight-card')).toHaveCount(0);
      if (slug === 'index') {
        await expect(page.locator('.ordinary-ranking-card')).toHaveCount(8);
        await expect(page.locator('.ordinary-ranking-card h2').first()).toHaveCSS('font-size', '22px');
        expect(await page.locator('.ordinary-ranking-card').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(slugs.map(s => `/rankings/${s}`));
        await expect(page.locator('[data-pro-cta] a')).toHaveText('全39ランキングは Pro で');
        await expect(page.locator('[data-pro-cta] a')).toHaveAttribute('href', '/pro/rankings');
      } else {
        await expect(page.locator('.rl-metric').first()).toContainText(metricLabels[slug]!);
        await expect(page.locator('.risk-pill').first()).toContainText(/\/10 変化 (小さい|中くらい|大きい)/);
        await expect(page.locator('.rl-name').first()).toBeVisible();
        await expect(page.locator('.ordinary-band').first()).toHaveCSS('white-space', 'nowrap');
        await expect(page.locator('[data-pro-cta] a')).toHaveAttribute('href', `/pro/rankings/${slug}`);
        if (slug === 'hourly-wage') await expect(page.locator('.ordinary-note')).toContainText('160時間');
        const currentScores = await page.locator('ol.rank-list .risk-pill').allTextContents();
        const currentNames = await page.locator('ol.rank-list .rl-name').allTextContents();
        const pro = await page.context().newPage();
        const proResponse = await pro.goto(`/pro/rankings/${slug}`);
        expect(proResponse?.status(), 'Pro comparison must load a real page').toBe(200);
        await expect(pro.locator('ol.rank-list > li')).toHaveCount(30);
        expect(await pro.locator('ol.rank-list .risk-pill').allTextContents()).toEqual(currentScores);
        expect(await pro.locator('ol.rank-list .rl-name').allTextContents()).toEqual(currentNames);
        await expect(pro.locator('details.chap')).toHaveCount(1);
        await pro.close();
      }
      await cta.focus();
      await expect(cta).toBeFocused();
      if (process.env.RANKING_SCREENSHOTS) {
        mkdirSync(process.env.RANKING_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: `${process.env.RANKING_SCREENSHOTS}/${slug}-${width}-rejected.png` });
        await page.evaluate(() => localStorage.removeItem('cookieConsent'));
        await page.reload({ waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${process.env.RANKING_SCREENSHOTS}/${slug}-${width}-first-visit.png` });
      }
    });
  }
}

test('ordinary score captions remain legible in dark mode and primary CTA works without JavaScript', async ({ page, browser }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/rankings/workers');
  await expect(page.locator('.rl-metric').first()).toContainText('就業者数');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await context.newPage();
  await noJs.goto('/rankings/ai-risk-high');
  await noJs.locator('#content a[href="/me"]').click();
  await expect(noJs).toHaveURL(/\/me$/);
  await context.close();
});
