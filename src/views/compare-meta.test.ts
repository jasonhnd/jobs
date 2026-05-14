/**
 * compare-meta.test.ts — pin the 20 compare-pair catalog. Each
 * pair references two occupation IDs that must exist in the
 * upstream data/occupations directory; we test the structural
 * contract (slug uniqueness, occupation_id integrity, JP content).
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { COMPARE_META, getCompareMeta, type CompareSlug } from './compare-meta.js';

describe('COMPARE_META — structural contract', () => {
  test('non-empty catalog (at least 15 pairs; current canon: 20)', () => {
    assert.ok(COMPARE_META.length >= 15);
  });

  test('slugs unique + non-empty', () => {
    const slugs = COMPARE_META.map((c) => c.slug);
    for (const s of slugs) assert.ok(s.length > 0);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('occupation IDs are positive integers', () => {
    for (const c of COMPARE_META) {
      assert.ok(Number.isInteger(c.occ_a_id) && c.occ_a_id > 0, `${c.slug}: occ_a_id ${c.occ_a_id}`);
      assert.ok(Number.isInteger(c.occ_b_id) && c.occ_b_id > 0, `${c.slug}: occ_b_id ${c.occ_b_id}`);
    }
  });

  test('occ_a_id != occ_b_id (can not compare against self)', () => {
    for (const c of COMPARE_META) {
      assert.notEqual(c.occ_a_id, c.occ_b_id, `${c.slug}: self-comparison`);
    }
  });

  test('required string fields non-empty', () => {
    for (const c of COMPARE_META) {
      assert.ok(c.title_ja.length > 0, `${c.slug}: title_ja empty`);
      assert.ok(c.description_ja.length > 0, `${c.slug}: description_ja empty`);
      assert.ok(c.og_eyebrow.length > 0, `${c.slug}: og_eyebrow empty`);
    }
  });

  test('comparison_points_ja + decision_hints_ja are non-empty arrays', () => {
    for (const c of COMPARE_META) {
      assert.ok(c.comparison_points_ja.length >= 3, `${c.slug}: comparison_points`);
      assert.ok(c.decision_hints_ja.length >= 3, `${c.slug}: decision_hints`);
    }
  });

  test('title_ja contains "vs" or " と " (canonical compare format)', () => {
    // Pin the title convention so a future refactor doesn't change
    // the OG-card / breadcrumb format silently.
    for (const c of COMPARE_META) {
      const ok = c.title_ja.includes('vs') || c.title_ja.includes(' と ');
      assert.ok(ok, `${c.slug}: "${c.title_ja}" missing "vs" or " と "`);
    }
  });
});

describe('getCompareMeta — lookup', () => {
  test('returns the entry for each known slug', () => {
    for (const c of COMPARE_META) {
      const looked = getCompareMeta(c.slug);
      assert.equal(looked.slug, c.slug);
    }
  });

  test('throws on unknown slug', () => {
    assert.throws(
      () => getCompareMeta('not-a-real-pair' as CompareSlug),
      /Unknown compare slug/,
    );
  });
});
