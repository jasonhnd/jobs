import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const shotsDir = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(shotsDir, { recursive: true });
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
  await units.nth(i).screenshot({ path: join(shotsDir, `frame-0${i + 1}.png`) });
}
await page.screenshot({ path: join(shotsDir, 'board-overview.png'), fullPage: false });
await browser.close();
console.log('done', n, 'frames');
