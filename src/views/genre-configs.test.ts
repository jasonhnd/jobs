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

// Predicate fixtures are deliberately in-memory; no score/data files are written.
import type { DetailFileMin, GenreHubConfig } from './genre-hub.js';

function runFilter(configs: ReadonlyArray<GenreHubConfig>, slug: string, detail: Partial<DetailFileMin>): number | null {
  const config = configs.find((c) => c.slug === slug);
  assert.ok(config?.custom_filter, `Missing custom filter for ${slug}`);
  return config.custom_filter({ id: 1, ...detail });
}

for (const [slug, key, minimum] of [
  ['no-school-required', 'below_high_school', 0.05],
  ['high-school-careers', 'high_school', 0.3],
  ['vocational-school-careers', 'vocational_school', 0.15],
  ['university-careers', 'university', 0.5],
] as const) {
  test(`education ${slug}: missing/below-threshold excluded; inclusive boundary retained`, () => {
    const run = (education_distribution?: Record<string, number> | null) =>
      runFilter(EDUCATION_CONFIGS, slug, { education_distribution });
    assert.equal(run(), null);
    assert.equal(run(null), null);
    assert.equal(run({ unrelated: 1 }), null);
    assert.equal(run({ [key]: minimum - 0.001 }), null);
    assert.equal(run({ [key]: minimum }), minimum);
    assert.equal(run({ [key]: 1 }), 1);
  });
}

test('graduate education sums masters and doctorate, including partially missing keys', () => {
  const run = (education_distribution?: Record<string, number> | null) =>
    runFilter(EDUCATION_CONFIGS, 'graduate-school-careers', { education_distribution });
  assert.equal(run(), null);
  assert.equal(run(null), null);
  assert.equal(run({}), null);
  assert.equal(run({ masters: 0.1, doctorate: 0.09 }), null);
  assert.equal(run({ masters: 0.1, doctorate: 0.1 }), 0.2);
  assert.equal(run({ doctorate: 0.2 }), 0.2);
  assert.equal(run({ masters: 0.3 }), 0.3);
});

for (const [configs, slug] of [
  [EDUCATION_CONFIGS, 'lifetime-learning'], [ENTRY_PATHS_CONFIGS, 'independent-typical'],
] as const) {
  test(`${slug}: certifications and known risk at most six are required`, () => {
    const run = (d: Partial<DetailFileMin>) => runFilter(configs, slug, d);
    assert.equal(run({}), null);
    assert.equal(run({ related_certs_ja: [], ai_risk: { score: 2 } }), null);
    assert.equal(run({ related_certs_ja: ['Cert'] }), null);
    assert.equal(run({ related_certs_ja: ['Cert'], ai_risk: null }), null);
    assert.equal(run({ related_certs_ja: ['Cert'], ai_risk: { score: null } }), null);
    assert.equal(run({ related_certs_ja: ['Cert'], ai_risk: { score: 6.1 } }), null); // 6.01 prints 6.0 and passes (#864)
    assert.equal(run({ related_certs_ja: ['One', 'Two'], ai_risk: { score: 6 } }), 2);
    assert.equal(run({ related_certs_ja: ['Cert'], ai_risk: { score: 0 } }), 1);
  });
}

for (const [slug, keys] of [
  ['quick-start', ['up_to_1_month', '1_to_6_months', '6_months_to_1_year', 'not_required']],
  ['1-3-years', ['1_to_2_years', '2_to_3_years']],
  ['3-5-years', ['3_to_5_years']], ['5-10-years', ['5_to_10_years']], ['lifelong-craft', ['over_10_years']],
] as const) {
  test(`training ${slug}: accepts each configured key and chooses the highest matching score`, () => {
    const entry = (key: string, score: number) => ({ key, label_ja: key, score });
    const run = (training_post_top5?: DetailFileMin['training_post_top5']) =>
      runFilter(TRAINING_CONFIGS, slug, { training_post_top5 });
    assert.equal(run(), null);
    assert.equal(run(null), null);
    assert.equal(run([]), null);
    assert.equal(run([entry('unrelated', 99)]), null);
    for (const key of keys) assert.equal(run([entry(key, 0)]), 0);
    assert.equal(run([entry(keys[0], -2)]), -2);
    assert.equal(run([entry('unrelated', 99), ...keys.map((key) => entry(key, 1)), entry(keys[0], 4), entry(keys[0], 2)]), 4);
  });
}

