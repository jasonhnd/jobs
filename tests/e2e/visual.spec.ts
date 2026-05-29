/**
 * visual.spec.ts — structural visual-regression at 4 breakpoints.
 *
 * Why not pixel screenshots? Cross-platform pixel comparison (Linux CI vs
 * macOS local) is flaky on font rendering, GPU compositing, and async font
 * loading. SEO baseline already pins the rendered HTML byte-for-byte
 * (tests/baseline/), so the marginal class of bug NOT caught by that is
 * "HTML same, but CSS regressed → layout broke visually". This spec catches
 * THAT class deterministically by asserting structural layout invariants
 * the user actually depends on:
 *
 *   1. No horizontal overflow at any breakpoint (a #1 mobile UX smell).
 *   2. First `<h1>` renders with non-zero dimensions (no display:none /
 *      zero-height collapse on the page-identity heading).
 *   3. Top-nav (mobile or desktop variant) stays visible at the top of the
 *      viewport.
 *   4. Footer renders with non-zero dimensions (no truncated mid-render).
 *   5. `/map` only: `#mapContent` container has non-zero dimensions
 *      (catches d3-mount / SSR-skeleton regressions).
 *
 * These invariants are stable across CI / local because they read computed
 * geometry, not pixels. Setting a wrong padding or breaking a flex layout
 * trips them within the same run; font rendering differences don't.
 *
 * Pixel-perfect screenshot regression is intentionally deferred until the
 * team has reason to commit binary PNG baselines + a tolerance policy. See
 * docs/architecture.md §6.3.
 *
 * Breakpoints covered (per web/testing.md):
 *   - mobile-320     320 × 720   — narrow Android (Galaxy S5 era)
 *   - tablet-768     768 × 1024  — iPad portrait
 *   - laptop-1024    1024 × 768  — small laptop
 *   - desktop-1440   1440 × 900  — common dev monitor
 *
 * Pages covered: home (/), map (/map), occupation detail (/ja/156).
 * Three pages × four breakpoints = 12 assertions; cheap enough to run on
 * every PR.
 */
import { test, expect } from '@playwright/test';

