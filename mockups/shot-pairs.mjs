import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const shotsDir = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1100 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:8823/before-after.html');
await page.waitForTimeout(1200);
const pairs = page.locator('.pair');
const n = await pairs.count();
for (let i = 0; i < n; i++) await pairs.nth(i).screenshot({ path: join(shotsDir, `pair-${i + 1}.png`) });
await browser.close();
console.log('pairs', n);
