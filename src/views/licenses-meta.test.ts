/**
 * licenses-meta.test.ts — pin the 15-license-hub catalog + match/rank
 * logic. Covers config integrity (slug uniqueness, required fields,
 * non-empty arrays) plus `matchLicense` + `rankLicense` behavior
 * on synthetic `DetailFileMin` inputs.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  LICENSE_HUBS,
  matchLicense,
  rankLicense,
  type LicenseHub,
} from './licenses-meta.js';

describe('LICENSE_HUBS — structural contract', () => {
  test('15 entries', () => {
    assert.equal(LICENSE_HUBS.length, 15);
  });

  test('slugs unique', () => {
    const slugs = LICENSE_HUBS.map((h) => h.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('canonical slugs present (representative spot-check)', () => {
    const slugs = LICENSE_HUBS.map((h) => h.slug);
    for (const expected of [
      'national-vs-private',
      'gyoumu-dokusen',
      'medical-licenses',
      'legal-licenses',
      'accounting-licenses',
      'it-licenses',
      'easy-licenses',
      'popular-licenses',
    ]) {
      assert.ok(slugs.includes(expected), `missing slug: ${expected}`);
    }
  });

  test('all entries: required string fields non-empty', () => {
    for (const h of LICENSE_HUBS) {
      assert.ok(h.slug.length > 0, `${h.slug}: slug empty`);
      assert.ok(h.short_ja.length > 0, `${h.slug}: short_ja empty`);
      assert.ok(h.title_ja.length > 0, `${h.slug}: title_ja empty`);
      assert.ok(h.description_ja.length > 0, `${h.slug}: description_ja empty`);
      assert.ok(h.og_eyebrow.length > 0, `${h.slug}: og_eyebrow empty`);
      assert.ok(h.difficulty_ja.length > 0, `${h.slug}: difficulty_ja empty`);
    }
  });

  test('all entries: cert_keywords + cert_examples_ja non-empty arrays', () => {
    for (const h of LICENSE_HUBS) {
      assert.ok(h.cert_keywords.length > 0, `${h.slug}: cert_keywords empty`);
      assert.ok(h.cert_examples_ja.length > 0, `${h.slug}: cert_examples_ja empty`);
    }
  });

  test('all entries: og_eyebrow starts with "LICENSE · "', () => {
    for (const h of LICENSE_HUBS) {
      assert.match(h.og_eyebrow, /^LICENSE · /);
    }
  });

  test('all entries: description_ja includes Japanese characters', () => {
    for (const h of LICENSE_HUBS) {
      assert.match(h.description_ja, /[぀-ヿ一-鿿]/);
    }
  });
});

describe('matchLicense — keyword inclusion logic', () => {
  function makeDoc(certs: string[]): { id: number; related_certs_ja: string[] } {
    return { id: 156, related_certs_ja: certs };
  }
  const hubMedical = LICENSE_HUBS.find((h) => h.slug === 'medical-licenses')!;
  const hubLegal = LICENSE_HUBS.find((h) => h.slug === 'legal-licenses')!;

  test('matches when any keyword is a substring of any cert string', () => {
    assert.equal(matchLicense(makeDoc(['医師免許']), hubMedical), true);
    assert.equal(matchLicense(makeDoc(['看護師']), hubMedical), true);
  });

  test('does not match when no keyword overlaps', () => {
    assert.equal(matchLicense(makeDoc(['宅地建物取引士']), hubMedical), false);
    assert.equal(matchLicense(makeDoc(['日商簿記 1 級']), hubLegal), false);
  });

  test('returns false when related_certs_ja is missing or empty', () => {
    assert.equal(matchLicense({ id: 1 }, hubMedical), false);
    assert.equal(matchLicense(makeDoc([]), hubMedical), false);
  });

  test('exclude_keywords filter rejects an otherwise-matching cert', () => {
    // Build a synthetic hub with exclude rules to pin the behavior.
    const hub: LicenseHub = {
      slug: 'test-hub',
      short_ja: 't',
      title_ja: 't',
      description_ja: 't',
      cert_keywords: ['弁護士'],
      exclude_keywords: ['弁護士補助'],
      og_eyebrow: 'LICENSE · t',
      cert_examples_ja: ['x'],
      difficulty_ja: 'x',
    };
    assert.equal(matchLicense(makeDoc(['弁護士補助スタッフ']), hub), false);
    assert.equal(matchLicense(makeDoc(['弁護士']), hub), true);
  });
});

describe('rankLicense — sort key', () => {
  function makeDoc(certs: string[], salary?: number): {
    id: number;
    related_certs_ja: string[];
    stats?: { salary_man_yen?: number | null };
  } {
    return { id: 156, related_certs_ja: certs, stats: salary ? { salary_man_yen: salary } : undefined };
  }
  const hubMedical = LICENSE_HUBS.find((h) => h.slug === 'medical-licenses')!;

  test('higher cert-match count → higher rank (dominates salary)', () => {
    const lowMatches = rankLicense(makeDoc(['医師免許'], 1000), hubMedical);
    const highMatches = rankLicense(makeDoc(['医師', '看護師', '薬剤師'], 100), hubMedical);
    assert.ok(highMatches > lowMatches, `expected high-match to outrank low-match: ${highMatches} vs ${lowMatches}`);
  });

  test('equal cert-match counts: higher salary → higher rank', () => {
    const lowSalary = rankLicense(makeDoc(['医師'], 400), hubMedical);
    const highSalary = rankLicense(makeDoc(['医師'], 800), hubMedical);
    assert.ok(highSalary > lowSalary);
  });

  test('missing stats: rank falls back to 0 fractional component', () => {
    const r = rankLicense(makeDoc(['医師']), hubMedical);
    // 1 match * 10000 = 10000, salary defaults to 0.
    assert.equal(r, 10000);
  });

  test('zero matches → rank is just salary', () => {
    const r = rankLicense(makeDoc(['宅地建物取引士'], 700), hubMedical);
    assert.equal(r, 700);
  });
});
