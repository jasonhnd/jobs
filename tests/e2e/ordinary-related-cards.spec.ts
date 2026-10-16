import { expect, test } from '@playwright/test';

const chapterIds = ['chp-score', 'chp-about', 'chp-path', 'chp-work', 'chp-next', 'chp-faq', 'chp-source'];
const legacyIds = ['sec-aiois', 'sec-ai-detail', 'score-history-details', 'sec-transfer'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookieConsent', 'rejected'));
});

for (const width of [1440, 768, 375]) {
  for (const id of [428, 473]) {
    test(`ordinary related cards and Pro chapters /${id} at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(`/${id}`);
      expect(response?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.summary-related > a')).toHaveCount(0);
      await expect(page.locator('.summary-pro h2 a')).toHaveText('Pro で詳しく見る');
      await expect(page.locator('.summary-pro h2 a')).toHaveAttribute('href', `/pro/${id}`);
      await expect(page.locator('.summary-related, .summary-pro').getByRole('link', { name: 'Pro で詳しく見る', exact: true })).toHaveCount(1);

      for (const selector of ['.summary-related', '.summary-pro']) {
        const grid = page.locator(`${selector} .summary-card-grid`);
        const geometry = await grid.evaluate(element => {
          const css = getComputedStyle(element);
          return {
            display: css.display,
            columns: css.gridTemplateColumns.split(' ').length,
            marker: css.listStyleType,
            cards: [...element.querySelectorAll<HTMLElement>(':scope > li > a')].map(link => {
              const rect = link.getBoundingClientRect();
              return {
                left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                width: rect.width, height: rect.height,
                overflow: link.scrollWidth > link.clientWidth,
                clipped: getComputedStyle(link).overflow !== 'visible',
              };
            }),
          };
        });
        const columns = width >= 900 ? 3 : width >= 600 ? 2 : 1;
        expect(geometry.display).toBe('grid');
        expect(geometry.columns).toBe(columns);
        expect(geometry.marker).toBe('none');
        expect(geometry.cards.length).toBe(selector === '.summary-related' ? 5 : chapterIds.length);
        for (const [index, card] of geometry.cards.entries()) {
          expect(card.left).toBeGreaterThanOrEqual(0);
          expect(card.right).toBeLessThanOrEqual(width);
          expect(card.height).toBeGreaterThanOrEqual(44);
          expect(card.overflow).toBe(false);
          expect(card.clipped).toBe(false);
          if (index % columns !== 0) {
            expect(card.top).toBeCloseTo(geometry.cards[index - 1].top, 0);
            expect(card.left).toBeGreaterThan(geometry.cards[index - 1].right);
          }
          if (index >= columns) expect(card.top).toBeGreaterThan(geometry.cards[index - columns].bottom);
        }
        for (const link of await grid.locator(':scope > li > a').all()) await link.click({ trial: true });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      expect(await page.locator('.summary-pro li').evaluateAll(nodes => nodes.map(node => node.id))).toEqual(chapterIds);
      for (const chapter of chapterIds) {
        await expect(page.locator(`#${chapter} > a`)).toHaveAttribute('href', `/pro/${id}#${chapter}`);
      }
      expect(await page.locator('.summary-legacy-anchor').evaluateAll(nodes => nodes.map(node => node.id))).toEqual(legacyIds);
      for (const anchor of legacyIds) {
        const handoff = page.locator(`.summary-legacy-anchor#${anchor} a`);
        await expect(handoff).toHaveAttribute('href', `/pro/${id}#${anchor}`);
        await expect(handoff).toBeHidden();
      }
      await expect(page.locator('#sec-similar')).toHaveCount(1);

      // Compare every card with the destination's published summary: names,
      // canonical one-decimal scores, missing-score format and band words.
      const related = await page.locator('.summary-related-card').evaluateAll(links => links.map(link => ({
        href: link.getAttribute('href')!,
        name: link.querySelector('.summary-related-name')!.textContent!,
        score: link.querySelector('.summary-related-score')!.textContent!,
        band: link.querySelector('.score-band')?.textContent ?? null,
      })));
      // Related cards may reuse only the name, score and existing band wording.
      await expect(page.locator('.summary-related-card')).toHaveText(
        related.map(job => [job.name, job.score, job.band].filter(Boolean).join(' ')),
      );
      for (const job of related) {
        await page.goto(job.href);
        await expect(page.locator('h1')).toHaveText(job.name);
        await expect(page.locator('.summary-number')).toHaveText(job.score);
        if (job.band) await expect(page.locator('.summary-score .score-band')).toHaveText(job.band);
        else await expect(page.locator('.summary-score .score-band')).toHaveCount(0);
      }
    });
  }
}

test('whole related-card surfaces and Pro chapters work with keyboard and no JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 1000 } });
  const page = await context.newPage();
  await page.goto('/473');
  const related = page.locator('.summary-related-card').first();
  const href = await related.getAttribute('href');
  const name = await related.locator('.summary-related-name').textContent();
  // Click the padded bottom-right corner, outside the text and arrow.
  const box = await related.boundingBox();
  await related.click({ position: { x: box!.width - 8, y: box!.height - 8 } });
  await expect(page).toHaveURL(new URL(href!, page.url()).href);
  await expect(page.locator('h1')).toHaveText(name!);

  await page.goto('/473');
  await related.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(related).toBeFocused();
  expect(await related.evaluate(link => getComputedStyle(link).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new URL(href!, page.url()).href);

  await page.goto('/473');
  const chapter = page.locator('#chp-path > a');
  await chapter.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(chapter).toBeFocused();
  expect(await chapter.evaluate(link => getComputedStyle(link).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pro\/473#chp-path$/);
  await expect(page.locator('#chp-path')).toBeVisible();
  await context.close();
});
