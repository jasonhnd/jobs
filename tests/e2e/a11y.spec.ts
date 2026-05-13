/**
 * a11y.spec.ts — axe-core accessibility scan on representative pages.
 *
 * Runs the axe-core ruleset against each page family. Fails the test
 * if any `critical` or `serious` violation is found. `moderate` and
 * `minor` are logged but don't fail (they can drift over time without
 * needing per-commit fixes — track via the printed output).
 *
 * Covers one URL per page family that emits HTML at build time:
 *   - homepage (/) — biggest hand-curated content surface
 *   - /map — interactive treemap (a11y-sensitive)
 *   - /ja/sectors — sectors index
 *   - /ja/sectors/iryo — sector hub
 *   - /ja/156 — occupation detail (the per-page family with 556 routes)
 *   - /ja/rankings/ai-risk-low — ranking page
 *   - /ja/skills — skills index
 *   - /ja/compare — compare hub
 *   - /ja/q/ai-de-kienai — Q&A item
 *   - /privacy — legal page
 *
 * NOTE: @axe-core/playwright is NOT in package.json devDeps. It's
 * installed on-demand by scripts/run-e2e.sh (same pattern as
 * @playwright/test + http-server). Local devs run `pnpm test:e2e`.
 *
 * Drift policy: the gate is binary on critical+serious. A11y backlog
 * lives elsewhere (e.g. GitHub issues). This test is a no-regression
 * floor, not the place to ship moderate-tier fixes.
 */
import { test, expect } from '@playwright/test';
// eslint-disable-next-line import/no-extraneous-dependencies
import AxeBuilder from '@axe-core/playwright';

const PAGES: ReadonlyArray<{ url: string; name: string }> = [
  { url: '/',                            name: 'home' },
  { url: '/map',                         name: 'map (treemap)' },
  { url: '/ja/sectors',                  name: 'sectors index' },
  { url: '/ja/sectors/iryo',             name: 'sector hub (iryo)' },
  { url: '/ja/156',                      name: 'occupation detail (looker)' },
  { url: '/ja/rankings/ai-risk-low',     name: 'ranking item' },
  { url: '/ja/skills',                   name: 'skills index' },
  { url: '/ja/compare',                  name: 'compare hub index' },
  { url: '/ja/q/ai-de-kienai',           name: 'Q&A item' },
  { url: '/privacy',                     name: 'privacy legal page' },
];

// Rules we intentionally skip:
//   - 'color-contrast' — our warm-cream palette has documented edge
//     cases that need a design-pass to resolve (see Design.md §3.2);
//     not a per-commit blocker.
//   - 'meta-viewport' — Astro sets viewport at the layout level;
//     false-positive when the viewport tag appears later in <head>.
const DISABLED_RULES = ['color-contrast', 'meta-viewport'];

for (const page of PAGES) {
  test(`a11y: ${page.name} — no critical/serious axe violations`, async ({ page: browser }) => {
    await browser.goto(page.url, { waitUntil: 'domcontentloaded' });

    const results = await new AxeBuilder({ page: browser })
      .disableRules(DISABLED_RULES)
      // WCAG 2.1 AA is the floor; the site claims AA compliance in /privacy.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    // Log every violation for transparency (moderate/minor don't fail).
    if (results.violations.length > 0) {
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        help: v.helpUrl,
      }));
      // eslint-disable-next-line no-console
      console.log(`[a11y:${page.name}] violations:`, JSON.stringify(summary, null, 2));
    }

    expect(
      blocking,
      `${page.name} has ${blocking.length} critical/serious a11y violation(s): ${blocking
        .map((b) => `${b.id} (${b.impact}, ${b.nodes.length} node(s))`)
        .join('; ')}`,
    ).toEqual([]);
  });
}
