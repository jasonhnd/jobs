import { expect, test } from '@playwright/test';

for (const width of [1440, 768, 375]) {
  test(`404 helpful links keep readable titles and fit their column at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('cookieConsent', 'rejected'));
    const response = await page.goto('/__404-helpful-links-layout__');
    expect(response?.status()).toBe(404);
    await page.evaluate(() => document.fonts.ready);

    const container = page.locator('.helpful-links');
    const links = container.locator('a');
    await expect(links).toHaveCount(9);

    for (const link of await links.all()) {
      const title = link.locator('span').first();
      const description = link.locator('.desc');
      await expect(title).toBeVisible();
      if (width === 375) await expect(description).toBeHidden();
      else await expect(description).toBeVisible();

      for (const hovered of [false, true]) {
        if (hovered) {
          await link.hover();
          // Check the settled padding as well as the default layout.
          await link.evaluate(async (element) => {
            await Promise.all(element.getAnimations().map((animation) => animation.finished));
          });
        }
        const geometry = await link.evaluate((element) => {
          const title = element.querySelector('span')!;
          const description = element.querySelector('.desc')!;
          const bounds = element.getBoundingClientRect();
          const titleBounds = title.getBoundingClientRect();
          const descBounds = description.getBoundingClientRect();
          return {
            titleWidth: titleBounds.width,
            titleLeft: titleBounds.left,
            titleRight: titleBounds.right,
            titleBottom: titleBounds.bottom,
            descriptionTop: descBounds.top,
            descriptionLeft: descBounds.left,
            descriptionRight: descBounds.right,
            left: bounds.left,
            right: bounds.right,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        });
        const label = `${await link.getAttribute('href')} at ${width}, hover=${hovered}`;
        expect(geometry.titleWidth, label).toBeGreaterThanOrEqual(120);
        expect(geometry.scrollWidth, label).toBeLessThanOrEqual(geometry.clientWidth);
        expect(geometry.titleLeft, label).toBeGreaterThanOrEqual(geometry.left);
        expect(geometry.titleRight, label).toBeLessThanOrEqual(geometry.right);
        if (width !== 375) {
          expect(geometry.descriptionTop, label).toBeGreaterThanOrEqual(geometry.titleBottom);
          expect(geometry.descriptionLeft, label).toBeGreaterThanOrEqual(geometry.left);
          expect(geometry.descriptionRight, label).toBeLessThanOrEqual(geometry.right);
        }
      }
      await page.mouse.move(0, 0);
    }

    const overflow = await container.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    expect(overflow.bodyWidth).toBe(overflow.viewportWidth);
    expect(overflow.viewportWidth).toBe(width);
  });
}
