import { expect, test } from '@playwright/test';

const OCCUPATION_404_PATH = '/occupations/404';
const OCCUPATION_404_CANONICAL = `https://mirai-shigoto.com${OCCUPATION_404_PATH}`;

test('occupation 404 owns an indexable detail route', async ({ page }) => {
  const response = await page.goto(OCCUPATION_404_PATH);
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('内科医');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', OCCUPATION_404_CANONICAL);
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/i);
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.join('\n')).toMatch(/"@type"\s*:\s*"Occupation"/);
  expect(jsonLd.join('\n')).toContain(`${OCCUPATION_404_CANONICAL}#occupation`);
});

for (const legacyPath of ['/ja/404', '/ja/404.html', '/occ/404', '/occ/404-naikaii']) {
  test(`${legacyPath} redirects to the occupation 404 canonical`, async ({ page }) => {
    const response = await page.goto(legacyPath);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(OCCUPATION_404_PATH);
    await expect(page.locator('h1')).toContainText('内科医');
  });
}

test('an unknown URL returns the custom noindex document with HTTP 404', async ({ page }) => {
  const response = await page.goto('/definitely-not-an-occupation-157');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('ページが見つかりません');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
});
