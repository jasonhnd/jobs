import { test, expect } from '@playwright/test';


import { readFileSync } from 'node:fs';

const migrationRedirects = (): Array<{source:string;destination:string}> => JSON.parse(readFileSync('vercel.json','utf8')).redirects.filter((r:{statusCode?:number})=>r.statusCode===301);
const manifest = JSON.parse(readFileSync('docs/pro-split/route-manifest.json','utf8')) as {rankings:Array<{slug:string;oldPath:string;oldStatus:number}>};
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

test('sitemap HTML is 200/indexable/self-canonical and both GEO discovery files are 200', async ({ request }) => {
  const xml = readFileSync('dist-astro/sitemap.xml','utf8');
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]!);
  for (let i=0; i<locations.length; i+=4) {
    await Promise.all(locations.slice(i,i+4).map(async loc => {
      const response = await request.get(loc.slice(origin.length), { maxRedirects: 0 });
      expect(response.status(), loc).toBe(200);
      const html = await response.text();
      if (['/llms.txt','/llms-full.txt'].includes(loc.slice(origin.length))) {
        expect(html,loc).toContain('https://mirai-shigoto.com/pro/models');
        return;
      }
      expect(html,loc).toContain(`<link rel="canonical" href="${loc}">`);
      expect(html,loc).toContain(`<link rel="alternate" hreflang="ja" href="${loc}">`);
      expect(html,loc).toContain('content="index, follow"');
    }));
  }
});

test('duplicate report/index and retained ranking metadata consolidate to their final canonicals', async ({ request }) => {
  const latest = JSON.parse(readFileSync('public/data.haid-latest.json','utf8'));
  const cases = [
    ['/pro/rankings','/rankings'],
    [`/pro/aiadoption/${latest.release}`,'/pro/aiadoption'],
    ...manifest.rankings.filter(row => row.oldStatus===200).map(row => [`/pro/rankings/${row.slug}`,row.oldPath]),
  ];
  const xml = readFileSync('dist-astro/sitemap.xml','utf8');
  for (const [path,canonical] of cases) {
    const response = await request.get(path!,{maxRedirects:0});
    expect(response.status(),path).toBe(200);
    const html = await response.text();
    expect(html,path).toContain(`<link rel="canonical" href="${origin}${canonical}">`);
    const nodes = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1]!)['@graph'] ?? []);
    expect(nodes.find(n => n['@type']==='WebPage')?.url,path).toBe(origin+canonical);
    expect(xml,path).not.toContain(`<loc>${origin}${path}</loc>`);
  }
  for (const file of ['llms.txt','llms-full.txt']) expect(xml).toContain(`<loc>${origin}/${file}</loc>`);
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
