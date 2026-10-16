import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface SeoMetadata {
  url: string; title: string; description: string; keywords: string;
  canonical: string; robots: string; h1Texts: string[];
}
interface SocialMetadata {
  url: string; og: Record<string, string>; twitter: Record<string, string>;
}

function baseline<T extends { url: string }>(file: string): Map<string, T> {
  const rows = readFileSync(new URL(`../baseline/${file}`, import.meta.url), 'utf8')
    .trim().split('\n').map(line => JSON.parse(line) as T);
  return new Map(rows.map(row => [row.url, row]));
}
const seoBaseline = baseline<SeoMetadata>('seo-metadata.jsonl');
const socialBaseline = baseline<SocialMetadata>('og-meta.jsonl');

async function checkBaselineMetadata(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  const seo = seoBaseline.get(path)!;
  const social = socialBaseline.get(path)!;
  await expect(page).toHaveTitle(seo.title);
  for (const name of ['description', 'keywords', 'robots'] as const) {
    await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute('content', seo[name]);
  }
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', seo.canonical);
  await expect(page.locator('h1')).toHaveText(seo.h1Texts);
  for (const [name, value] of Object.entries(social.og)) {
    await expect(page.locator(`meta[property="${name}"]`)).toHaveAttribute('content', value);
  }
  for (const [name, value] of Object.entries(social.twitter)) {
    await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute('content', value);
  }
}

// The reviewed baseline update changes ordinary metadata only; Pro/control rows stay byte-identical.
for (const id of [307, 391, 518, 182, 127, 203, 94, 224, 404]) {
  test(`occupation ${id} renders signed ordinary metadata and unchanged Pro metadata`, async ({ page }) => {
    const path = id === 404 ? '/occupations/404' : `/${id}`;
    expect((await page.goto(path))?.status()).toBe(200);
    const name = seoBaseline.get(path)!.h1Texts[0];
    const title = `${name}の年収・労働時間・AIの影響｜未来の仕事`;
    const description = `${name}の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。`;
    await expect(page).toHaveTitle(title);
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      await expect(page.locator(selector)).toHaveAttribute('content', title);
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      await expect(page.locator(selector)).toHaveAttribute('content', description);
    }
    // The on-page conclusion and its schema remain the pre-existing summary, not the new meta copy.
    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .flatMap(text => { const root = JSON.parse(text); return root['@graph'] ?? [root]; });
    const webpage = nodes.find(node => node['@type'] === 'WebPage');
    await expect(page.locator('.summary-conclusion')).toHaveText(webpage.description);
    expect(webpage.description).not.toBe(description);
    await checkBaselineMetadata(page, `/pro/${id}`);
  });
}

test('all 12 missing-data occupations retain their legacy metadata', async ({ page }) => {
  for (const id of [140, 141, 142, 144, 145, 148, 152, 153, 154, 250, 512, 514]) {
    await checkBaselineMetadata(page, `/${id}`);
    await expect(page.locator('.summary-stats dd')).toHaveText(['—', '—']);
  }
});

test('homepage and all ordinary ranking metadata stay unchanged', async ({ page }) => {
  const paths = [...seoBaseline.keys()].filter(path => path === '/' || /^\/rankings(?:\/|$)/.test(path));
  expect(paths).toHaveLength(10); // Home, ranking index and eight ranking details.
  for (const path of paths) await checkBaselineMetadata(page, path);
});
