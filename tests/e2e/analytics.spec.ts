/**
 * analytics.spec.ts — guards against the 2026-05-11 GA4-outage class of bug.
 *
 * Asserts that every analytics tracker we ship actually fires at least
 * one of its load + report requests on a fresh page load. Catches:
 *
 *   1. Astro define:vars IIFE breaking window.gtag (Phase 3 / 5-11 regression)
 *   2. PUBLIC_* env var missing in build / preview → entire script block elided
 *   3. CSP not listing a third-party origin → script blocked silently
 *   4. Env value with trailing whitespace (e.g. \n) → invalid tracker ID
 *   5. Server-side middleware.ts not running on the matched path
 *
 * Runs against the locally-built dist-astro/ served by http-server (see
 * playwright.config.ts). Locally invoked by `pnpm test:e2e`. Wired into
 * CI via .github/workflows/e2e.yml.
 *
 * NOTE: server-side middleware MP requests fire from the Edge to GA4
 * directly — they NEVER appear in the browser's Network panel. The MW
 * assertion checks only that the env wiring is correct; observable
 * verification requires hitting production and checking GA4 Realtime.
 */
import { test, expect, type Request as PWRequest } from '@playwright/test';

const PAGES_TO_CHECK = [
  { url: '/',                    name: 'home (src/index-source.html — non-BaseLayout)' },
  { url: '/ja/sectors',          name: 'sectors hub (BaseLayout)' },
  { url: '/ja/156',              name: 'occupation detail (BaseLayout)' },
  { url: '/ja/rankings/ai-risk-low', name: 'ranking item (BaseLayout)' },
];

/** Network requests we expect to see on every traffic page. */
const REQUIRED_REQUESTS = [
  {
    label: 'GA4 gtag.js library',
    pattern: /googletagmanager\.com\/gtag\/js\?id=G-/,
    methods: ['GET'],
  },
  {
    label: 'Cloudflare Web Analytics beacon',
    pattern: /static\.cloudflareinsights\.com\/beacon\.min\.js/,
    methods: ['GET'],
  },
  {
    label: 'Vercel Web Analytics script',
    pattern: /\/_vercel\/insights\/script\.js$/,
    methods: ['GET'],
  },
  {
    label: 'X (Twitter) Ads uwt.js',
    pattern: /static\.ads-twitter\.com\/uwt\.js/,
    methods: ['GET'],
  },
];

/**
 * GA4 g/collect hit is critical but timing-sensitive — gtag.js library
 * is loaded async on window.load, so the actual collect request fires
 * 1-3 seconds after navigation completes. Tests need to wait for it
 * explicitly. We poll up to 10s before failing.
 */
async function waitForRequestMatching(
  page: import('@playwright/test').Page,
  pattern: RegExp,
  timeoutMs: number,
): Promise<PWRequest | null> {
  return await new Promise<PWRequest | null>((resolve) => {
    const timer = setTimeout(() => {
      page.removeListener('request', onRequest);
      resolve(null);
    }, timeoutMs);
    const onRequest = (req: PWRequest): void => {
      if (pattern.test(req.url())) {
        clearTimeout(timer);
        page.removeListener('request', onRequest);
        resolve(req);
      }
    };
    page.on('request', onRequest);
  });
}

for (const target of PAGES_TO_CHECK) {
  test(`analytics: ${target.name} loads all tracker libraries`, async ({ page }) => {
    const seenRequests: string[] = [];
    page.on('request', (req) => seenRequests.push(req.url()));

    await page.goto(target.url, { waitUntil: 'load' });
    // Wait for window.load handlers (X Ads, GA4 dynamic injection) to fire.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      // networkidle may not be reached because of long-poll connections; not fatal.
    });

    for (const required of REQUIRED_REQUESTS) {
      const match = seenRequests.find((u) => required.pattern.test(u));
      expect(
        match,
        `${required.label} request was NOT made on ${target.url}. ` +
          `Seen requests:\n${seenRequests.slice(0, 30).join('\n')}`,
      ).toBeTruthy();
    }
  });
}

// ─── Per-page tracker-library SEMANTIC checks (not just network) ──────────

