import { test, expect } from '@playwright/test';
import manifest from '../../docs/pro-split/route-manifest.json';
import { migrationRedirects } from '../../scripts/pro-migration';
import { readFileSync } from 'node:fs';

const origin = 'https://mirai-shigoto.com';
test('every exact migration and language/model alias is a single 301 preserving query bytes', async ({ request }) => {
  const query = '?utm_source=local-test&gclid=a%2Bb&fbclid=c%2Fd&filter=x&filter=y&q=%E8%81%B7%E6%A5%AD';
  const rules = migrationRedirects();
  for (let i=0; i<rules.length; i+=4) {
    await Promise.all(rules.slice(i,i+4).map(async rule => {
      const response = await request.get(rule.source + query, { maxRedirects: 0 });
      expect(response.status(), rule.source).toBe(301);
      expect(response.headers().location, rule.source).toBe(rule.destination + query);
    }));
  }
  const destinations = [...new Set(rules.map(r => r.destination))];
  for (let i=0; i<destinations.length; i+=4) {
    await Promise.all(destinations.slice(i,i+4).map(async path => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200); // static error document itself is served; unknown requests carry 404
      expect(response.headers().location, path).toBeUndefined();
    }));
  }
});

test('31 old rankings redirect, eight ordinary rankings and occupation 404 remain 200; unknowns are real 404', async ({ request }) => {
  for (const row of manifest.rankings) {
    const response = await request.get(row.oldPath, { maxRedirects: 0 });
    expect(response.status(), row.slug).toBe(row.oldStatus);
  }
  for (const path of ['/rankings','/428','/occupations/404','/pro/404','/about','/privacy','/compliance']) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
  }
  for (const path of ['/rankings/unknown','/pro/rankings/unknown','/pro/999999','/pro/occupations/404','/pro/compare/unknown','/pro/skills/unknown','/compare/unknown','/ja/compare/unknown','/pro-extra/q','/pro/pro/q']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
    expect(response.headers().location, path).toBeUndefined();
  }
});

test('every sitemap HTML location responds 200 with its own indexable canonical and alternates', async ({ request }) => {
  const xml = readFileSync('dist-astro/sitemap.xml','utf8');
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]!).filter(url=>!url.endsWith('.txt'));
  for (let i=0; i<locations.length; i+=4) {
    await Promise.all(locations.slice(i,i+4).map(async loc => {
      const response = await request.get(loc.slice(origin.length), { maxRedirects: 0 });
      expect(response.status(), loc).toBe(200);
      const html = await response.text();
      expect(html,loc).toContain(`<link rel="canonical" href="${loc}">`);
      expect(html,loc).toContain(`<link rel="alternate" hreflang="ja" href="${loc}">`);
      expect(html,loc).toContain('content="index, follow"');
    }));
  }
});

test('migrated fragments and edition-return links remain usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/rankings/entry-salary?filter=x&filter=y#content');
  await expect(page).toHaveURL(/\/pro\/rankings\/entry-salary\?filter=x&filter=y#content$/);
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('.edition-nav a', {hasText:'通常版へ'})).toHaveAttribute('href','/');
  await page.goto('/pro/rankings/ai-risk-high');
  await expect(page.locator('.edition-nav a', {hasText:'通常版へ'})).toHaveAttribute('href','/rankings/ai-risk-high');
  await context.close();
});
