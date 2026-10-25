import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FINDINGS, findingsPath, rightsPath, findingsUrl } from '../../src/site/findings/registry';
import { loadFindings } from '../../src/site/findings/data';
import { findingsCopy, unexpectedJapanese, controls, citationForDisplay } from '../../src/site/findings/copy';
import { FINDINGS_ATOM_PATH, renderFindingsAtom } from '../../src/site/findings/atom';

const issue = FINDINGS[0]!;
const data = loadFindings(issue);
const copy = findingsCopy(data);
const displayBibliography = 'ZKSC株式会社「AIの仕事への見方の変化 — 第1号」https://mirai-shigoto.com/pro/findings/2026-10-01-gpt-6.1-sol（最新採点 2026-10-01、参照日はコピー時に自動で入ります）。';
const routes = ['/pro/findings', findingsPath(issue), rightsPath(issue)];

for (const route of routes) {
  test(`Findings verbatim Japanese and signed canonical: ${route}`, async ({ page }) => {
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://mirai-shigoto.com${route}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    const feed = page.locator('link[rel="alternate"][type="application/atom+xml"]');
    await expect(feed).toHaveCount(1);
    await expect(feed).toHaveAttribute('href', FINDINGS_ATOM_PATH);
    await expect(feed).toHaveAttribute('title', copy.T44);
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
    expect(citationForDisplay(copy.T25)).toBe(displayBibliography);
    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toContain('{{');
    expect(visibleText).not.toMatch(/\bT\d{2}\b/);
    expect(visibleText).not.toMatch(/:\d+-L\d+/);
  });
}

test('Findings evidence uses existing headings and readable ranges with pinned anchors', async ({ page }) => {
  await page.goto(findingsPath(issue));
  const sources = page.locator('#sources .findings-evidence');
  const lines = [3, 4, 12, 9, 12, 12, '10-L11', data.reportRows[data.up[0]!.id], data.reportRows[data.down[0]!.id], data.reportRows[copy.citationRow.id]];
  const references = lines.map(line => `${issue.report.path}:${line === '10-L11' ? '10-11' : line}`);
  await expect(sources.locator('dt')).toHaveText([
    '', '', '', copy.T05, copy.T07, copy.T07,
    copy.T10, copy.T12, copy.T14, '',
  ]);
  await expect(sources.locator('dd')).toHaveText(references);
  const hrefs = await sources.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(hrefs).toEqual(lines.map(line => `https://github.com/jasonhnd/jobs/blob/${issue.snapshot_commit}/${issue.report.path}#L${line}`));
});

