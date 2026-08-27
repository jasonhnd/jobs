import { chromium } from 'playwright';
const targets = [
  ['live-entry-430', 'https://mirai-shigoto.com/430'],
  ['live-me', 'https://mirai-shigoto.com/me'],
  ['live-shindan', 'https://mirai-shigoto.com/shindan'],
  ['live-map', 'https://mirai-shigoto.com/map'],
  ['live-q', 'https://mirai-shigoto.com/q/ai-de-kieru'],
];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
for (const [name, url] of targets) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `mockups/shots/${name}.png` });
    console.log('ok', name);
  } catch (e) { console.log('FAIL', name, String(e).slice(0, 100)); }
}
await browser.close();
