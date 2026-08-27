import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync(new URL('./shots/', import.meta.url).pathname, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2900, height: 1100 },
  deviceScaleFactor: 2,
});
await page.goto('http://localhost:8823/mobile-redesign.html');
await page.waitForTimeout(2500); // web fonts

const units = page.locator('.unit');
const n = await units.count();
for (let i = 0; i < n; i++) {
  await units.nth(i).screenshot({ path: `mockups/shots/frame-0${i + 1}.png` });
}
await page.screenshot({ path: 'mockups/shots/board-overview.png', fullPage: false });
await browser.close();
console.log('done', n, 'frames');
