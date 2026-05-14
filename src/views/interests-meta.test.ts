/**
 * interests-meta.test.ts — pin the RIASEC interest catalog contract.
 *
 * Covers:
 *   - All 6 RIASEC types present (R/I/A/S/E/C)
 *   - Slugs unique + match InterestType union
 *   - Letters unique + match canonical R/I/A/S/E/C
 *   - Required string fields non-empty
 *   - characteristics_ja / typical_fields_ja are non-empty arrays of strings
 *   - getInterestMeta lookup works + throws on unknown slug
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  INTEREST_META,
  getInterestMeta,
  type InterestType,
} from './interests-meta.js';

describe('INTEREST_META — structural contract', () => {
  test('exactly 6 entries (RIASEC types)', () => {
    assert.equal(INTEREST_META.length, 6);
  });

  test('all 6 RIASEC slugs present, no duplicates', () => {
    const slugs = INTEREST_META.map((m) => m.slug);
    const expected: ReadonlyArray<InterestType> = [
      'realistic',
      'investigative',
      'artistic',
      'social',
      'enterprising',
      'conventional',
    ];
    for (const e of expected) {
      assert.ok(slugs.includes(e), `missing slug: ${e}`);
    }
    assert.equal(new Set(slugs).size, INTEREST_META.length, 'duplicate slugs');
  });

  test('all 6 RIASEC letters present, no duplicates', () => {
    const letters = INTEREST_META.map((m) => m.letter);
    const expected = ['R', 'I', 'A', 'S', 'E', 'C'];
    for (const e of expected) {
      assert.ok(letters.includes(e as 'R' | 'I' | 'A' | 'S' | 'E' | 'C'), `missing letter: ${e}`);
    }
    assert.equal(new Set(letters).size, letters.length, 'duplicate letters');
  });

  test('slug → letter mapping is the canonical RIASEC pairing', () => {
    const mapping = new Map<string, string>();
    for (const m of INTEREST_META) mapping.set(m.slug, m.letter);
    assert.equal(mapping.get('realistic'), 'R');
    assert.equal(mapping.get('investigative'), 'I');
    assert.equal(mapping.get('artistic'), 'A');
    assert.equal(mapping.get('social'), 'S');
    assert.equal(mapping.get('enterprising'), 'E');
    assert.equal(mapping.get('conventional'), 'C');
  });
});

describe('INTEREST_META — per-entry field contract', () => {
  for (const m of INTEREST_META) {
    test(`${m.slug}: required string fields are non-empty`, () => {
      assert.ok(m.name_ja.length > 0, 'name_ja empty');
      assert.ok(m.title_ja.length > 0, 'title_ja empty');
      assert.ok(m.description_ja.length > 0, 'description_ja empty');
      assert.ok(m.og_eyebrow.length > 0, 'og_eyebrow empty');
    });

    test(`${m.slug}: characteristics_ja is a non-empty array of non-empty strings`, () => {
      assert.ok(Array.isArray(m.characteristics_ja));
      assert.ok(m.characteristics_ja.length >= 3, 'expected ≥ 3 characteristics');
      for (const c of m.characteristics_ja) {
        assert.equal(typeof c, 'string');
        assert.ok(c.length > 0, 'empty characteristic');
      }
    });

    test(`${m.slug}: typical_fields_ja is a non-empty array`, () => {
      assert.ok(Array.isArray(m.typical_fields_ja));
      assert.ok(m.typical_fields_ja.length >= 3, 'expected ≥ 3 fields');
    });

    test(`${m.slug}: og_eyebrow starts with "INTEREST · "`, () => {
      assert.match(m.og_eyebrow, /^INTEREST · /);
    });

    test(`${m.slug}: description_ja includes Japanese characters (not English placeholder)`, () => {
      assert.match(m.description_ja, /[぀-ヿ一-鿿]/);
    });
  }
});

describe('getInterestMeta — slug lookup', () => {
  test('returns the matching meta for each known slug', () => {
    for (const m of INTEREST_META) {
      const looked = getInterestMeta(m.slug);
      assert.equal(looked.slug, m.slug);
      assert.equal(looked.letter, m.letter);
    }
  });

  test('throws on unknown slug with a helpful message listing the known slugs', () => {
    assert.throws(
      () => getInterestMeta('not-a-real-slug'),
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        assert.match(msg, /Unknown interest slug: not-a-real-slug/);
        assert.match(msg, /Known: /);
        return true;
      },
    );
  });

  test('throws on empty string', () => {
    assert.throws(() => getInterestMeta(''));
  });
});