interface Breakpoint {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

const BREAKPOINTS: ReadonlyArray<Breakpoint> = [
  { name: 'mobile-320',   width: 320,  height: 720  },
  { name: 'tablet-768',   width: 768,  height: 1024 },
  { name: 'laptop-1024',  width: 1024, height: 768  },
  { name: 'desktop-1440', width: 1440, height: 900  },
];

interface PageUnderTest {
  readonly url: string;
  readonly name: string;
}

// Hero selector is the page's first `<h1>`. Every page in scope has one
// near the top of its content (home: `h1.dh-title` inside dashboard
// section; /map: `<h1>職業マップ</h1>` inside `header.map-head`; /ja/156:
// `<h1>` inside `<header id="content">`). Using `.first()` keeps the
// selector indifferent to which exact wrapper the layout team picks.
const HERO_SELECTOR = 'h1';

const PAGES: ReadonlyArray<PageUnderTest> = [
  { url: '/',         name: 'home'       },
  { url: '/map',      name: 'map'        },
  { url: '/ja/156',   name: 'occupation' },
];

// 1px tolerance for sub-pixel rounding of viewport widths.
const OVERFLOW_TOLERANCE_PX = 1;

for (const bp of BREAKPOINTS) {
  for (const page of PAGES) {
    test(`visual: ${page.name} @ ${bp.name} — layout invariants hold`, async ({ page: browser }) => {
      await browser.setViewportSize({ width: bp.width, height: bp.height });
      const resp = await browser.goto(page.url, { waitUntil: 'domcontentloaded' });
      expect(resp?.ok(), `${page.url} should respond 200`).toBe(true);

      // ── Invariant 1: no horizontal overflow ────────────────────────────
      // Body scroll-width should not exceed viewport width. Common
      // regressions: oversized image without max-width, table that escapes
      // its column, hard-coded `min-width: 1200px` somewhere.
      const overflow = await browser.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `${page.name} @ ${bp.name}: horizontal overflow — scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + OVERFLOW_TOLERANCE_PX);

      // ── Invariant 2: hero region has non-zero dimensions ───────────────
      // Catches "display:none accidentally set" / "flex child collapsed to 0"
      // bugs. Filter to visible: responsive layouts keep multiple h1s in the
      // DOM (home's desktop dashboard h1.dh-title is display:none at <=768px),
      // so we assert the viewport's actual visible hero heading paints.
      const hero = browser.locator(HERO_SELECTOR).filter({ visible: true }).first();
      await expect(hero, `${page.name} @ ${bp.name}: hero selector must resolve`).toBeVisible();
      const heroBox = await hero.boundingBox();
      expect(heroBox, `${page.name} @ ${bp.name}: hero must have a bounding box`).not.toBeNull();
      // Type-narrowed by the assertion above.
      const { width: hw, height: hh } = heroBox as { width: number; height: number };
      expect(hw, `${page.name} @ ${bp.name}: hero width must be > 0`).toBeGreaterThan(0);
      expect(hh, `${page.name} @ ${bp.name}: hero height must be > 0`).toBeGreaterThan(0);

      // ── Invariant 3: top-nav present and pinned near the top ───────────
      // Either the mobile topbar or the desktop top-nav (one or the other,
      // depending on responsive switch) must be visible. The CSS-driven
      // switch happens at ~768px in src/lib/canonical-css.ts.
      const nav = browser.locator('header.mob-topbar, nav.top-nav').filter({ visible: true }).first();
      await expect(nav, `${page.name} @ ${bp.name}: top-nav must be visible`).toBeVisible();
      const navBox = await nav.boundingBox();
      expect(navBox, `${page.name} @ ${bp.name}: nav must have a bounding box`).not.toBeNull();
      const navTop = (navBox as { y: number }).y;
      // 60px upper bound: covers fixed nav with top offset or any wrapper padding.
      expect(
        navTop,
        `${page.name} @ ${bp.name}: top-nav y=${navTop} should be near the top of the viewport`,
      ).toBeLessThanOrEqual(60);

      // ── Invariant 4: footer renders below the fold ─────────────────────
      // No assertion on absolute position — pages have variable length. The
      // mere fact that the footer exists + has a bounding box means the
      // page didn't crash mid-render or get truncated.
      const footer = browser.locator('footer.site-footer');
      await expect(footer, `${page.name} @ ${bp.name}: footer must be present`).toBeAttached();
      const footerBox = await footer.boundingBox();
      expect(footerBox, `${page.name} @ ${bp.name}: footer must have a bounding box`).not.toBeNull();
      expect(
        (footerBox as { height: number }).height,
        `${page.name} @ ${bp.name}: footer height must be > 0`,
      ).toBeGreaterThan(0);

      // ── Invariant 5 (map only): #mapContent container has non-zero size ─
      // The map listing is the entire reason /map exists; a zero-size
      // container means the d3 mount or the SSR skeleton failed and users
      // see a blank page. The container holds the SSR skeleton even
      // before the d3 enhancement kicks in, so its dimensions are
      // deterministic at DOMContentLoaded.
      if (page.url === '/map') {
        const mapContent = browser.locator('#mapContent');
        await expect(mapContent, `map @ ${bp.name}: #mapContent must be visible`).toBeVisible();
        const mcBox = await mapContent.boundingBox();
        expect(mcBox, `map @ ${bp.name}: #mapContent must have a bounding box`).not.toBeNull();
        expect((mcBox as { width: number }).width, `map @ ${bp.name}: #mapContent width > 0`).toBeGreaterThan(0);
        expect((mcBox as { height: number }).height, `map @ ${bp.name}: #mapContent height > 0`).toBeGreaterThan(0);
      }
    });
  }
}
