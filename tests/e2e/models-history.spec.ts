import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildModelsFeaturePageModel, formatJapaneseDate } from '../../src/views/models';
import personalityCopy from '../../src/content/model-personality.ja.json' with { type: 'json' };
import storyCopy from '../../src/content/model-story-overrides.ja.json' with { type: 'json' };
import { findingsForRun, findingsPath, isDiscoverable } from '../../src/site/findings/registry';
import { findingsLinkTitle } from '../../src/site/findings/links';

const model = buildModelsFeaturePageModel(
  JSON.parse(readFileSync('public/data.models_deep.json', 'utf8')), personalityCopy, storyCopy,
);
// Owner-signed #966 (2026-10-25), existing site labels, and data-derived values.
const allowedJapanese = new Set([
  '採点の記録', '各回の採点日と対象職業数です。最新の回から並べています。',
  '採点日', 'モデル', '提供元', '対象職業数',
  ...model.scoringHistory.map(run => formatJapaneseDate(run.date)),
  ...model.scoringHistory.flatMap(run => findingsForRun(run.model, run.date).filter(isDiscoverable).map(findingsLinkTitle)),
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
    for (const [index, run] of model.scoringHistory.entries()) {
      const row = rows.nth(index);
      await expect(row.locator('time')).toHaveAttribute('datetime', run.date);
      await expect(row.getByRole('link', { name: run.modelDisplay, exact: true })).toHaveAttribute('href', run.href);
      await expect(row.locator('dd').nth(2)).toHaveText(run.vendorDisplay);
      await expect(row.locator('dd').nth(3)).toHaveText(String(run.covered_count));
      const issues = findingsForRun(run.model, run.date).filter(isDiscoverable);
      await expect(row.locator('.scoring-history-findings')).toHaveCount(issues.length);
      for (const issue of issues) {
        await expect(row.getByRole('link', { name: findingsLinkTitle(issue), exact: true })).toHaveAttribute('href', findingsPath(issue));
      }
    }
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
