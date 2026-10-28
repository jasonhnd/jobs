import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildModelsFeaturePageModel, formatJapaneseDate } from '../../src/views/models';
import personalityCopy from '../../src/content/model-personality.ja.json' with { type: 'json' };
import storyCopy from '../../src/content/model-story-overrides.ja.json' with { type: 'json' };
import { findingsForIncomingRun, findingsPath, isDiscoverable } from '../../src/site/findings/registry';
import { findingsLinkTitle } from '../../src/site/findings/links';

const model = buildModelsFeaturePageModel(
  JSON.parse(readFileSync('public/data.models_deep.json', 'utf8')), personalityCopy, storyCopy,
);
// Owner-signed #966 (2026-10-25), existing site labels, and data-derived values.
const allowedJapanese = new Set([
  '採点の記録', '各回の採点日と対象職業数です。最新の回から並べています。',
  '採点日', 'モデル', '提供元', '対象職業数',
  ...model.scoringHistory.map(run => formatJapaneseDate(run.date)),
  ...model.scoringHistory.flatMap(run => findingsForIncomingRun(run.model, run.date).filter(isDiscoverable)
    .flatMap(issue => findingsLinkTitle(issue).split(/(変化 — 第\d+号|（.*?）)/u))),
]);

for (const width of [390, 820, 1440]) {
  test(`scoring history works without JavaScript at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto('/models');
    await expect(page).toHaveURL(/\/pro\/models$/);
    const section = page.locator('.scoring-history');
    await expect(section.getByRole('heading')).toHaveText('採点の記録');
    const rows = section.locator('li');
    await expect(rows).toHaveCount(model.scoringHistory.length);
    const head = section.locator('.scoring-history-head');
    await expect(head).toHaveAttribute('aria-hidden', 'true');
    await expect(head.locator('span')).toHaveText(['採点日', 'モデル', '提供元', '対象職業数']);
    if (width >= 600) {
      await expect(head).toBeVisible();
      const align = await section.evaluate(root => {
        const labels = [...root.querySelectorAll('.scoring-history-head span')];
        const cells = [...root.querySelectorAll('.scoring-history-row div')].slice(0, 4);
        return labels.map((label, index) => Math.abs(label.getBoundingClientRect().left - cells[index]!.getBoundingClientRect().left));
      });
      expect(Math.max(...align)).toBeLessThan(1);
    } else {
      await expect(head).toBeHidden();
    }
    for (const [index, run] of model.scoringHistory.entries()) {
      const row = rows.nth(index);
      await expect(row.locator('dt')).toHaveText(['採点日', 'モデル', '提供元', '対象職業数']);
      const labelLaidOut = await row.locator('dt').first().evaluate(element => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.position !== 'absolute' && box.width > 2 && box.height > 2;
      });
      expect(labelLaidOut).toBe(width < 600);
      await expect(row.locator('time')).toHaveAttribute('datetime', run.date);
      await expect(row.getByRole('link', { name: run.modelDisplay, exact: true })).toHaveAttribute('href', run.href);
      await expect(row.locator('dd').nth(2)).toHaveText(run.vendorDisplay);
      await expect(row.locator('dd').nth(3)).toHaveText(String(run.covered_count));
      const issues = findingsForIncomingRun(run.model, run.date).filter(isDiscoverable);
      await expect(row.locator('.scoring-history-findings')).toHaveCount(issues.length);
      for (const issue of issues) {
        await expect(row.getByRole('link', { name: findingsLinkTitle(issue), exact: true })).toHaveAttribute('href', findingsPath(issue));
      }
    }
    // A Range reports each rendered line; nowrap must preserve the full suffix and every date.
    const lineCounts = await section.locator('time, .scoring-history-nowrap').evaluateAll(elements => elements.map(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set([...range.getClientRects()].map(rect => rect.top)).size;
    }));
    expect(lineCounts.every(count => count === 1)).toBe(true);
    const nowrapTexts = await section.locator('.scoring-history-nowrap').allTextContents();
    expect(nowrapTexts.some(text => /変化 — 第\d+号/u.test(text))).toBe(true);
    const orphanIssueLines = await section.locator('.scoring-history-findings').evaluateAll(links => links.flatMap(link => {
      const range = document.createRange();
      const lines = new Map<number, string>();
      const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent ?? '';
        for (let index = 0; index < text.length; index += 1) {
          range.setStart(walker.currentNode, index);
          range.setEnd(walker.currentNode, index + 1);
          const rect = range.getClientRects()[0];
          if (rect == null) continue;
          const key = Math.round(rect.top);
          lines.set(key, (lines.get(key) ?? '') + text[index]);
        }
      }
      return [...lines.values()].map(line => line.trim()).filter(line => /^第\d+号$/u.test(line));
    }));
    expect(orphanIssueLines).toEqual([]);
    const leftEdges = await section.evaluate(root => [
      root.querySelector('h2')!, root.querySelector('.section-intro')!, root.querySelector('dl')!,
    ].map(element => element.getBoundingClientRect().left));
    expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThan(1);
    const japanese = await section.evaluate(root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const texts: string[] = [];
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent?.trim() ?? '';
        if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text)) texts.push(text);
      }
      return texts;
    });
    expect(japanese.filter(text => !allowedJapanese.has(text))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
  });
}
