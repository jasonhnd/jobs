import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// One pass, one page at a time (concurrency 1, under the limit of 4).
// No production default: MOCKUP_BASE_URL must be a preview origin.
const base = requirePreviewOrigin();
const shotsDir = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(shotsDir, { recursive: true });

const targets = [
  ['live-entry-430', '/430'],
  ['live-me', '/me'],
  ['live-shindan', '/shindan'],
  ['live-map', '/map'],
  ['live-q', '/q/ai-de-kieru'],
];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
for (const [name, pathname] of targets) {
  const url = new URL(pathname, base).href;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(shotsDir, `${name}.png`) });
    console.log('ok', name);
  } catch (e) { console.log('FAIL', name, String(e).slice(0, 100)); }
}
await browser.close();

function requirePreviewOrigin() {
  const raw = process.env.MOCKUP_BASE_URL;
  if (!raw) {
    console.error(
      'MOCKUP_BASE_URL is required (https://pre.mirai-shigoto.com or a deployment alias). No production default.',
    );
    process.exit(1);
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    console.error('MOCKUP_BASE_URL must be an absolute http(s) URL');
    process.exit(1);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    console.error('MOCKUP_BASE_URL must be http(s)');
    process.exit(1);
  }
  const host = url.hostname.toLowerCase();
  if (host === 'mirai-shigoto.com' || host === 'www.mirai-shigoto.com') {
    console.error(
      'Refusing to capture the production host. Use pre.mirai-shigoto.com or a deployment alias, once, concurrency <= 4.',
    );
    process.exit(1);
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    console.error('MOCKUP_BASE_URL must be an origin, not a path');
    process.exit(1);
  }
  return url.origin + '/';
}
