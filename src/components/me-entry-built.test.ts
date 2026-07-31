/**
 * Built-artifact coverage for the in-content `/me` entry (issue #234).
 *
 * The entry exists to move traffic from the surfaces that have it — occupation,
 * rankings, compare and sectors pages — into `/me`, and its effect is measured
 * through `me_entry_click`. Two things can silently break that:
 *
 *   1. Coverage regressing. Before this change only 4 of 834 built pages carried
 *      an in-content `/me` link. A template refactor could quietly return to
 *      that state and nothing else in the suite would notice.
 *   2. The tracking contract drifting. `Footer.astro` reads the event name and
 *      params from data attributes; if a rename drops one, clicks keep working
 *      and the event silently stops carrying `source` or `occupation_id`.
 *      `scripts/check-analytics-spec.ts` covers spec↔code, not markup↔listener.
 *
 * Assertions are on counts and shapes rather than exact copy, so wording can be
 * revised without touching this file.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { requireBuiltArtifact } from '../../scripts/lib/built-artifacts.js';

const DIST = join(process.cwd(), 'dist-astro');

/**
 * `/me` links only — `/methodology` shares the prefix and must not match.
 *
 * Built fresh per call rather than shared: a `/g` regex carries `lastIndex`
 * between calls, so a module-level constant reused with `.test()` in a loop
 * alternates true/false on identical input.
 */
const meHref = (): RegExp => /href="\/me(?=["?/])/g;

function mainOf(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/);
  return main ? main[0] : '';
}

function read(rel: string): string | null {
  const full = join(DIST, rel);
  const resolved = requireBuiltArtifact(existsSync(full) ? full : null, `dist-astro/${rel}`);
  return resolved === null ? null : readFileSync(resolved, 'utf-8');
}

/** Occupation pages are `/<id>.html` at the root; `404.html` is the not-found doc. */
function occupationPages(): string[] {
  if (!existsSync(DIST)) return [];
  const root = readdirSync(DIST)
    .filter((f) => /^\d{1,3}\.html$/.test(f) && f !== '404.html')
    .map((f) => join(DIST, f));
  // Occupation id 404 renders under /occupations/ so it does not collide with
  // the custom not-found document at the root.
  const reserved = join(DIST, 'occupations', '404.html');
  if (existsSync(reserved)) root.push(reserved);
  return root;
}

describe('me entry — built artifacts', () => {
  test('every occupation page carries exactly one in-content /me entry', () => {
    const pages = occupationPages();
    if (requireBuiltArtifact(pages.length > 0 ? DIST : null, 'dist-astro/<id>.html') === null) {
      return;
    }

    const wrong: string[] = [];
    for (const page of pages) {
      const count = (mainOf(readFileSync(page, 'utf-8')).match(meHref()) ?? []).length;
      if (count !== 1) wrong.push(`${page} → ${count}`);
    }

    assert.deepEqual(wrong, [], `occupation pages without exactly one /me entry:\n${wrong.join('\n')}`);
    assert.ok(pages.length >= 500, `expected the full occupation set, saw ${pages.length}`);
  });

  test('the occupation entry pre-fills that occupation and declares its source', () => {
    const html = read('1.html');
    if (html === null) return;

    const entry = mainOf(html).match(/<a[^>]*data-track-event="me_entry_click"[^>]*>/);
    assert.ok(entry, 'no tracked /me entry found on /1');

    const tag = entry[0];
    assert.match(tag, /href="\/me\?id=1"/, 'entry must pre-fill the occupation being viewed');
    assert.match(tag, /data-entry-source="occupation"/);
    assert.match(tag, /data-occupation-id="1"/);
  });

  test('list surfaces send source but no occupation, since none is in context', () => {
    for (const [rel, source] of [
      ['rankings.html', 'rankings'],
      ['compare.html', 'compare'],
      ['sectors.html', 'sectors'],
    ] as const) {
      const html = read(rel);
      if (html === null) continue;

      const entry = mainOf(html).match(/<a[^>]*data-track-event="me_entry_click"[^>]*>/);
      assert.ok(entry, `no tracked /me entry on /${rel}`);
      assert.match(entry[0], new RegExp(`data-entry-source="${source}"`));
      assert.match(entry[0], /data-occupation-id="0"/, 'list surfaces report occupation_id 0');
      assert.match(entry[0], /href="\/me"/, 'list surfaces must not pre-fill an occupation');
    }
  });

  test('coverage stays far above the 4 pages that had an entry before #234', () => {
    if (!existsSync(DIST)) return;

    const walk = (dir: string, out: string[] = []): string[] => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
      }
      return out;
    };

    const all = walk(DIST);
    if (requireBuiltArtifact(all.length > 0 ? DIST : null, 'dist-astro/**/*.html') === null) return;

    const withEntry = all.filter((f) => meHref().test(mainOf(readFileSync(f, 'utf-8')))).length;
    // Occupation (556) + rankings detail (39) + compare detail (20) + hubs.
    assert.ok(
      withEntry >= 600,
      `only ${withEntry} of ${all.length} pages carry an in-content /me entry; ` +
        `expected 600+ after #234 (it was 4 before)`,
    );
  });
});
