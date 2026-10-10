/**
 * Built-artifact coverage for the desktop top-nav /me row.
 *
 * `/me` was in the mobile drawer and missing from the sticky bar. The bar is
 * the desktop equivalent of `nav_drawer`; clicks must carry `source=top_nav`
 * so they do not mix with in-content occupation / rankings entries.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { requireBuiltArtifact } from '../../scripts/lib/built-artifacts.js';

const DIST = join(process.cwd(), 'dist-astro');
const SAMPLE_PAGES = [
  { rel: 'index.html', label: '自分の仕事を探す' },
  { rel: 'rankings.html', label: '自分の仕事を探す' },
  { rel: '1.html', label: '自分の仕事を探す' },
  { rel: 'pro.html', label: '自分の現在地' },
  { rel: 'pro/compare.html', label: '自分の現在地' },
  { rel: 'pro/1.html', label: '自分の現在地' },
] as const;

function read(rel: string): string | null {
  const full = join(DIST, rel);
  const resolved = requireBuiltArtifact(existsSync(full) ? full : null, `dist-astro/${rel}`);
  return resolved === null ? null : readFileSync(resolved, 'utf-8');
}

describe('desktop top nav — built artifacts', () => {
  test('every sampled page has a /me row in nav.top-nav with source=top_nav', () => {
    for (const { rel, label } of SAMPLE_PAGES) {
      const html = read(rel);
      if (html === null) continue;

      const nav = html.match(/<nav class="top-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
      assert.ok(nav, `${rel} has no nav.top-nav`);
      const row = nav.match(/<a[^>]*data-entry-source="top_nav"[^>]*>[\s\S]*?<\/a>/);
      assert.ok(row, `${rel} top-nav has no /me row with data-entry-source="top_nav"`);
      assert.match(row[0], /href="\/me"/);
      assert.match(row[0], /data-track-event="me_entry_click"/);
      assert.match(row[0], /data-occupation-id="0"/);
      assert.equal(row[0].replace(/<[^>]*>/g, '').trim(), label, `${rel} must use its edition's exact /me label`);
    }
  });

  test('the top-nav /me row is chrome, not an in-content entry', () => {
    const html = read('1.html');
    if (html === null) return;
    const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
    assert.ok(
      !main.includes('data-entry-source="top_nav"'),
      'the top-nav /me row must stay outside <main>',
    );
  });
});
