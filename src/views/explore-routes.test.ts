/**
 * explore-routes.test.ts — pin the 7 Level-2 entry-route catalog.
 * Each route aggregates multiple genre indexes; tests verify
 * structural integrity + that referenced genre paths look like
 * production routes (start with /).
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { EXPLORE_ROUTES, type ExploreRoute } from './explore-routes.js';

describe('EXPLORE_ROUTES — structural contract', () => {
  test('non-empty catalog (current canon: 7 routes)', () => {
    assert.ok(EXPLORE_ROUTES.length >= 5);
  });

  test('slugs unique + non-empty', () => {
    const slugs = EXPLORE_ROUTES.map((r) => r.slug);
    for (const s of slugs) assert.ok(s.length > 0);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('canonical slug spot-check', () => {
    const slugs = EXPLORE_ROUTES.map((r) => r.slug);
    for (const s of [
      'by-industry',
      'by-ranking',
      'find-your-fit',
      'by-skill-and-license',
      'by-work-style',
      'compare',
      'methodology-trust',
    ]) {
      assert.ok(slugs.includes(s), `missing slug: ${s}`);
    }
  });

  test('all required string fields non-empty', () => {
    for (const r of EXPLORE_ROUTES) {
      assert.ok(r.short_ja.length > 0, `${r.slug}: short_ja`);
      assert.ok(r.title_ja.length > 0, `${r.slug}: title_ja`);
      assert.ok(r.description_ja.length > 0, `${r.slug}: description_ja`);
      assert.ok(r.intro_ja.length > 0, `${r.slug}: intro_ja`);
      assert.ok(r.og_eyebrow.length > 0, `${r.slug}: og_eyebrow`);
    }
  });

  test('genres array non-empty for each route', () => {
    for (const r of EXPLORE_ROUTES) {
      assert.ok(r.genres.length >= 1, `${r.slug}: empty genres`);
    }
  });

  test('each referenced genre path is a non-empty short identifier (e.g. "sectors", "abilities")', () => {
    // Genre paths are normally bare slugs (no leading slash); the
    // explore-route template prepends the / prefix at render time.
    // A leading-slash path is an absolute root link (e.g. "/methodology",
    // "/about") used as-is — for the consolidated reference docs that
    // live at the site root rather than under /.
    for (const r of EXPLORE_ROUTES) {
      for (const g of r.genres) {
        assert.ok(g.path.length > 0, `${r.slug}: empty path`);
        assert.match(g.path, /^\/?[a-z][a-z0-9/-]*$/, `${r.slug}: bad path "${g.path}"`);
        assert.ok(g.label.length > 0, `${r.slug}: empty label`);
        assert.ok(g.desc.length > 0, `${r.slug}: empty desc`);
      }
    }
  });

  test('descriptions contain Japanese characters (not English placeholder)', () => {
    for (const r of EXPLORE_ROUTES) {
      assert.match(r.description_ja, /[぀-ヿ一-鿿]/, `${r.slug}: no JP chars`);
    }
  });

  test('ExploreRoute type accepted at runtime for every entry', () => {
    for (const r of EXPLORE_ROUTES) {
      const _: ExploreRoute = r;
      void _;
    }
    assert.ok(true);
  });
});