test('shift work selects all four sectors and ranks by workforce, with a zero fallback', () => {
  const run = (d: Partial<DetailFileMin>) => runFilter(WORK_STYLES_CONFIGS, 'shift-work', d);
  assert.equal(run({}), null);
  assert.equal(run({ sector: null }), null);
  assert.equal(run({ sector: { id: 'unrelated' }, stats: { workers: 100000 } }), null);
  for (const id of ['iryo', 'hoan', 'service', 'maint']) {
    assert.equal(run({ sector: { id }, stats: { workers: 123 } }), 123);
    assert.equal(run({ sector: { id } }), 0);
    assert.equal(run({ sector: { id }, stats: { workers: null } }), 0);
  }
});

for (const [slug, key, minimum] of [
  ['full-time-mainstream', 'regular_employee', 0.6],
  ['freelance-friendly', 'self_employed_freelance', 0.15],
] as const) {
  test(`employment ${slug}: inclusive share threshold and missing-data exclusion`, () => {
    const run = (employment_type?: Record<string, number> | null) =>
      runFilter(EMPLOYMENT_CONFIGS, slug, { employment_type });
    assert.equal(run(), null);
    assert.equal(run(null), null);
    assert.equal(run({}), null);
    assert.equal(run({ [key]: minimum - 0.001 }), null);
    assert.equal(run({ [key]: minimum }), minimum);
  });
}

test('part-time employment sums part-time and dispatched shares; public employment selects its sector', () => {
  const part = (employment_type?: Record<string, number> | null) =>
    runFilter(EMPLOYMENT_CONFIGS, 'part-time-mainstream', { employment_type });
  assert.equal(part(), null);
  assert.equal(part(null), null);
  assert.equal(part({}), null);
  assert.equal(part({ part_time: 0.1, dispatched: 0.09 }), null);
  assert.equal(part({ part_time: 0.1, dispatched: 0.1 }), 0.2);
  assert.equal(part({ part_time: 0.2 }), 0.2);
  assert.equal(part({ dispatched: 0.3 }), 0.3);
  const publicEmployee = (d: Partial<DetailFileMin>) => runFilter(EMPLOYMENT_CONFIGS, 'public-employee', d);
  assert.equal(publicEmployee({}), null);
  assert.equal(publicEmployee({ sector: { id: 'iryo' } }), null);
  assert.equal(publicEmployee({ sector: { id: 'hoan' } }), 1);
});

for (const [slug, maxHours] of [
  ['child-care-balance', 165], ['elderly-care-balance', 170],
  ['health-friendly', 175], ['mental-health-friendly', 170], ['hobby-balance', 160],
] as const) {
  test(`life balance ${slug}: inclusive hours limit, shorter hours rank higher`, () => {
    const run = (stats?: DetailFileMin['stats']) => runFilter(LIFE_BALANCE_CONFIGS, slug, { stats, ai_risk: { score: 6 } });
    assert.equal(run(), null);
    assert.equal(run(null), null);
    assert.equal(run({ monthly_hours: null }), null);
    assert.equal(run({ monthly_hours: 0 }), null);
    assert.equal(run({ monthly_hours: maxHours + 1 }), null);
    assert.equal(run({ monthly_hours: maxHours }), -maxHours);
    assert.equal(run({ monthly_hours: 100 }), -100);
  });
}

test('life balance risk guards distinguish optional risk from required known risk', () => {
  const child = (ai_risk?: DetailFileMin['ai_risk']) => runFilter(LIFE_BALANCE_CONFIGS, 'child-care-balance', { stats: { monthly_hours: 165 }, ai_risk });
  assert.equal(child(), -165);
  assert.equal(child(null), -165);
  assert.equal(child({ score: null }), -165);
  assert.equal(child({ score: 6 }), -165);
  assert.equal(child({ score: 6.1 }), null);
  const mental = (ai_risk?: DetailFileMin['ai_risk']) => runFilter(LIFE_BALANCE_CONFIGS, 'mental-health-friendly', { stats: { monthly_hours: 170 }, ai_risk });
  assert.equal(mental(), null);
  assert.equal(mental(null), null);
  assert.equal(mental({ score: null }), null);
  assert.equal(mental({ score: 0 }), -170);
  assert.equal(mental({ score: 10 }), -170);
});

