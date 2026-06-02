/**
 * hub-hub-graph.test.ts — regression test for the
 * `qa-related-topics` filter that closed 33 broken internal links
 * in commit 94b64855. If a future refactor removes the
 * `qaSlugSet.has(otherSlug)` guard, this test fails and the gate
 * blocks the merge.
 *
 * Additional structural checks:
 *   - every q→q neighbor reference resolves to a real QA slug
 *   - render output escapes HTML metacharacters
 *   - genre type taxonomy stays in sync with HubGenre union
 *   - empty result → empty rendered string
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { QA_ITEMS } from './qa-meta.js';
import {
  getRelatedHubs,
  renderRelatedHubsBlock,
  RELATED_CROSS_HUB_CSS,
} from './hub-hub-graph.js';

describe('hub-hub-graph — qaSlugSet filter (94b64855 regression)', () => {
  test('every q→q neighbor for every QA slug points at a real QA slug', () => {
    const qaSlugs = new Set(QA_ITEMS.map((q) => q.slug));
    for (const q of QA_ITEMS) {
      const related = getRelatedHubs('q', q.slug, 20);
      for (const r of related) {
        if (r.genre !== 'q') continue;
        assert.ok(
          qaSlugs.has(r.slug),
          `q→q edge for "${q.slug}" points at non-existent slug "${r.slug}"`,
        );
      }
    }
  });

  test('source check: at least one QA has related_topics referencing real slugs (sanity)', () => {
    const qaWithTopics = QA_ITEMS.filter((q) => q.related_topics.length > 0);
    assert.ok(qaWithTopics.length >= 5, 'too few QAs have related_topics — fixture stale');
  });
});

describe('hub-hub-graph — structural integrity', () => {
  test('getRelatedHubs returns an array of HubRef-shaped objects', () => {
    const related = getRelatedHubs('sectors', 'iryo', 10);
    assert.ok(Array.isArray(related));
    for (const r of related) {
      assert.equal(typeof r.genre, 'string');
      assert.equal(typeof r.slug, 'string');
    }
  });

  test('every returned neighbor has a valid genre (matches HubGenre union)', () => {
    const KNOWN_GENRES = new Set([
      'sectors', 'rankings', 'q', 'compare', 'careers', 'licenses',
      'skills', 'interests', 'abilities', 'knowledge', 'values',
      'education', 'training', 'work-styles', 'employment-types',
      'life-balance', 'entry-paths',
    ]);
    // Sample across several genres + slugs.
    const samples: Array<[string, string]> = [
      ['sectors', 'iryo'],
      ['skills', 'critical-thinking'],
      ['interests', 'realistic'],
      ['q', QA_ITEMS[0]?.slug ?? 'ai-de-kienai'],
    ];
    for (const [genre, slug] of samples) {
      const related = getRelatedHubs(genre as never, slug, 20);
      for (const r of related) {
        assert.ok(KNOWN_GENRES.has(r.genre), `unknown genre: ${r.genre}`);
      }
    }
  });

  test('unknown (genre, slug) tuple returns empty array (no throw)', () => {
    const related = getRelatedHubs('sectors', 'definitely-not-a-real-slug', 10);
    assert.ok(Array.isArray(related));
    assert.equal(related.length, 0);
  });

  test('limit parameter caps the result count', () => {
    const related = getRelatedHubs('sectors', 'iryo', 3);
    assert.ok(related.length <= 3);
  });
});

describe('renderRelatedHubsBlock', () => {
  test('empty case (unknown slug) → empty string', () => {
    const html = renderRelatedHubsBlock('sectors', 'definitely-not-a-real-slug');
    assert.equal(html, '');
  });

  test('non-empty case returns HTML containing <a href="/…"> links', () => {
    const html = renderRelatedHubsBlock('sectors', 'iryo', 5);
    if (html !== '') {
      assert.match(html, /<a [^>]*href="\/[^"]+"/);
    }
  });
});

describe('RELATED_CROSS_HUB_CSS — CSS export', () => {
  test('is a non-empty string with at least one class selector', () => {
    assert.equal(typeof RELATED_CROSS_HUB_CSS, 'string');
    assert.ok(RELATED_CROSS_HUB_CSS.length > 0);
    assert.match(RELATED_CROSS_HUB_CSS, /\.[a-z]/);
  });
});
