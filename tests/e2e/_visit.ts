/**
 * _visit.ts — navigate, and refuse to test a page that is not there.
 *
 * Why this exists: on 2026-09-17 an audit found that 16 of the 47 URLs in this
 * suite were 404s. The routes had lost their `/ja/` prefix and the specs were
 * never updated. Nothing caught it, because a spec that loads a 404 page and
 * then asserts "no accessibility violations" or "no leaked comment text"
 * PASSES — the 404 page has neither.
 *
 * a11y.spec.ts was scanning the 404 page for 7 of its 11 targets. It had been
 * green that whole time.
 *
 * A vacuous pass is worse than a failure: it reports safety it never checked.
 * Every navigation in this suite goes through here so that a moved route
 * breaks the build instead of quietly emptying it.
 */
import { expect, type Page, type Response } from '@playwright/test';

export async function visit(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1],
): Promise<Response> {
  const response = await page.goto(url, options);

  expect(response, `${url}: navigation returned no response`).not.toBeNull();
  expect(
    response?.status(),
    `${url} did not return 200. A spec that scans a missing page passes ` +
      'vacuously — it finds no violations because there is no page. Fix the ' +
      'URL or delete the case; do not leave it asserting nothing.',
  ).toBe(200);

  return response as Response;
}