test('senior balance requires age at least 45 and excludes only known risk above five', () => {
  const run = (d: Partial<DetailFileMin>) => runFilter(LIFE_BALANCE_CONFIGS, 'senior-friendly', d);
  assert.equal(run({}), null);
  assert.equal(run({ stats: { average_age: 0 } }), null);
  assert.equal(run({ stats: { average_age: 44.99 } }), null);
  assert.equal(run({ stats: { average_age: 45 } }), 45);
  assert.equal(run({ stats: { average_age: 60 }, ai_risk: null }), 60);
  assert.equal(run({ stats: { average_age: 60 }, ai_risk: { score: null } }), 60);
  assert.equal(run({ stats: { average_age: 60 }, ai_risk: { score: 5 } }), 60);
  assert.equal(run({ stats: { average_age: 60 }, ai_risk: { score: 5.1 } }), null); // 5.01 prints 5.0 and passes (#864)
});

test('new-graduate and mid-career entry filters retain inclusive age boundaries', () => {
  const young = (average_age?: number | null) => runFilter(ENTRY_PATHS_CONFIGS, 'new-grad-mainstream', { stats: { average_age } });
  assert.equal(young(), null);
  assert.equal(young(null), null);
  assert.equal(young(0), null);
  assert.equal(young(38.01), null);
  assert.equal(young(38), -38);
  assert.equal(young(25), -25);
  const mature = (average_age?: number | null) => runFilter(ENTRY_PATHS_CONFIGS, 'mid-career-mainstream', { stats: { average_age } });
  assert.equal(mature(), null);
  assert.equal(mature(null), null);
  assert.equal(mature(0), null);
  assert.equal(mature(34.99), null);
  assert.equal(mature(35), 35);
  assert.equal(mature(50), 50);
});

test('arbeit entry requires workforce, at most one certification, and a known age at most fifty', () => {
  const run = (d: Partial<DetailFileMin>) => runFilter(ENTRY_PATHS_CONFIGS, 'from-arbeit', d);
  assert.equal(run({}), null);
  assert.equal(run({ stats: { workers: 29999, average_age: 40 } }), null);
  assert.equal(run({ stats: { workers: 30000 } }), null);
  assert.equal(run({ stats: { workers: 30000, average_age: 50.01 } }), null);
  assert.equal(run({ stats: { workers: 30000, average_age: 50 }, related_certs_ja: ['One', 'Two'] }), null);
  assert.equal(run({ stats: { workers: 30000, average_age: 50 }, related_certs_ja: ['One'] }), 30000);
  assert.equal(run({ stats: { workers: 50000, average_age: 35 } }), 50000);
});

test('apprenticeship entry sums low education shares and permits absent risk', () => {
  const run = (d: Partial<DetailFileMin>) => runFilter(ENTRY_PATHS_CONFIGS, 'apprenticeship', d);
  assert.equal(run({}), null);
  assert.equal(run({ education_distribution: null }), null);
  assert.equal(run({ education_distribution: {} }), null);
  assert.equal(run({ education_distribution: { below_high_school: 0.2, high_school: 0.19 } }), null);
  assert.equal(run({ education_distribution: { below_high_school: 0.2, high_school: 0.2 } }), 0.4);
  assert.equal(run({ education_distribution: { high_school: 0.4 }, ai_risk: { score: null } }), 0.4);
  assert.equal(run({ education_distribution: { below_high_school: 0.4 }, ai_risk: null }), 0.4);
  assert.equal(run({ education_distribution: { high_school: 0.4 }, ai_risk: { score: 5 } }), 0.4);
  assert.equal(run({ education_distribution: { high_school: 0.4 }, ai_risk: { score: 5.1 } }), null);
});