test('Findings structured dates, summary numbers, CSV bytes and machine exclusion', async ({ page, request }) => {
  await page.goto(findingsPath(issue));
  const nodes = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.flatMap(script => JSON.parse(script.textContent ?? '{}')['@graph'] ?? []));
  const dataset = nodes.find(node => node['@type'] === 'Dataset');
  expect(dataset).toMatchObject({ '@id': `${findingsUrl(issue)}#dataset`, name: copy.T43, dateModified: issue.modified_on, license: `https://mirai-shigoto.com${rightsPath(issue)}` });
  if (issue.first_published_on === null) expect(dataset.datePublished).toBeUndefined();
  else expect(dataset.datePublished).toBe(issue.first_published_on);
  expect(dataset.distribution).toHaveLength(4);
  const properties = Object.fromEntries(dataset.additionalProperty.map((property: { propertyID: string; value: unknown }) => [property.propertyID, property.value]));
  expect(properties).toEqual({ mean_before_display: 4.55, mean_after_display: 4.68, n_band_changed: 34, n_abs_ge_05: 12, n_abs_ge_10: 0, occupation_count: 556 });
  await expect(page.locator('[data-claim="T06"]')).toContainText(copy.T06);
  await expect(page.locator('dt').filter({ hasText: copy.labels.meta[1] }).locator('..')).toContainText(issue.modified_on);
  await expect(page.locator('#findings-bibliography')).toHaveText(citationForDisplay(copy.T25));
  // Connect only to the local mirror; exercise the existing preview Host rule.
  const preview = await request.get(findingsPath(issue), { headers: { Host: 'pre.mirai-shigoto.com' } });
  expect(preview.status()).toBe(200);
  expect(preview.headers()['x-robots-tag']).toBe('noindex, nofollow');
  for (const file of data.downloads) {
    const response = await request.get(file.href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('text/csv; charset=utf-8');
    const bytes = await response.body();
    expect(bytes.byteLength).toBe(file.bytes);
    expect(bytes.toString('utf8')).toBe(file.text);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
  }
  const htmlUrls = ['/pro/findings', findingsPath(issue), rightsPath(issue)];
  for (const file of ['sitemap.xml', 'llms.txt', 'llms-full.txt']) {
    const text = readFileSync(`dist-astro/${file}`, 'utf8');
    for (const url of htmlUrls) expect(text).toContain(url);
  }
  expect(readFileSync('dist-astro/sitemap.xml', 'utf8')).not.toContain('atom.xml');
  const atom = readFileSync(`dist-astro${FINDINGS_ATOM_PATH}`, 'utf8');
  expect(atom).toBe(renderFindingsAtom());
  if (issue.first_published_on === null) expect(atom).not.toContain('<published>');
  else expect(atom).toContain(`<published>${issue.first_published_on}</published>`);
  expect(atom).not.toContain('{{');
  const parsed = spawnSync('python3', ['-c', `
import json, sys, xml.etree.ElementTree as ET
ns = {"a": "http://www.w3.org/2005/Atom"}
root = ET.fromstring(sys.stdin.read())
def text(el, name):
    node = el.find(f"a:{name}", ns)
    return None if node is None else node.text
entry = root.find("a:entry", ns)
self_link = root.find("a:link[@rel='self']", ns)
alt = entry.find("a:link[@rel='alternate']", ns)
print(json.dumps({
  "id": text(root, "id"), "title": text(root, "title"), "updated": text(root, "updated"),
  "self": None if self_link is None else self_link.get("href"),
  "entry_id": text(entry, "id"), "entry_title": text(entry, "title"),
  "published": text(entry, "published"), "summary": text(entry, "summary"),
  "link": None if alt is None else alt.get("href"),
}))
`], { input: atom, encoding: 'utf8' });
  expect(parsed.status, parsed.stderr).toBe(0);
  expect(JSON.parse(parsed.stdout)).toEqual({
    id: 'https://mirai-shigoto.com/pro/findings',
    title: copy.T44,
    updated: '2026-10-21T00:00:00+09:00',
    self: `https://mirai-shigoto.com${FINDINGS_ATOM_PATH}`,
    entry_id: findingsUrl(issue),
    entry_title: copy.T43,
    published: issue.first_published_on,
    summary: copy.T42,
    link: findingsUrl(issue),
  });
  await page.goto('/pro/findings');
  await expect(page.locator(`a[href="${FINDINGS_ATOM_PATH}"]`)).toHaveText(copy.labels.links[6]);
  await page.goto(rightsPath(issue));
  const rights = page.locator('#content');
  await expect(rights).toContainText('ページ上の「引用する場合」の書式を使ってください。データだけを使う場合も、第1部分と第2部分の両方の出典を残してください。');
  expect(await rights.innerText()).not.toContain('（[T20–T25]）');
  await page.goto(findingsPath(issue));
  await expect(page.locator('a[href$="atom.xml"]')).toHaveCount(0);
});

test('Findings exact clipboard text uses the reader local day', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, timezoneId: 'Asia/Tokyo' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-21T15:10:00Z') });
  await page.goto(findingsPath(issue));
  const buttons = page.locator('[data-copy-target]');
  expect(await buttons.nth(0).evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await buttons.nth(0).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copy.citation);
  await expect(page.locator('[role="status"]').nth(0)).toHaveText(controls.copied);
  await buttons.nth(1).click();
  const bibliography = await page.evaluate(() => navigator.clipboard.readText());
  expect(bibliography).toBe(copy.T25.replace('{{accessed_on}}', '2026-10-22'));
  expect(bibliography).toMatch(/参照日 \d{4}-\d{2}-\d{2}/);
  expect(bibliography).not.toContain('{{');
  await expect(page.locator('#findings-bibliography')).toHaveText(citationForDisplay(copy.T25));
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
  await expect(page.locator('#findings-bibliography')).toHaveText(citationForDisplay(copy.T25));
  expect(await page.locator('body').innerText()).not.toContain('{{');
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
        const client = document.documentElement.clientWidth;
        return { body: document.body.scrollWidth, root: document.documentElement.scrollWidth, viewport: innerWidth, client, small, outside };
      });
      // Classic scrollbars shrink clientWidth below innerWidth. No horizontal overflow means scrollWidth matches that content box.
      expect(geometry.viewport).toBe(width);
      expect(geometry.body).toBe(geometry.client);
      expect(geometry.root).toBe(geometry.client);
      expect(geometry.small).toEqual([]);
      expect(geometry.outside).toEqual([]);
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
