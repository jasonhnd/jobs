import { chromium } from 'playwright';

const targets = [
  ['live-home', 'https://mirai-shigoto.com/'],
  ['live-ranking', 'https://mirai-shigoto.com/rankings/ai-risk-high'],
  ['live-entry', 'https://mirai-shigoto.com/156'],
  ['live-compare', 'https://mirai-shigoto.com/compare/kango-vs-helper'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ja-JP',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
for (const [name, url] of targets) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3500); // fonts + client-side data (TOP10 etc.)
    await page.screenshot({ path: `mockups/shots/${name}.png` });
    console.log('ok', name);
  } catch (e) {
    console.log('FAIL', name, String(e).slice(0, 120));
  }
}
await browser.close();
