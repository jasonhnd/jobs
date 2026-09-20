/**
 * design-contract.spec.ts — the parts of Design.md only a browser can check.
 *
 * Every other design gate reads SOURCE. That is why a green board kept hiding
 * real breakage:
 *
 *   check-type-scale  reads the declared font-size
 *                     -> cannot see 0.8em inherited into a --t-xs parent,
 *                        which is how a bare <small> renders at 9.6px
 *   check-contrast    reads the declared role x background table
 *                     -> cannot see the colour that actually reached a pixel,
 *                        which is how 46 combinations survived (#552)
 *
 * Both blind spots have the same cause: the contract is about what renders,
 * and source is not what renders. This file is the one place that measures the
 * rendered result, so it is the backstop for §4.2's floor.
 *
 * §4.2 is explicit that the floor has no exception: "サイト全体の最小値は
 * 12px。11px 以下は使わない。例外は設けない。"
 */
import { test, expect } from '@playwright/test';
import { visit } from './_visit';

/** One page per family, so a regression in any surface lands here. */
const PAGES: readonly string[] = [
  '/',
  '/156',
  '/map',
  '/rankings',
  '/rankings/ai-risk-low',
  '/compare',
  '/skills',
  '/interests',
  '/sectors',
  '/sectors/iryo',
  '/haid',
  '/standard',
  '/aiadoption',
  '/models',
  '/privacy',
  '/shindan',
];

/** §9.2 — the two ends of the breakpoint range. */
const VIEWPORTS = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'sp', width: 390, height: 844 },
] as const;

const FLOOR_PX = 12;

interface TooSmall {
  readonly where: string;
  readonly px: number;
  readonly text: string;
}

for (const viewport of VIEWPORTS) {
  for (const url of PAGES) {
    test(`§4.2 12px floor: ${url} @${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await visit(page, url, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // The map and the adoption charts draw after fonts settle.
      await page.waitForTimeout(1200);

      const offenders: TooSmall[] = await page.evaluate((floor) => {
        const out: TooSmall[] = [];
        const seen = new Set<string>();
        for (const el of Array.from(document.querySelectorAll('*'))) {
          // Only elements that own visible text of their own.
          const ownText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? '')
            .join('')
            .trim();
          if (ownText === '') continue;

          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') continue;
          const box = el.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0) continue;

          const px = Number.parseFloat(style.fontSize);
          if (!Number.isFinite(px) || px >= floor) continue;

          const where = `${el.tagName.toLowerCase()}.${String(
            (el as HTMLElement).className ?? '',
          ).slice(0, 40)}`;
          const key = `${where}|${px}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ where, px, text: ownText.slice(0, 30) });
        }
        return out;
      }, FLOOR_PX);

      expect(
        offenders,
        `${url} @${viewport.name} renders text below the ${FLOOR_PX}px floor (§4.2, no exception):\n` +
          offenders.map((o) => `  ${o.px}px  ${o.where}  "${o.text}"`).join('\n'),
      ).toEqual([]);
    });
  }
}

/**
 * §6 chrome — the top-nav wrapper is not a page header.
 *
 * BaseLayout wraps MobileNav + TopNav in a bare <header> (the banner landmark).
 * From 2026-06-03 the Hub / Sector / Static classes styled `header` — meant for
 * the page's own hero — and so drew a second rule and 24px of padding under the
 * top nav on every page of those classes; the design-1.x migration then spread
 * it to /me, /shindan, /gyakuten, /privacy, /compliance, /404 and /answers.
 * Only a rendered check sees it: the source gates read declarations, not
 * which element they land on.
 */
for (const url of PAGES) {
  test(`chrome header carries no page-header styling: ${url}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit(page, url, { waitUntil: 'load' });
    const wrapper = await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('body > header')).find((e) => e.querySelector('nav.top-nav'));
      if (!h) return null;
      const s = getComputedStyle(h);
      return {
        borderBottom: s.borderBottomWidth,
        paddingBottom: s.paddingBottom,
        height: Math.round(h.getBoundingClientRect().height),
      };
    });
    expect(wrapper, `${url}: no <body> > <header> wrapping nav.top-nav`).not.toBeNull();
    expect(wrapper?.borderBottom, `${url}: the chrome wrapper has a border — a page-class header rule leaked onto it`).toBe('0px');
    expect(wrapper?.paddingBottom, `${url}: the chrome wrapper has bottom padding`).toBe('0px');
    // margin is layout spacing (the home page sets 24px under the nav on purpose); the
    // defect is the rule and the padded gap above it, so those two are what is pinned.
  });
}

/**
 * §9.1 — the nav brand and the page's first line share a left edge.
 *
 * Every wrapper pads the column by --s-5 and the nav pads by the same amount
 * past the column edge, so at ≥ content-max + 2×gutter the brand and the
 * first text in <main> start at the same x. Until 2026-09-20 they were
 * 20–70px apart depending on the page class.
 */
for (const url of PAGES) {
  test(`§9.1 left edge: nav brand and first line align: ${url}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit(page, url, { waitUntil: 'load' });
    const edges = await page.evaluate(() => {
      const brand = document.querySelector('nav.top-nav a');
      const main = document.querySelector('main');
      if (!brand || !main) return null;
      let first: Element | null = null;
      for (const el of Array.from(main.querySelectorAll('*'))) {
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim() ?? '').join('');
        if (!own) continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
        first = el; break;
      }
      if (!first) return null;
      // Measure the glyphs, not the box: a link may pad its hit area (/map's
      // 「← トップ」 has 4px) and pull the box back with a negative margin.
      const textNode = Array.from(first.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      const range = document.createRange();
      range.selectNodeContents(textNode ?? first);
      const glyphs = range.getBoundingClientRect();
      return { brand: Math.round(brand.getBoundingClientRect().left), first: Math.round(glyphs.left), what: `${first.tagName.toLowerCase()}.${String((first as HTMLElement).className).split(' ')[0]}` };
    });
    expect(edges, `${url}: no nav brand or no text in <main>`).not.toBeNull();
    expect(Math.abs((edges?.brand ?? 0) - (edges?.first ?? 0)), `${url}: nav brand at x=${edges?.brand}, first line (${edges?.what}) at x=${edges?.first} — the column gutter is not --s-5 on this page (§9.1)`).toBeLessThanOrEqual(1);
  });
}
