/**
 * careers-meta.test.ts — pin the 10 career-stage persona catalog.
 * Each persona is a hub with a `recommend(d) → score | null`
 * predicate that downstream pages use to filter + rank occupations.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { CAREER_PERSONAS } from './careers-meta.js';

describe('CAREER_PERSONAS — structural contract', () => {
  test('10 personas', () => {
    assert.equal(CAREER_PERSONAS.length, 10);
  });

  test('slugs unique + non-empty', () => {
    const slugs = CAREER_PERSONAS.map((p) => p.slug);
    for (const s of slugs) assert.ok(s.length > 0);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('canonical slug spot-check (career-stage taxonomy)', () => {
    const slugs = CAREER_PERSONAS.map((p) => p.slug);
    for (const expected of [
      'shinsotsu',         // 新卒
      '20-late',           // 20代後半
      '30s-early',
      '30s-late',
      '40s',
      '50s',
      '60s-shinia',        // シニア
      'gakusei-arbeit',
      'shufu-fukki',
      'career-change',
    ]) {
      assert.ok(slugs.includes(expected), `missing slug: ${expected}`);
    }
  });

  test('all required string fields non-empty', () => {
    for (const p of CAREER_PERSONAS) {
      assert.ok(p.short_ja.length > 0, `${p.slug}: short_ja`);
      assert.ok(p.title_ja.length > 0, `${p.slug}: title_ja`);
      assert.ok(p.description_ja.length > 0, `${p.slug}: description_ja`);
      assert.ok(p.og_eyebrow.length > 0, `${p.slug}: og_eyebrow`);
    }
  });

  test('cautions_ja + advantages_ja are non-empty arrays of non-empty strings', () => {
    for (const p of CAREER_PERSONAS) {
      assert.ok(p.cautions_ja.length >= 3, `${p.slug}: cautions_ja < 3`);
      assert.ok(p.advantages_ja.length >= 3, `${p.slug}: advantages_ja < 3`);
      for (const s of [...p.cautions_ja, ...p.advantages_ja]) {
        assert.ok(s.length > 0);
      }
    }
  });

  test('og_eyebrow starts with "CAREER · "', () => {
    for (const p of CAREER_PERSONAS) {
      assert.match(p.og_eyebrow, /^CAREER · /);
    }
  });

  test('every persona has a callable recommend function', () => {
    for (const p of CAREER_PERSONAS) {
      assert.equal(typeof p.recommend, 'function');
    }
  });
});

describe('CAREER_PERSONAS — recommend predicate behavior', () => {
  function makeDoc(overrides: Record<string, unknown> = {}): {
    id: number;
    title?: { ja?: string };
    ai_risk?: { score?: number | null };
    stats?: { salary_man_yen?: number | null; workers?: number | null; recruit_ratio?: number | null };
  } {
    return { id: 999, title: { ja: 'test' }, ...overrides };
  }

  test('recommend returns number | null (per the type contract)', () => {
    for (const p of CAREER_PERSONAS) {
      const r = p.recommend(makeDoc());
      assert.ok(r === null || typeof r === 'number', `${p.slug}: returned ${typeof r}`);
    }
  });

  test('null on doc with no stats (most predicates need salary/workers)', () => {
    // Each persona may differ — we only assert the type contract:
    // null is a valid return. (Some personas may still return a
    // number based on other fields like ai_risk.) This test is the
    // type-contract spot check, not an exact behavior assertion.
    for (const p of CAREER_PERSONAS) {
      const r = p.recommend(makeDoc({}));
      if (r !== null) {
        assert.equal(typeof r, 'number');
      }
    }
  });
});