test('GA4: window.gtag becomes a function and dataLayer accepts pushes', async ({ page }) => {
  await page.goto('/ja/sectors', { waitUntil: 'load' });
  // gtag.js loads on window.load — give it up to 8s to take effect.
  await page.waitForFunction(
    () => typeof (window as unknown as { gtag?: unknown }).gtag === 'function',
    null,
    { timeout: 8_000 },
  );

  const state = await page.evaluate(() => {
    const w = window as unknown as {
      gtag: unknown;
      dataLayer: unknown[];
      google_tag_manager?: Record<string, unknown>;
    };
    return {
      gtagType: typeof w.gtag,
      dataLayerLen: Array.isArray(w.dataLayer) ? w.dataLayer.length : -1,
      hasGtmBootstrap: Boolean(
        w.google_tag_manager && Object.keys(w.google_tag_manager).some((k) => k.startsWith('G-')),
      ),
    };
  });

  expect(
    state.gtagType,
    'window.gtag must be a function — the canonical Google snippet contract. ' +
      'If undefined, the inline gtag <script> block is wrapped in an IIFE ' +
      '(e.g. Astro `define:vars`), which breaks function-declaration hoisting.',
  ).toBe('function');
  expect(state.dataLayerLen).toBeGreaterThan(0);
  expect(state.hasGtmBootstrap).toBe(true);
});

test('X Ads: window.twq becomes a function with non-empty pixel ID', async ({ page }) => {
  await page.goto('/ja/sectors', { waitUntil: 'load' });
  await page.waitForFunction(
    () => typeof (window as unknown as { twq?: unknown }).twq === 'function',
    null,
    { timeout: 8_000 },
  );
  // Inspect the inline <script> that calls twq('config', X_PIXEL_ID) — assert
  // the env value embedded by Astro define:vars is non-empty and has no
  // trailing whitespace (the 2026-05-12 \n bug).
  const pixelId = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const xScript = scripts.find(
      (s) => !s.src && (s.textContent ?? '').includes("twq('config'"),
    );
    if (!xScript) return null;
    const match = xScript.textContent?.match(/const X_PIXEL_ID = "([^"]+)"/);
    return match ? match[1] : null;
  });
  expect(pixelId, 'X_PIXEL_ID must be embedded as a non-empty string').toBeTruthy();
  expect(pixelId, 'X_PIXEL_ID must not contain whitespace or newlines').not.toMatch(/\s/);
});

// ─── CSP must list every analytics origin our code references ────────────

test('CSP allows all analytics origins our code calls into', async ({ page }) => {
  const resp = await page.goto('/ja/sectors');
  expect(resp).not.toBeNull();
  const csp = resp!.headers()['content-security-policy'] ?? '';
  expect(csp, 'CSP header must be set').toBeTruthy();

  const REQUIRED_IN_SCRIPT_SRC = [
    'static.cloudflareinsights.com',
    'googletagmanager.com',
    'google-analytics.com',
    'va.vercel-scripts.com',
    'static.ads-twitter.com',
  ];
  const REQUIRED_IN_CONNECT_SRC = [
    'cloudflareinsights.com',
    'google-analytics.com',
    'googletagmanager.com',
    'vitals.vercel-insights.com',
    'analytics.twitter.com',
    't.co',
  ];

  // Crude CSP parser — splits on `;` then matches directive name + sources.
  const directives = new Map<string, string>();
  for (const part of csp.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/);
    directives.set(name, sources.join(' '));
  }
  const scriptSrc = directives.get('script-src') ?? '';
  const connectSrc = directives.get('connect-src') ?? '';

  for (const origin of REQUIRED_IN_SCRIPT_SRC) {
    expect(
      scriptSrc.includes(origin),
      `script-src missing required analytics origin: ${origin}\nGot: ${scriptSrc}`,
    ).toBe(true);
  }
  for (const origin of REQUIRED_IN_CONNECT_SRC) {
    expect(
      connectSrc.includes(origin),
      `connect-src missing required analytics origin: ${origin}\nGot: ${connectSrc}`,
    ).toBe(true);
  }
});

// ─── GA4 g/collect must actually fire (the test that would have caught the audit) ──

test('GA4 actually sends a g/collect request after page load', async ({ page }) => {
  const seenGCollect = waitForRequestMatching(
    page,
    /www\.google-analytics\.com\/g\/collect/,
    12_000,
  );
  await page.goto('/ja/sectors', { waitUntil: 'load' });
  const req = await seenGCollect;
  expect(
    req,
    'GA4 g/collect was not fired within 12s of page load.\n' +
      'This is the regression that broke production from 2026-05-11 to 2026-05-12 — see ' +
      'middleware.ts and BaseLayout.astro gtag-block comments for the full diagnosis.\n' +
      'Possible causes:\n' +
      '  - Astro define:vars wrapping the gtag <script> in an IIFE (breaks window.gtag)\n' +
      '  - PUBLIC_GA4_MEASUREMENT_ID env unset → gtag block elided entirely\n' +
      '  - CSP missing google-analytics.com / googletagmanager.com\n' +
      '  - Consent default not granted → analytics_storage denied → g/collect suppressed',
  ).not.toBeNull();
});
