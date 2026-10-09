import { expect, test } from '@playwright/test';

const cases = ['/428', '/1', '/156', '/140', '/471', '/occupations/404'];
for (const path of cases) {
  test(`${path} ordinary summary and full Pro page agree`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookieConsent', 'rejected'));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const summary = page.locator('[data-occupation-summary]');
    await expect(summary).toBeVisible();
    const score = await summary.locator('[data-summary-score]').getAttribute('data-summary-score');
    const band = await summary.locator('.score-band').textContent();
    const name = await page.locator('h1').textContent();
    await expect(summary.locator('[data-primary-action]')).toHaveCount(1);
    if (path === '/140') {
      await expect(summary.locator('.summary-stats dd')).toHaveText(['—', '—']);
      await expect(summary.locator('[aria-label="データなし"]')).toHaveCount(2);
    }
    await expect(page.locator('details.chap, .faq-item, .risk-rationale, .v-num.subn, .score-history')).toHaveCount(0);
    const proPath = path === '/occupations/404' ? '/pro/404' : `/pro${path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://mirai-shigoto.com${path}`);
    for (const id of ['chp-score', 'chp-about', 'chp-path', 'chp-work', 'chp-next', 'chp-faq', 'chp-source', 'sec-aiois', 'sec-ai-detail', 'sec-transfer', 'sec-similar', 'score-history-details']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
      // sec-similar is the visible ordinary related list; other old sections link to Pro.
      if (id !== 'sec-similar') await expect(page.locator(`#${id} a[href="${proPath}#${id}"]`)).toHaveCount(1);
    }
    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .flatMap(text => { const root = JSON.parse(text); return root['@graph'] ?? [root]; });
    expect(nodes.some(n => n['@type'] === 'FAQPage')).toBe(false);
    const webpage = nodes.find(n => n['@type'] === 'WebPage');
    for (const selector of webpage.speakable.cssSelector) await expect(page.locator(selector)).toBeVisible();
    await summary.locator('[data-primary-action]').click();
    expect(new URL(page.url()).pathname).toBe(proPath);
    await expect(page.locator('#chp-score')).toHaveAttribute('open', '');
    await expect(page.locator('#sec-aiois')).toBeVisible();
    await expect(page.locator('h1')).toHaveText(name!);
    await expect(page.locator('.v-num.main .score-num')).toHaveText(`${score}/10`);
    await expect(page.locator('.v-num.main .score-band')).toHaveText(band!);
    await expect(page.locator('details.chap')).toHaveCount(7);
    await expect(page.locator('.faq-item')).not.toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://mirai-shigoto.com${proPath}`);
  });
}

test('ordinary hero fits 375px and retains old deep-link handoff with no JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 844 } });
  const page = await context.newPage();
  await page.goto('/428#sec-ai-detail');
  await expect(page.locator('#sec-ai-detail a')).toHaveAttribute('href', '/pro/428#sec-ai-detail');
  await page.locator('#sec-ai-detail a').click();
  expect(new URL(page.url()).pathname).toBe('/pro/428');
  expect(new URL(page.url()).hash).toBe('#sec-ai-detail');
  await expect(page.locator('h1')).toHaveText('一般事務');
  await expect(page.locator('#sec-ai-detail')).toBeAttached();
  await page.goto('/428');
  const box = await page.locator('[data-primary-action]').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await context.close();
});

test('summary primary action has keyboard focus and existing token colours', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto('/428');
  const primary = page.locator('[data-primary-action]');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (await primary.evaluate(el => el === document.activeElement)) break;
  }
  await expect(primary).toBeFocused();
  expect(await primary.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  const headingLink = page.locator('.summary-pro h2 a');
  expect(await headingLink.evaluate(el => getComputedStyle(el).color)).toBe(
    await page.locator('.summary-pro h2').evaluate(el => getComputedStyle(el).color),
  );
});
