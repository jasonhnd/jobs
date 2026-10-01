/** #690 — confirmed A06 consumers, including computed inheritance at three widths. */
import { test, expect, type Locator } from '@playwright/test';
import { visit } from './_visit';

type Signature = { family: 'sans' | 'serif' | 'mono'; weight?: string; px?: string; colour?: string; tabular?: boolean };
type Consumer = readonly [string, Signature];
const title: Signature = { family: 'sans', weight: '700', px: '18px', colour: '--ink' };
const caption: Signature = { family: 'sans', weight: '400', px: '12px', colour: '--ink-meta' };
const label: Signature = { family: 'sans', weight: '600', px: '14px', colour: '--ink-meta' };
const list: Signature = { family: 'sans', weight: '400' };
const crumb: Consumer = ['.crumb a', { family: 'sans', weight: '400', px: '14px', colour: '--ink-meta' }];
const cases: readonly { url: string; consumers: readonly Consumer[] }[] = [
  { url: '/models', consumers: [
    ['.vendor-card h3 a', title], ['.vendor-history-date', { family: 'sans', weight: '400', px: '14px', colour: '--ink-2' }],
    ['.vendor-history-count', caption], ['.current-model-card dt', label], ['.vendor-facts dt', label],
    ['.score-value', { family: 'mono', weight: '600', px: '12px', colour: '--ink-meta', tabular: true }],
    ['.crumb a', { family: 'sans', weight: '400', px: '14px', colour: '--ink-meta' }],
  ] },
  { url: '/models/gpt-6.1-sol@2026-10-01', consumers: [
    ['.profile-box dt', label], ['.stat dt', { ...label, px: '12px' }],
    ['.stat dd', { family: 'serif', px: '22px', colour: '--ink', tabular: true }],
  ] },
  { url: '/sectors', consumers: [crumb, ['.sc-name', title], ['.related-genre .rg-name', { family: 'sans', weight: '700', px: '16px' }]] },
  { url: '/sectors/iryo', consumers: [['.related-sectors .ja-name', list]] },
  { url: '/skills', consumers: [crumb, ['.sci-name', title]] },
  { url: '/skills/programming', consumers: [crumb, ['.related-skills .rs-name', list], ['.rxh-name', { ...list, px: '14px' }],
    ['.skill-score', { family: 'mono', weight: '600', px: '12px', colour: '--ink-meta', tabular: true }]] },
  { url: '/interests', consumers: [crumb, ['.iri-name', title]] },
  { url: '/interests/realistic', consumers: [crumb, ['.related-interests .ri-name', list]] },
  { url: '/careers', consumers: [crumb, ['.gci-name', title]] },
  { url: '/rankings', consumers: [crumb, ['.rr-title', title], ['.ranking-group-title', title], ['.mover-name', { ...list, px: '14px', colour: '--ink' }]] },
  // Shared occupation cards are already sans700/18px; do not flatten them to the inactive index-page list style.
  { url: '/rankings/ai-risk-low', consumers: [['.rank-list .rl-name', title]] },
  { url: '/compare/kango-vs-helper', consumers: [['.duel-name', { family: 'sans', weight: '700', px: '16px' }], ['.related-compares .rc-title', { ...list, px: '14px' }]] },
  { url: '/about', consumers: [crumb] },
  { url: '/privacy', consumers: [crumb] },
  { url: '/156', consumers: [crumb, ['.transfer-card .tc-name', title], ['.topn-block .topn-name', { ...list, px: '14px' }],
    ['.aio-name', { family: 'sans', weight: '600', px: '12px', colour: '--ink' }],
    ['.score-history-current-date', caption], ['.score-history-item-model span', caption], ['.score-history-item-facts dt', label]] },
];

/** Compare computed values with resolved canonical tokens, not CSS source strings. */
async function mismatches(locator: Locator, signature: Signature): Promise<string[]> {
  return locator.evaluate((el, expected) => {
    const css = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.fontFamily = `var(--font-${expected.family})`;
    probe.style.color = `var(${expected.colour ?? '--ink'})`;
    el.append(probe);
    const canonical = getComputedStyle(probe);
    const out: string[] = [];
    if (css.fontFamily !== canonical.fontFamily) out.push(`family: ${css.fontFamily}`);
    if (expected.weight && css.fontWeight !== expected.weight) out.push(`weight: ${css.fontWeight}`);
    if (expected.px && css.fontSize !== expected.px) out.push(`size: ${css.fontSize}`);
    if (expected.colour && css.color !== canonical.color) out.push(`colour: ${css.color}`);
    if (expected.tabular && !css.fontVariantNumeric.includes('tabular-nums')) out.push(`numeric: ${css.fontVariantNumeric}`);
    probe.remove();
    return out;
  }, signature);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookieConsent', 'rejected'));
});

for (const width of [1440, 768, 375]) {
  for (const { url, consumers } of cases) {
    test(`confirmed roles: ${url} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await visit(page, url, { waitUntil: 'load' });
      await page.evaluate(async () => {
        document.querySelectorAll<HTMLDetailsElement>('.vendor-history, .score-history-details').forEach((el) => el.open = true);
        await document.fonts.ready;
      });
      await page.mouse.move(0, 0);
      for (const [selector, signature] of consumers) {
        const targets = page.locator(selector);
        if (selector === '.duel-name' && width > 768) {
          await expect(targets.first()).toBeHidden(); // Only the mobile duel bar claims this role.
          continue;
        }
        expect(await targets.count(), `${url}: missing ${selector}`).toBeGreaterThan(0);
        for (const target of await targets.all()) {
          expect(await mismatches(target, signature), `${url} @${width} ${selector}`).toEqual([]);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${url} overflow`).toBeLessThanOrEqual(width);
    });
  }

  test(`home mobile-only titles retain their card hierarchy @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, '/');
    if (width > 768) return; // This surface is intentionally not rendered on desktop.
    await page.evaluate(() => document.fonts.ready);
    const name = page.locator('.m-top10-card-name').first();
    await expect(name).toBeAttached();
    expect(await mismatches(name, title)).toEqual([]);
    expect(await mismatches(page.locator('.home-door-title').first(), title)).toEqual([]);
  });
}

test('rendered roles reject inherited wrong colours and light-fill white text, and preserve real dark CTAs', async ({ page }) => {
  await visit(page, '/models');
  const heading = page.locator('.vendor-card h3 a').first();
  expect(await mismatches(heading, title)).toEqual([]);
  const inherited = await page.addStyleTag({ content: '.vendor-card h3 { color: var(--accent-deep) !important } .vendor-card h3 a { color: inherit !important }' });
  expect(await mismatches(heading, title)).toEqual([expect.stringContaining('colour:')]);
  await inherited.evaluate((el) => el.remove());
  const white = await page.addStyleTag({ content: '.vendor-card h3 a { color: var(--paper) !important }' });
  expect(await mismatches(heading, title)).toEqual([expect.stringContaining('colour:')]);
  await white.evaluate((el) => el.remove());
  expect(await mismatches(heading, title)).toEqual([]);
  await expect(page.locator('.cta-band')).toHaveCSS('background-color', 'rgb(36, 30, 24)');
  await expect(page.locator('.cta-band h2')).toHaveCSS('color', 'rgb(250, 246, 238)');
  await heading.hover();
  await expect(heading).toHaveCSS('color', 'rgb(192, 65, 30)');
  await heading.focus();
  await page.mouse.move(0, 0);
  await expect(heading).toHaveCSS('color', 'rgb(36, 30, 24)');
});
