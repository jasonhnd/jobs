import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Local built output has empty analytics settings; still isolate external collectors.
test.beforeEach(async ({ context }) => {
  await context.route(/https?:\/\/(?:[^/]+\.)?(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|connect\.facebook\.net|static\.ads-twitter\.com|static\.cloudflareinsights\.com|va\.vercel-scripts\.com)\//, route => route.abort());
});

for (const width of [1440, 768, 375]) {
  test(`Pro pages retain full accessible content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/pro', '/pro/428', '/pro/404', '/pro/rankings', '/pro/rankings/ai-risk-high']) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await page.locator('h1').waitFor();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.edition-nav')).toBeVisible();
      await expect(page.locator('.edition-nav a', { hasText: '通常版へ' })).toHaveAttribute('href', path === '/pro' ? '/' : path === '/pro/rankings' ? '/rankings' : path === '/pro/404' ? '/occupations/404' : path.replace('/pro', ''));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;
      expect(violations, path).toEqual([]);
    }
  });
}

test('numeric occupation 404 switches both ways and preserves chapter anchors', async ({ page }) => {
  await page.goto('/occupations/404');
  await page.locator('[data-pro-cta] h2 a').click();
  await expect(page).toHaveURL(/\/pro\/404$/);
  await page.locator('.chipnav a[href="#chp-source"]').click();
  await expect(page.locator('#chp-source')).toHaveAttribute('open', '');
  await page.locator('.edition-nav a', { hasText: '通常版へ' }).click();
  await expect(page).toHaveURL(/\/occupations\/404$/);
});

test('unknown Pro IDs and slugs retain real 404 semantics', async ({ page }) => {
  for (const path of ['/pro/999999', '/pro/0', '/pro/occupations/404', '/pro/rankings/unknown']) {
    expect((await page.goto(path))?.status(), path).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  }
});

test('stage-1A migrating ranking returns to its live ordinary page without adding a CTA', async ({ page }) => {
  await page.goto('/pro/rankings/entry-salary');
  await expect(page.locator('.edition-nav a', { hasText: '通常版へ' })).toHaveAttribute('href', '/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://mirai-shigoto.com/pro/rankings/entry-salary');
  await page.locator('.edition-nav a', { hasText: '通常版へ' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-pro-cta]')).toHaveCount(0);
});
