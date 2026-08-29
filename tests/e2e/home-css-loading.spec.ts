import { devices, expect, test } from '@playwright/test';

const HOME_CSS_URL = /\/_astro\/_index\.[A-Za-z0-9_-]+\.css(?:\?.*)?$/;

test('home full CSS does not block first paint and activates without material CLS', async ({ page }, testInfo) => {
  let releaseCss: (() => void) | undefined;
  const cssGate = new Promise<void>((resolve) => {
    releaseCss = resolve;
  });
  let cssRequests = 0;

  await page.route(HOME_CSS_URL, async (route) => {
    cssRequests += 1;
    await cssGate;
    await route.continue();
  });
  await page.addInitScript(() => {
    const state = window as typeof window & { __homeCls?: number };
    state.__homeCls = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) state.__homeCls = (state.__homeCls ?? 0) + (shift.value ?? 0);
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Chromium supports layout-shift; keep the metric at zero on older engines.
    }
  });

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  expect(cssRequests).toBe(1);

  const fullCss = page.locator('#home-full-stylesheet');
  await expect(fullCss).toHaveAttribute('rel', 'preload');
  await page.waitForFunction(
    () => performance.getEntriesByName('first-contentful-paint').length > 0,
    undefined,
    { timeout: 3_000 },
  );

  const isMobile = testInfo.project.name === 'mobile-chrome';
  const criticalState = await page.evaluate((mobile) => {
    const hero = document.querySelector<HTMLElement>(mobile ? '.mobile-hero' : '.desktop-hero');
    const kpi = document.querySelector<HTMLElement>('.home-kpi-band');
    const top10 = document.querySelector<HTMLElement>('.m-top10');
    const top10Track = document.querySelector<HTMLElement>('.m-top10-track');
    const preview = document.querySelector<HTMLElement>('.m-map-preview');
    const movers = document.querySelector<HTMLElement>('.home-movers');
    const doors = document.querySelector<HTMLElement>('.home-doors');
    if (!hero || !kpi || !top10 || !top10Track || !preview || !movers || !doors) {
      throw new Error('critical homepage element missing');
    }
    return {
      heroDisplay: getComputedStyle(hero).display,
      heroHeight: hero.getBoundingClientRect().height,
      kpiBorderRadius: getComputedStyle(kpi).borderRadius,
      top10Display: getComputedStyle(top10).display,
      top10Height: top10.getBoundingClientRect().height,
      top10TrackDisplay: getComputedStyle(top10Track).display,
      previewDisplay: getComputedStyle(preview).display,
      previewHeight: preview.getBoundingClientRect().height,
      moversDisplay: getComputedStyle(movers).display,
      doorsDisplay: getComputedStyle(doors).display,
    };
  }, isMobile);

  expect(criticalState.heroDisplay).toBe('block');
  expect(criticalState.heroHeight).toBeGreaterThan(0);
  expect(criticalState.kpiBorderRadius).toBe('12px');
  if (isMobile) {
    expect(criticalState.top10Display).toBe('block');
    expect(criticalState.top10TrackDisplay).toBe('flex');
    expect(criticalState.top10Height).toBeLessThan(800);
    expect(criticalState.previewDisplay).toBe('flex');
    expect(criticalState.previewHeight).toBeGreaterThan(0);
    expect(criticalState.moversDisplay).toBe('block');
    expect(criticalState.doorsDisplay).toBe('grid');
  }

  releaseCss?.();
  await expect(fullCss).toHaveAttribute('rel', 'stylesheet');
  await page.waitForTimeout(250);

  const cls = await page.evaluate(
    () => (window as typeof window & { __homeCls?: number }).__homeCls ?? 0,
  );
  expect(cls).toBeLessThan(0.1);
  expect(cssRequests).toBe(1);
});

test('home remains fully styled and usable when JavaScript is disabled', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'one fixed mobile no-JS pass is sufficient');

  const context = await browser.newContext({
    ...devices['Pixel 5'],
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  let cssResponses = 0;
  page.on('response', (response) => {
    if (HOME_CSS_URL.test(response.url())) cssResponses += 1;
  });

  const response = await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBe(true);

  const fallback = page.locator('noscript link[rel="stylesheet"][href*="/_astro/_index."]');
  await expect(fallback).toHaveCount(1);
  await expect(page.locator('.mobile-hero')).toBeVisible();
  await expect(page.locator('.m-map-preview')).toBeVisible();
  expect(await page.locator('.m-top10-track').evaluate((node) => getComputedStyle(node).display)).toBe('flex');
  await expect(page.locator('footer.site-footer')).toBeAttached();
  expect(cssResponses).toBe(1);

  await context.close();
});
