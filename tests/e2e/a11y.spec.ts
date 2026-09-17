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
 *   - /sectors — sectors index
 *   - /sectors/iryo — sector hub
 *   - /156 — occupation detail (the per-page family with 556 routes)
 *   - /rankings/ai-risk-low — ranking page
 *   - /skills — skills index
 *   - /compare — compare hub
 *   - /q/ai-de-kienai — Q&A item
 *   - /privacy — legal page
 *
 * NOTE: @axe-core/playwright is in package.json optionalDependencies
 * (NOT devDependencies). It's lockfile-pinned and reproducible, but
 * Vercel's installCommand passes --no-optional to skip it on preview
 * deploys. Local devs run `bun run test:e2e` which installs it via the
 * normal lockfile path (same pattern as @playwright/test + http-server).
 *
 * Drift policy: the gate is binary on critical+serious. A11y backlog
 * lives elsewhere (e.g. GitHub issues). This test is a no-regression
 * floor, not the place to ship moderate-tier fixes.
 */
import { test, expect } from '@playwright/test';
// eslint-disable-next-line import/no-extraneous-dependencies
import AxeBuilder from '@axe-core/playwright';
import { visit } from './_visit';

const PAGES: ReadonlyArray<{ url: string; name: string }> = [
  { url: '/',                            name: 'home' },
  { url: '/map',                         name: 'map (treemap)' },
  { url: '/sectors',                     name: 'sectors index' },
  { url: '/sectors/iryo',                name: 'sector hub (iryo)' },
  { url: '/156',                         name: 'occupation detail (looker)' },
  { url: '/rankings/ai-risk-low',        name: 'ranking item' },
  { url: '/skills',                      name: 'skills index' },
  { url: '/compare',                     name: 'compare hub index' },
  { url: '/q/ai-de-kienai',              name: 'Q&A item' },
  { url: '/privacy',                     name: 'privacy legal page' },
  { url: '/models',                      name: 'models comparison page' },
];

// Rules we intentionally skip:
//   - 'meta-viewport' — Astro sets viewport at the layout level;
//     false-positive when the viewport tag appears later in <head>.
//
// 'color-contrast' WAS in this list, disabled as "documented edge cases that
// need a design-pass; not a per-commit blocker". The design pass happened
// (#552): 46 failing foreground/background combinations went to 0, and §2.2 is
// `[確定]` as of Design v1.2. Leaving the rule off would keep the one check
// that reads rendered pixels switched off over the one contract that needs it.
const DISABLED_RULES = ['meta-viewport'];

for (const page of PAGES) {
  test(`a11y: ${page.name} — no critical/serious axe violations`, async ({ page: browser }) => {
    await visit(browser, page.url, { waitUntil: 'domcontentloaded' });

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
