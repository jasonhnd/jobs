import { expect, test } from '@playwright/test';
import { visit } from './_visit';

for (const width of [375, 768, 1440]) {
  test(`monthly mover names are fully visible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/');
    await page.evaluate(() => document.fonts.ready);
    const movers = page.locator('.home-movers');
    if (width > 768) {
      await expect(movers).toBeHidden();
      return;
    }
    await expect(movers).toBeVisible();
    const rows = await movers.locator('li').evaluateAll((items) => items.map((item) => {
      const name = item.querySelector('a')!;
      const score = item.querySelector('span')!;
      const box = name.getBoundingClientRect();
      const scoreBox = score.getBoundingClientRect();
      const rowBox = item.getBoundingClientRect();
      const style = getComputedStyle(name);
      // Character ranges reveal overflow even when an ellipsis hides the text.
      const characters = [...name.firstChild!.textContent!].map((_, index) => {
        const range = document.createRange();
        range.setStart(name.firstChild!, index);
        range.setEnd(name.firstChild!, index + 1);
        const rect = range.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      return {
        name: name.textContent, href: name.getAttribute('href'), score: score.textContent,
        lines: new Set(characters.map((rect) => Math.round(rect.top))).size,
        allCharactersVisible: characters.every((rect) => rect.left >= box.left - 1 &&
          rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1),
        topDifference: Math.abs(box.top - scoreBox.top),
        gap: scoreBox.left - box.right,
        rightDifference: Math.abs(rowBox.right - scoreBox.right),
        overflow: style.overflow, textOverflow: style.textOverflow,
        clamp: style.webkitLineClamp,
      };
    }));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.allCharactersVisible, row.name!).toBe(true);
      expect(row.lines, row.name!).toBeGreaterThanOrEqual(1);
      expect(row.lines, row.name!).toBeLessThanOrEqual(2);
      expect(row.topDifference, row.name!).toBeLessThan(1);
      expect(row.gap, row.name!).toBeGreaterThanOrEqual(0);
      expect(row.rightDifference, row.name!).toBeLessThan(1);
      expect(row.href).toMatch(/^\/\d+$/);
      expect(row.score).toMatch(/^[+−-]\d+\.\d+$/);
    }
    for (const row of rows) {
      expect(row.overflow).toBe('visible');
      expect(row.textOverflow).not.toBe('ellipsis');
      expect(row.clamp).toBe('none');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
