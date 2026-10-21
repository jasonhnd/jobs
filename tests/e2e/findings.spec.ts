import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { FINDINGS, findingsPath, rightsPath, findingsUrl } from '../../src/site/findings/registry';
import { loadFindings } from '../../src/site/findings/data';
import { findingsCopy, unexpectedJapanese, controls } from '../../src/site/findings/copy';

const issue = FINDINGS[0]!;
const data = loadFindings(issue);
const copy = findingsCopy(data);
const routes = ['/pro/findings', findingsPath(issue), rightsPath(issue)];

for (const route of routes) {
  test(`Findings verbatim Japanese and draft canonical: ${route}`, async ({ page }) => {
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://mirai-shigoto.com${route}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    const texts = await page.locator('[data-findings-copy]').evaluate(root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const texts: string[] = [];
      while (walker.nextNode()) texts.push(walker.currentNode.textContent ?? '');
      root.querySelectorAll('*').forEach(node => {
        for (const name of ['aria-label', 'title', 'alt', 'data-copy-success']) {
          const value = node.getAttribute(name); if (value) texts.push(value);
        }
      });
      return texts;
    });
    expect(unexpectedJapanese(texts, data, route.endsWith('/rights'))).toEqual([]);
  });
}

test('Findings structured dates, summary numbers, CSV bytes and machine exclusion', async ({ page, request }) => {
  await page.goto(findingsPath(issue));
  const nodes = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.flatMap(script => JSON.parse(script.textContent ?? '{}')['@graph'] ?? []));
  const dataset = nodes.find(node => node['@type'] === 'Dataset');
  expect(dataset).toMatchObject({ '@id': `${findingsUrl(issue)}#dataset`, name: copy.T43, dateModified: issue.modified_on, license: `https://mirai-shigoto.com${rightsPath(issue)}` });
  expect(dataset.datePublished).toBeUndefined();
  expect(dataset.distribution).toHaveLength(4);
  const properties = Object.fromEntries(dataset.additionalProperty.map((property: { propertyID: string; value: unknown }) => [property.propertyID, property.value]));
  expect(properties).toEqual({ mean_before_display: 4.55, mean_after_display: 4.68, n_band_changed: 34, n_abs_ge_05: 12, n_abs_ge_10: 0, occupation_count: 556 });
  await expect(page.locator('[data-claim="T06"]')).toContainText(copy.T06);
  await expect(page.locator('dt').filter({ hasText: copy.labels.meta[1] }).locator('..')).toContainText(issue.modified_on);
  await expect(page.locator('#findings-bibliography')).toHaveText(copy.T25);
  for (const file of data.downloads) {
    const response = await request.get(file.href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('text/csv; charset=utf-8');
    const bytes = await response.body();
    expect(bytes.byteLength).toBe(file.bytes);
    expect(bytes.toString('utf8')).toBe(file.text);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
  }
  for (const file of ['sitemap.xml', 'llms.txt', 'llms-full.txt']) {
    expect(readFileSync(`dist-astro/${file}`, 'utf8')).not.toContain('/pro/findings');
  }
  expect(existsSync('dist-astro/pro/findings/atom.xml')).toBe(false);
  await expect(page.locator('a[href$="atom.xml"],link[type="application/atom+xml"]')).toHaveCount(0);
});

test('Findings exact clipboard text uses the reader local day', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, timezoneId: 'Asia/Tokyo' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-21T15:10:00Z') });
  await page.goto(findingsPath(issue));
  const buttons = page.locator('[data-copy-target]');
  await buttons.nth(0).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copy.citation);
  await expect(page.locator('[role="status"]').nth(0)).toHaveText(controls.copied);
  await buttons.nth(1).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copy.T25.replace('{{accessed_on}}', '2026-10-22'));
  await expect(page.locator('#findings-bibliography')).toHaveText(copy.T25);
  await context.close();
});

test('Findings complete content and downloads survive disabled JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(findingsPath(issue));
  await expect(page.locator('[data-claim]')).toHaveCount(5);
  for (const text of [copy.T06, copy.T08, copy.T09, copy.T11, copy.upSentence, copy.downSentence]) {
    await expect(page.locator('.findings-claims')).toContainText(text);
  }
  await expect(page.locator('[data-chart-occupation]')).toHaveCount(4);
  await expect(page.locator('[data-findings-table="chart"] .findings-cards > li')).toHaveCount(4);
  await expect(page.locator('[data-findings-table="changes"] .findings-cards > li')).toHaveCount(45);
  await expect(page.locator('#findings-citation')).toHaveText(copy.citation);
  await expect(page.locator('a[download]')).toHaveCount(4);
  await expect(page.locator('#sources')).toBeVisible();
  await expect(page.locator('[data-copy-target]').nth(0)).toBeHidden();
  await context.close();
});

for (const width of [375, 768, 1440]) {
  for (const route of routes) {
    test(`Findings ${width}px no overflow / 12px floor: ${route}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop-chrome', 'Each exact width is exercised once.');
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const small: string[] = [], outside: string[] = [];
        const visible = (element: Element) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
        };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode, parent = node.parentElement;
          if (!parent || !node.textContent?.trim() || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(parent.tagName) || !visible(parent)) continue;
          const range = document.createRange(); range.selectNode(node);
          if (!range.getBoundingClientRect().width) continue;
          if (parseFloat(getComputedStyle(parent).fontSize) < 12) small.push(`${parent.tagName}:${node.textContent}`);
        }
        document.querySelectorAll('main *').forEach(element => {
          if (!visible(element)) return;
          const box = element.getBoundingClientRect();
          if (box.left < -1 || box.right > innerWidth + 1) outside.push(`${element.tagName}.${element.className}`);
        });
        return { body: document.body.scrollWidth, root: document.documentElement.scrollWidth, viewport: innerWidth, small, outside };
      });
      expect(geometry).toEqual({ body: width, root: width, viewport: width, small: [], outside: [] });
      if (route === findingsPath(issue)) {
        const table = page.locator('[data-findings-table="changes"]');
        if (width < 600) { await expect(table.locator('.findings-cards')).toBeVisible(); await expect(table.locator('table')).toBeHidden(); }
        else { await expect(table.locator('table')).toBeVisible(); await expect(table.locator('.findings-cards')).toBeHidden(); }
      }
    });
  }
}

test('Findings Pro entry points reach issue 1; unrelated model runs do not link it', async ({ page }) => {
  for (const route of ['/pro/data', '/pro/models', '/pro/models/gpt-6.1-sol@2026-10-01', '/pro/models/gpt-6-sol@2026-09-23']) {
    await page.goto(route);
    const link = page.locator(`a[href="${findingsPath(issue)}"]`).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('h1')).toHaveText(copy.T01);
  }
  await page.goto('/pro');
  await page.locator('a[href="/pro/findings"]').click();
  await expect(page.locator('h1')).toHaveText(copy.T44);
  await page.goto('/pro/models/grok-4.7@2026-09-22');
  await expect(page.locator(`a[href="${findingsPath(issue)}"]`)).toHaveCount(0);
});
