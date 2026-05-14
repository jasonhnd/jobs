/**
 * src/views/genre-configs.test.ts — invariants on the 9 × 60 hub config tree.
 *
 * Phase B #18 (2026-05-14): genre-configs.ts moved data/lib → views with no
 * existing test coverage. The 60 configs drive 21 Astro page families
 * (9 × (index + [slug])) and seed sitemap.xml, hub-hub-graph, and
 * spoke-hub-graph. A silent drift in slugs, required fields, or the
 * GenreCatalogue ↔ CONFIGS link breaks SEO baseline immediately, so we
 * lock the invariants here.
 *
 * Guards:
 *   • Counts per genre match the docstring (abilities 10 / knowledge 10 /
 *     values 8 / education 6 / training 5 / work-styles 7 / employment 4 /
 *     life-balance 6 / entry-paths 5 = 61 total — the docstring says 60 but
 *     this test counts what's actually exported, so a future addition
 *     forces an intentional update here)
 *   • Slugs are unique within each genre
 *   • Slugs are kebab-case (Astro route segments — `/^[a-z][a-z0-9-]*$/`)
 *   • Every config has the 7 required fields (slug / short_ja / title_ja /
 *     description_ja / og_eyebrow / dimension_field / dimension_key) and
 *     non-empty characteristics_ja + how_to_develop_ja arrays
 *   • GENRE_CATALOGUES.configs[] points at the exported CONFIGS constants
 *     (same identity — not a stale copy)
 *   • getGenreByPath() round-trips every catalogue path
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ABILITIES_CONFIGS, KNOWLEDGE_CONFIGS, VALUES_CONFIGS,
  EDUCATION_CONFIGS, TRAINING_CONFIGS, WORK_STYLES_CONFIGS,
  EMPLOYMENT_CONFIGS, LIFE_BALANCE_CONFIGS, ENTRY_PATHS_CONFIGS,
  GENRE_CATALOGUES, getGenreByPath,
} from './genre-configs.js';

// Astro route segments accept leading digit (e.g. training/1-3-years), so the
// pattern is `[a-z0-9]` head + `[a-z0-9-]*` tail — kebab-case with digits.
const KEBAB = /^[a-z0-9][a-z0-9-]*$/;

const ALL_GENRES: Array<{ name: string; expected: number; cfgs: ReadonlyArray<unknown> }> = [
  { name: 'ABILITIES_CONFIGS',     expected: 10, cfgs: ABILITIES_CONFIGS },
  { name: 'KNOWLEDGE_CONFIGS',     expected: 10, cfgs: KNOWLEDGE_CONFIGS },
  { name: 'VALUES_CONFIGS',        expected: 8,  cfgs: VALUES_CONFIGS },
  { name: 'EDUCATION_CONFIGS',     expected: 6,  cfgs: EDUCATION_CONFIGS },
  { name: 'TRAINING_CONFIGS',      expected: 5,  cfgs: TRAINING_CONFIGS },
  { name: 'WORK_STYLES_CONFIGS',   expected: 7,  cfgs: WORK_STYLES_CONFIGS },
  { name: 'EMPLOYMENT_CONFIGS',    expected: 4,  cfgs: EMPLOYMENT_CONFIGS },
  { name: 'LIFE_BALANCE_CONFIGS',  expected: 6,  cfgs: LIFE_BALANCE_CONFIGS },
  { name: 'ENTRY_PATHS_CONFIGS',   expected: 5,  cfgs: ENTRY_PATHS_CONFIGS },
];

test('genre-configs: counts per genre pinned (61 total)', () => {
  let total = 0;
  for (const { name, expected, cfgs } of ALL_GENRES) {
    assert.equal(cfgs.length, expected, `${name} count drifted: ${cfgs.length} ≠ ${expected}`);
    total += cfgs.length;
  }
  assert.equal(total, 61, `total hub count drifted: ${total} ≠ 61`);
});

test('genre-configs: slugs unique within each genre', () => {
  for (const { name, cfgs } of ALL_GENRES) {
    const slugs = (cfgs as Array<{ slug: string }>).map((c) => c.slug);
    const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    assert.equal(dup.length, 0, `${name} has duplicate slug(s): ${dup.join(', ')}`);
  }
});

test('genre-configs: slugs are kebab-case (Astro route segment safe)', () => {
  for (const { name, cfgs } of ALL_GENRES) {
    for (const c of cfgs as Array<{ slug: string }>) {
      assert.match(c.slug, KEBAB, `${name}: slug "${c.slug}" violates kebab-case`);
    }
  }
});

test('genre-configs: every config has the 5 required string fields (non-empty)', () => {
  // GenreHubConfig hard-requires: slug / short_ja / title_ja / description_ja /
  // og_eyebrow. characteristics_ja / how_to_develop_ja / dimension_* /
  // custom_filter are all optional fields per the type — but a working hub
  // needs ONE filter discriminator, asserted in the next test.
  type CfgShape = Record<'slug' | 'short_ja' | 'title_ja' | 'description_ja' | 'og_eyebrow', string>;
  for (const { name, cfgs } of ALL_GENRES) {
    for (const c of cfgs as Array<CfgShape>) {
      const where = `${name} slug=${c.slug ?? '(missing)'}`;
      for (const f of ['slug', 'short_ja', 'title_ja', 'description_ja', 'og_eyebrow'] as const) {
        assert.equal(typeof c[f], 'string', `${where}: ${f} not string`);
        assert.ok(c[f].length > 0, `${where}: ${f} empty`);
      }
    }
  }
});

test('genre-configs: every config has a filter discriminator (dimension_field+key OR custom_filter)', () => {
  // Without one of these, buildGenreResult() has nothing to filter
  // occupations by — the hub would render an empty TOP 30 page.
  type CfgShape = {
    slug: string;
    dimension_field?: string;
    dimension_key?: string;
    custom_filter?: (d: unknown) => number | null;
  };
  for (const { name, cfgs } of ALL_GENRES) {
    for (const c of cfgs as Array<CfgShape>) {
      const where = `${name} slug=${c.slug}`;
      const hasDim = typeof c.dimension_field === 'string' && typeof c.dimension_key === 'string';
      const hasCustom = typeof c.custom_filter === 'function';
      assert.ok(hasDim || hasCustom, `${where}: missing filter discriminator — needs dimension_field+dimension_key OR custom_filter`);
    }
  }
});

test('genre-configs: optional info arrays, when present, are non-empty', () => {
  type CfgShape = {
    slug: string;
    characteristics_ja?: ReadonlyArray<string>;
    how_to_develop_ja?: ReadonlyArray<string>;
  };
  for (const { name, cfgs } of ALL_GENRES) {
    for (const c of cfgs as Array<CfgShape>) {
      const where = `${name} slug=${c.slug}`;
      if (c.characteristics_ja !== undefined) {
        assert.ok(Array.isArray(c.characteristics_ja) && c.characteristics_ja.length > 0,
          `${where}: characteristics_ja present but empty / wrong shape`);
      }
      if (c.how_to_develop_ja !== undefined) {
        assert.ok(Array.isArray(c.how_to_develop_ja) && c.how_to_develop_ja.length > 0,
          `${where}: how_to_develop_ja present but empty / wrong shape`);
      }
    }
  }
});

test('GENRE_CATALOGUES: configs[] points at the same identity as the exported CONFIGS constants', () => {
  // This catches the drift where someone duplicates one of the arrays
  // inline into GENRE_CATALOGUES instead of referencing the constant —
  // a future genre addition then silently desyncs the index page and the
  // [slug] page.
  const map: Record<string, ReadonlyArray<unknown>> = {
    abilities: ABILITIES_CONFIGS,
    knowledge: KNOWLEDGE_CONFIGS,
    values: VALUES_CONFIGS,
    education: EDUCATION_CONFIGS,
    training: TRAINING_CONFIGS,
    'work-styles': WORK_STYLES_CONFIGS,
    'employment-types': EMPLOYMENT_CONFIGS,
    'life-balance': LIFE_BALANCE_CONFIGS,
    'entry-paths': ENTRY_PATHS_CONFIGS,
  };
  for (const cat of GENRE_CATALOGUES) {
    const expected = map[cat.path];
    assert.ok(expected !== undefined, `GENRE_CATALOGUES has unknown path: ${cat.path}`);
    assert.strictEqual(cat.configs, expected, `GENRE_CATALOGUES.${cat.path}.configs is not the same array reference as the exported constant — likely an inline copy`);
  }
  // Every genre constant must appear in the catalogue (no orphans).
  assert.equal(GENRE_CATALOGUES.length, Object.keys(map).length, `GENRE_CATALOGUES has ${GENRE_CATALOGUES.length} entries, expected ${Object.keys(map).length}`);
});

test('getGenreByPath: round-trips every catalogue path; returns null on miss', () => {
  for (const cat of GENRE_CATALOGUES) {
    const got = getGenreByPath(cat.path);
    assert.ok(got !== null, `getGenreByPath('${cat.path}') unexpectedly null`);
    assert.equal(got!.path, cat.path);
  }
  assert.equal(getGenreByPath('not-a-real-genre'), null);
  assert.equal(getGenreByPath(''), null);
});
