import { expect, test } from '@playwright/test';

const rankings = [
  'ai-risk-high',
  'ai-risk-low',
  'salary-safe',
  'workers',
  'salary',
  'short-hours',
  'high-demand',
  'hourly-wage',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookieConsent', 'rejected'));
});

for (const width of [1440, 768, 375]) {
  test(`homepage ranking and Pro lists render the hub card grid at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    const narrow = width <= 540;
    const expectedGap = narrow ? 6 : 8;

    async function readGrid(selector: string) {
      return page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element);
        const columns = style.gridTemplateColumns.split(' ').filter(Boolean).map((track) => Number.parseFloat(track));
        const cards = [...element.querySelectorAll(':scope > li > a.hub-card')].map((anchor) => {
          const rect = anchor.getBoundingClientRect();
          return {
            href: anchor.getAttribute('href'),
            text: anchor.innerText.trim(),
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        });
        return {
          display: style.display,
          listStyleType: style.listStyleType,
          listStyleImage: style.listStyleImage,
          columnGap: Number.parseFloat(style.columnGap),
          rowGap: Number.parseFloat(style.rowGap),
          clientWidth: element.clientWidth,
          columns,
          cards,
        };
      });
    }

    function expectGrid(grid: Awaited<ReturnType<typeof readGrid>>, label: string) {
      expect(grid.display, label).toBe('grid');
      expect(grid.listStyleType, label).toBe('none');
      expect(grid.listStyleImage, label).toBe('none');
      expect(grid.columnGap, label).toBe(expectedGap);
      expect(grid.rowGap, label).toBe(expectedGap);
      const expectedColumns = narrow ? 2 : Math.max(1, Math.floor((grid.clientWidth + 8) / 228));
      expect(grid.columns, label).toHaveLength(expectedColumns);
      for (const track of grid.columns) expect(track, label).toBeGreaterThan(40);
      if (!narrow) for (const track of grid.columns) expect(track, label).toBeGreaterThanOrEqual(220);
      const track = (grid.clientWidth - expectedGap * (expectedColumns - 1)) / expectedColumns;
      for (let index = 0; index < Math.min(expectedColumns, grid.cards.length); index += 1) {
        const card = grid.cards[index];
        expect(card.width, label).toBeGreaterThan(40);
        expect(card.height, label).toBeGreaterThan(20);
        expect(Math.abs(card.width - track), label).toBeLessThan(2);
        if (index > 0) {
          expect(Math.abs(card.top - grid.cards[0].top), label).toBeLessThan(2);
          expect(card.left - grid.cards[index - 1].right, label).toBeGreaterThan(expectedGap - 2);
          expect(card.left - grid.cards[index - 1].right, label).toBeLessThan(expectedGap + 2);
        }
      }
      if (grid.cards.length > expectedColumns) {
        const next = grid.cards[expectedColumns];
        expect(next.top - grid.cards[0].bottom, label).toBeGreaterThan(expectedGap - 2);
        expect(next.top - grid.cards[0].bottom, label).toBeLessThan(expectedGap + 2);
      }
    }

    const ranking = page.locator('nav.ranking-nav > ul');
    const pro = page.locator('section.hub-deep > ul');
    await ranking.scrollIntoViewIfNeeded();
    const rankingGrid = await readGrid('nav.ranking-nav > ul');
    const proGrid = await readGrid('section.hub-deep > ul');
    expectGrid(rankingGrid, 'ranking');
    expectGrid(proGrid, 'pro');
    expect(rankingGrid.cards.map((card) => card.href)).toEqual(rankings.map((slug) => `/rankings/${slug}`));
    expect(rankingGrid.cards.every((card) => card.text.length > 0)).toBe(true);
    expect(proGrid.cards.map((card) => card.href)).toEqual(['/pro/rankings']);
    expect(proGrid.cards[0].text.length).toBeGreaterThan(0);

    for (const link of await ranking.locator('a.hub-card').all()) {
      await link.scrollIntoViewIfNeeded();
      await link.click({ trial: true });
    }
    const proLink = pro.locator('a.hub-card');
    await proLink.scrollIntoViewIfNeeded();
    await proLink.click({ trial: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await ranking.locator('a.hub-card').first().click();
    await expect(page).toHaveURL(/\/rankings\/ai-risk-high$/);
    await page.goto('/');
    await pro.locator('a.hub-card').click();
    await expect(page).toHaveURL(/\/pro\/rankings$/);
  });
}
