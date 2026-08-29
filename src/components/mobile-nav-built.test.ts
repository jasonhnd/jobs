/**
 * Built-artifact coverage for the mobile drawer's instrumentation (issue #234).
 *
 * 91% of sessions are mobile, and on mobile every drawer entry costs two taps.
 * A flat `/me` number cannot distinguish "the drawer is never opened" from "it
 * is opened and the row is ignored" — the two have opposite fixes. The pair
 * that answers it is `nav_drawer_open` (denominator, fired from the drawer's
 * own inline script) and `me_entry_click` with `source=nav_drawer` (numerator,
 * carried by data attributes and dispatched by `Footer.astro`).
 *
 * Either half can break silently: the drawer keeps opening and the row keeps
 * navigating, so nothing user-visible fails — only the measurement disappears.
 * `scripts/check-analytics-spec.ts` covers spec↔code but not markup↔listener,
 * and it reads source rather than built HTML, so it would not catch the inline
 * script being dropped from the page.
 *
 * Assertions are on the tracking contract, not on copy or layout.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { requireBuiltArtifact } from '../../scripts/lib/built-artifacts.js';

const DIST = join(process.cwd(), 'dist-astro');

/** Pages spanning the layouts the drawer must survive: hub, detail, homepage. */
const SAMPLE_PAGES = ['index.html', 'rankings.html', 'compare.html', '1.html'] as const;

function read(rel: string): string | null {
  const full = join(DIST, rel);
  const resolved = requireBuiltArtifact(existsSync(full) ? full : null, `dist-astro/${rel}`);
  return resolved === null ? null : readFileSync(resolved, 'utf-8');
}

describe('mobile drawer — built artifacts', () => {
  test('every sampled page fires nav_drawer_open when the drawer opens', () => {
    for (const rel of SAMPLE_PAGES) {
      const html = read(rel);
      if (html === null) continue;

      assert.match(
        html,
        /gtag\('event', 'nav_drawer_open'/,
        `${rel} has no nav_drawer_open call — drawer opens would go uncounted`,
      );
    }
  });

  test('the drawer /me row declares the tracking contract Footer.astro reads', () => {
    for (const rel of SAMPLE_PAGES) {
      const html = read(rel);
      if (html === null) continue;

      const row = html.match(/<a[^>]*data-entry-source="nav_drawer"[^>]*>/);
      assert.ok(row, `${rel} has no drawer /me row carrying data-entry-source="nav_drawer"`);

      const tag = row[0];
      assert.match(tag, /href="\/me"/, 'the drawer row is global chrome and pre-fills no occupation');
      assert.match(tag, /data-track-event="me_entry_click"/);
      assert.match(tag, /data-occupation-id="0"/, 'no occupation is in context in global chrome');
    }
  });

  test('every sampled page fires search overlay events', () => {
    for (const rel of SAMPLE_PAGES) {
      const html = read(rel);
      if (html === null) continue;
      assert.match(html, /gtag\('event', 'search_overlay_open'/);
      assert.match(html, /gtag\('event', 'search_overlay_navigate'/);
      assert.match(html, /id="mobSearchOverlay"/);
      assert.match(html, /id="mobSearchInput"/);
      assert.match(html, /href="\/sectors"/);
      assert.match(html, /href="\/rankings"/);
    }
  });

  test('the drawer row is chrome, not an in-content entry', () => {
    // me-entry-built.test.ts asserts exactly one /me entry inside <main> per
    // occupation page. If the drawer row ever moved inside <main> that count
    // would shift and the two suites would start contradicting each other.
    const html = read('1.html');
    if (html === null) return;

    const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
    assert.ok(
      !main.includes('data-entry-source="nav_drawer"'),
      'the drawer row must stay outside <main>',
    );
  });
});
