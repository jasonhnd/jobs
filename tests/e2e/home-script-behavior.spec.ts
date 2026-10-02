import { expect, test } from '@playwright/test';

for (const width of [1440, 768, 375]) {
  test(`home script preserves search, map/TOP 10 and sharing at ${width}px`, async ({ page }, testInfo) => {
    test.skip((width > 768) !== (testInfo.project.name === 'desktop-chrome'), 'use the corresponding desktop/mobile device');
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('cookieConsent', 'accepted');
      const state = window as typeof window & { __homeShares: string[]; __homeCopies: string[] };
      state.__homeShares = [];
      state.__homeCopies = [];
      window.open = (url) => { state.__homeShares.push(String(url)); return null; };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (url: string) => { state.__homeCopies.push(url); },
      } });
    });
    const scriptResponse = page.waitForResponse(response => /\/_astro\/_index-inline\.[a-f0-9]{64}\.js$/.test(response.url()));
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBe(true);
    expect((await scriptResponse).ok()).toBe(true);

    if (width > 768) {
      const canvas = page.locator('#treemap');
      await canvas.scrollIntoViewIfNeeded();
      await expect(page.locator('#loadingState')).toHaveCount(0, { timeout: 15_000 });
      await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
        const pixel = element.getContext('2d')!.getImageData(8, 8, 1, 1).data;
        return pixel[3];
      })).toBe(255);
      await canvas.focus();
      await canvas.press('ArrowRight');
      await expect(page.locator('#tooltip')).toHaveClass(/visible/);
      await expect(page.locator('#tooltip .tt-title')).not.toBeEmpty();
      await expect(page.locator('#ttRow')).not.toBeEmpty();
      await expect(page.locator('#tooltipCta')).toHaveAttribute('href', /^\/(?:occupations\/)?\d+$/);
      await canvas.press('Escape');
      await expect(page.locator('#tooltip')).not.toHaveClass(/visible/);
    } else {
      const cards = page.locator('#mTop10Track .m-top10-card');
      await expect(cards).toHaveCount(10, { timeout: 15_000 });
      const destination = await cards.first().getAttribute('href');
      expect(destination).toMatch(/^\/(?:occupations\/)?\d+$/);
      await cards.first().click();
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect(cards).toHaveCount(10);
    }

    const footer = page.locator('footer.site-footer');
    await footer.locator('.share-btn[data-platform="x"]').click();
    const shares = await page.evaluate(() => (window as typeof window & { __homeShares: string[] }).__homeShares);
    expect(shares).toHaveLength(1); // Footer and home wiring must not double-fire.
    const share = new URL(shares[0]);
    expect(share.origin + share.pathname).toBe('https://x.com/intent/post');
    const sharedPage = new URL(share.searchParams.get('url')!);
    expect(sharedPage.pathname).toBe('/');
    expect(sharedPage.searchParams.get('utm_source')).toBe('x');
    expect(share.searchParams.get('text')).toBeTruthy();
    await footer.locator('.share-btn[data-platform="copy"]').click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __homeCopies: string[] }).__homeCopies.length)).toBe(1);
    const copied = await page.evaluate(() => (window as typeof window & { __homeCopies: string[] }).__homeCopies[0]);
    expect(new URL(copied).searchParams.get('utm_medium')).toBe('copylink');
    await expect(footer.locator('.share-toast')).toHaveClass(/visible/);

    const input = page.locator(width > 768 ? '#searchInputDesktop' : '#searchInputMobile');
    const suggestions = page.locator(width > 768 ? '#searchSuggest' : '#searchSuggestMobile');
    await input.fill('看護師');
    const first = suggestions.locator('.ss-item').first();
    await expect(first).toBeVisible();
    await expect(first).toContainText('看護師');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const id = await first.getAttribute('data-job-id');
    await input.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/(?:occupations/)?${id}$`));
    expect(errors).toEqual([]);
  });
}
