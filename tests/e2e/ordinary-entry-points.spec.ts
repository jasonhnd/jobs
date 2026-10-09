import { expect, test } from '@playwright/test';

const ordinary = ['/me', '/shindan', '/rankings', '/map', '/sectors', '/pro'];
const rankings = ['ai-risk-high', 'ai-risk-low', 'salary-safe', 'workers', 'salary', 'short-hours', 'high-demand', 'hourly-wage'];

test.beforeEach(async ({ page, context }) => {
  await context.route(/https?:\/\/(?:[^/]+\.)?(?:googletagmanager\.com|google-analytics\.com|doubleclick\.net|connect\.facebook\.net|static\.cloudflareinsights\.com|va\.vercel-scripts\.com)\//, route => route.abort());
  await page.addInitScript(() => localStorage.setItem('cookieConsent', 'rejected'));
});

for (const width of [1440, 768, 375]) {
  test(`ordinary navigation has six reading entries at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/map');
    const nav = width > 768 ? page.locator('.top-nav') : page.locator('#mobDrawer');
    if (width <= 768) await page.locator('#mobBurger').click();
    const links = nav.locator(width > 768 ? 'a:not(.top-nav-brand)' : 'a');
    expect(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(ordinary);
    await expect(nav.locator('a[href="/map"]')).toHaveAttribute('aria-current', 'page');
    if (width <= 768) {
      // Presence alone misses page toolbars painting over the open drawer.
      for (const href of ordinary) await nav.locator(`a[href="${href}"]`).click({ trial: true, timeout: 2000 });
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobDrawer')).toBeHidden();
      await expect(page.locator('#mobBurger')).toBeFocused();
    }
    expect(await page.locator('.footer-nav a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(ordinary);
    await expect(page.locator('.footer-legal a[href="/about"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('homepage offers exactly eight ordinary ranking cards and a compact Pro entry', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('[aria-labelledby="hub-rankings-title"] .hub-card').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(hrefs.sort()).toEqual(rankings.map(slug => `/rankings/${slug}`).sort());
  await expect(page.locator('.hub-deep .hub-card')).toHaveCount(1);
  await expect(page.locator('.hub-deep a[href="/pro"]')).toHaveCount(1);
  await expect(page.locator('.home-entry-secondary')).toHaveCount(0);
});

test('map explains the colours, provides a search next step and exposes all three bands', async ({ page }) => {
  await page.goto('/map');
  await expect(page.locator('.ordinary-conclusion')).toHaveText('日本の556の仕事を、AIでどれだけ変わるかで色分けした地図です。');
  await expect(page.locator('#map-search-guidance')).toHaveText('まず、自分の仕事を探してみましょう。');
  await expect(page.locator('#searchInput')).toHaveAttribute('aria-describedby', 'map-search-guidance');
  await expect(page.locator('.map-search-btn')).toHaveText('探す');
  await expect(page.locator('.legend')).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.legend')).toContainText('4.0未満');
  await expect(page.locator('.legend')).toContainText('4.0–6.9');
  await expect(page.locator('.legend')).toContainText('7.0以上');
});

test('sector index and 4.0 sector boundary show conclusions before numeric metadata', async ({ page }) => {
  await page.goto('/sectors');
  await expect(page.locator('.ordinary-conclusion')).toContainText('平均するとAIで変わる部分が「中くらい」です。');
  await expect(page.locator('.sc-risk')).toHaveCount(16);
  await page.locator('.sc-name-link[href="/sectors/iryo"]').click();
  await expect(page.locator('.ordinary-conclusion')).toHaveText('医療・保健の36の仕事は、平均するとAIで変わる部分が「中くらい」です。');
  await expect(page.locator('.ordinary-score-meta')).toContainText('4.0/10 変化 中くらい');
  await expect(page.locator('.ordinary-next-step')).toHaveAttribute('href', '#sector-occupations');
  await page.locator('.ordinary-next-step').click();
  await expect(page.locator('#sector-occupations')).toBeInViewport();
});

 test('Pro keeps research navigation and ordinary search does not prefix shared tools', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pro');
  await expect(page.locator('.top-nav a[href="/pro/compare"]')).toHaveCount(1);
  await expect(page.locator('.footer-nav a[href="/pro/skills"]')).toHaveCount(1);
  await expect(page.locator('.top-nav a[href="/me"]')).toHaveCount(1);
});

test('completed diagnosis flows through me and the same occupation into Pro', async ({ page }) => {
  await page.goto('/shindan');
  for (let i = 0; i < 9; i++) await page.locator('.shindan-question').nth(i).locator('.shindan-choice').first().click();
  await page.locator('#shindanSubmit').click();
  await expect(page.locator('#shindanResult')).toBeVisible();
  await page.locator('.shindan-me-entry').click();
  await expect(page).toHaveURL(/\/me$/);
  await page.locator('#meEmpty [data-chip="一般事務"]').click();
  await expect(page.locator('#meResults')).toHaveAttribute('data-visible', 'true');
  await expect(page.locator('#meOccupationLink')).toHaveAttribute('href', '/428');
  await page.locator('#meOccupationLink').click();
  await expect(page).toHaveURL(/\/428$/);
  const metadata = await page.locator('[data-occupation-page-meta]').getAttribute('data-risk-score');
  expect(metadata).toBeTruthy();
  await page.locator('[data-pro-cta] a').click();
  await expect(page).toHaveURL(/\/pro\/428$/);
  expect(await page.locator('[data-occupation-page-meta]').getAttribute('data-risk-score')).toBe(metadata);
  await page.goto('/me?id=404');
  await expect(page.locator('#meOccupationLink')).toHaveAttribute('href', '/occupations/404');
});

test('all 16 sector conclusions match their index scores and bands', async ({ page }) => {
  await page.goto('/sectors');
  const sectors = await page.locator('.sector-card').evaluateAll(nodes => nodes.map(node => ({
    href: node.querySelector('a.sc-name-link')!.getAttribute('href')!,
    label: node.querySelector('.sc-risk')!.textContent!.replace('AI 影響 平均 ', ''),
  })));
  expect(sectors).toHaveLength(16);
  for (const sector of sectors) {
    expect((await page.goto(sector.href))?.status()).toBe(200);
    await expect(page.locator('.ordinary-score-meta')).toContainText(sector.label);
    const band = sector.label.split('変化 ')[1];
    await expect(page.locator('.ordinary-conclusion')).toContainText(`「${band}」`);
  }
});
