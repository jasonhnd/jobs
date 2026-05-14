/**
 * skills-meta.test.ts — pin the 10-skill hub catalog. SKILL_META
 * couples user-facing slugs (e.g. 'critical-thinking') to IPD skill
 * keys (e.g. 'skills.critical_thinking'); test that the mapping is
 * bijective and well-formed.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { SKILL_META, getSkillMeta, type SkillSlug } from './skills-meta.js';

describe('SKILL_META — structural contract', () => {
  test('10 entries (10 hub skills)', () => {
    assert.equal(SKILL_META.length, 10);
  });

  test('slugs unique', () => {
    const slugs = SKILL_META.map((m) => m.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('ipd_keys unique (each hub maps to a distinct IPD dimension)', () => {
    const keys = SKILL_META.map((m) => m.ipd_key);
    assert.equal(new Set(keys).size, keys.length);
  });

  test('canonical slugs present', () => {
    const slugs = SKILL_META.map((m) => m.slug);
    for (const s of [
      'critical-thinking',
      'problem-solving',
      'social-perceptiveness',
      'coordination',
      'instructing',
      'programming',
      'judgment',
      'quality-control',
      'time-management',
      'persuasion',
    ]) {
      assert.ok(slugs.includes(s as SkillSlug), `missing slug: ${s}`);
    }
  });

  test('all entries have required string fields non-empty', () => {
    for (const m of SKILL_META) {
      assert.ok(m.slug.length > 0, `${m.slug}: slug empty`);
      assert.ok(m.ipd_key.length > 0, `${m.slug}: ipd_key empty`);
      assert.ok(m.short_ja.length > 0, `${m.slug}: short_ja empty`);
      assert.ok(m.title_ja.length > 0, `${m.slug}: title_ja empty`);
      assert.ok(m.description_ja.length > 0, `${m.slug}: description_ja empty`);
      assert.ok(m.og_eyebrow.length > 0, `${m.slug}: og_eyebrow empty`);
    }
  });

  test('use_cases_ja + how_to_train_ja are non-empty arrays', () => {
    for (const m of SKILL_META) {
      assert.ok(m.use_cases_ja.length >= 3, `${m.slug}: use_cases_ja < 3`);
      assert.ok(m.how_to_train_ja.length >= 3, `${m.slug}: how_to_train_ja < 3`);
    }
  });

  test('og_eyebrow starts with "SKILL · "', () => {
    for (const m of SKILL_META) {
      assert.match(m.og_eyebrow, /^SKILL · /);
    }
  });

  test('ipd_key uses underscored form (matches IPD JSON keys)', () => {
    for (const m of SKILL_META) {
      assert.match(m.ipd_key, /^[a-z][a-z0-9_]*$/, `${m.slug}: ${m.ipd_key} not snake_case`);
    }
  });
});

describe('getSkillMeta — lookup', () => {
  test('returns matching entry for each known slug', () => {
    for (const m of SKILL_META) {
      const looked = getSkillMeta(m.slug);
      assert.equal(looked.slug, m.slug);
    }
  });

  test('throws on unknown slug', () => {
    assert.throws(
      () => getSkillMeta('not-a-real-skill'),
      /Unknown skill slug/,
    );
  });
});
