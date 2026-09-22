import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  HAID_RELEASE_ROOT,
  HaidAnchorSchema,
  HaidLevelInputSchema,
  HaidReleaseFileSchema,
  loadHaidRelease,
  quarterBounds,
  validateHaidRelease,
  windowFits,
  type HaidAnchor,
  type HaidRelease,
} from './haid-release.js';

function anchor(overrides: Partial<HaidAnchor> & Pick<HaidAnchor, 'id' | 'value'>): HaidAnchor {
  return {
    entity: 'Fixture',
    entity_ja: '架空',
    metric_ja: '月間利用者',
    unit: 'people',
    window: 'days_30',
    as_of: '2026-06-30',
    published_at: '2026-06-30',
    grade: 'B',
    source_name: 'Fixture',
    source_url: 'https://example.test/',
    status: 'verified',
    note: '',
    ...overrides,
  };
}

function fixture(): HaidRelease {
  const none = { certainty: 'none' as const, method: 'none' as const, anchors: [], method_ja: 'なし' };
  return {
    anchors: [
      anchor({ id: 'pop', value: 8_000_000_000, grade: 'A', window: 'state' }),
      anchor({ id: 'net', value: 6_000_000_000, grade: 'A', window: 'itu_3m' }),
      anchor({ id: 'shown', value: 2_000_000_000 }),
      anchor({ id: 'a', value: 1_000_000_000 }),
      anchor({ id: 'b', value: 500_000_000 }),
      anchor({ id: 'w', value: 800_000_000, window: 'days_7' }),
      anchor({ id: 'agent', value: 30_000_000 }),
    ],
    overlap: {
      level_4: { rate: 0.3, low: 0.2, high: 0.4, grade: 'D', source_name: 'Survey', source_url: 'https://example.test/s', as_of: '2026-05-01', status: 'verified', note: '' },
      level_5: null,
    },
    release: {
      release: '2026-q3',
      label_ja: '2026 年 第 3 四半期',
      version: '2026-Q3.0',
      status: 'final',
      spec_version: '1.0',
      planned_publish: '2026-10-24',
      published_at: '2026-10-24',
      population_anchor: 'pop',
      previous: null,
      levels: {
        '1': { certainty: 'measured', method: 'single', anchors: ['pop'], method_ja: '総人口' },
        '2': { certainty: 'measured', method: 'single', anchors: ['net'], method_ja: 'インターネット' },
        '3': { certainty: 'lower_bound', method: 'max_single', anchors: ['shown'], method_ja: '下限' },
        '4': { certainty: 'range', method: 'sum_minus_overlap', anchors: ['a', 'b'], overlap: 'level_4', method_ja: '幅' },
        '5': { certainty: 'lower_bound', method: 'max_single', anchors: ['w'], method_ja: '下限' },
        '6': { certainty: 'lower_bound', method: 'max_single', anchors: ['agent'], method_ja: '下限' },
        '7': none, '8': none, '9': none, '10': none,
      },
      payment: { certainty: 'none', count: null, anchors: [], method_ja: 'なし' },
    },
  };
}

describe('HAID release schema', () => {
  test('a well-formed final release validates', () => {
    assert.deepEqual(validateHaidRelease(fixture()), []);
  });

  test('the method decides the certainty and the anchor count', () => {
    const ok = (v: unknown) => HaidLevelInputSchema.safeParse(v).success;
    assert.equal(ok({ certainty: 'none', method: 'none', anchors: [], method_ja: 'x' }), true);
    assert.equal(ok({ certainty: 'none', method: 'none', anchors: ['a'], method_ja: 'x' }), false);
    assert.equal(ok({ certainty: 'measured', method: 'single', anchors: ['a'], method_ja: 'x' }), true);
    assert.equal(ok({ certainty: 'measured', method: 'single', anchors: ['a', 'b'], method_ja: 'x' }), false);
    assert.equal(ok({ certainty: 'lower_bound', method: 'max_single', anchors: ['a'], method_ja: 'x' }), true);
    assert.equal(ok({ certainty: 'range', method: 'max_single', anchors: ['a'], method_ja: 'x' }), false, 'max_single cannot yield range');
    assert.equal(ok({ certainty: 'range', method: 'sum_minus_overlap', anchors: ['a', 'b'], overlap: 'level_4', method_ja: 'x' }), true);
    assert.equal(ok({ certainty: 'range', method: 'sum_minus_overlap', anchors: ['a'], overlap: 'level_4', method_ja: 'x' }), false, 'needs two anchors');
    assert.equal(ok({ certainty: 'range', method: 'sum_minus_overlap', anchors: ['a', 'b'], method_ja: 'x' }), false, 'needs an overlap');
    assert.equal(ok({ certainty: 'measured', method: 'single', anchors: ['a'], overlap: 'level_4', method_ja: 'x' }), false);
  });

  test('anchor windows must fit the level window', () => {
    assert.equal(windowFits('days_30', 'days_7'), true, 'weekly floors a monthly level');
    assert.equal(windowFits('days_7', 'days_30'), false);
    assert.equal(windowFits('itu_3m', 'state'), true);
    assert.equal(windowFits('days_30', 'state'), false);
    assert.equal(windowFits('days_30', 'cumulative'), false, 'an all-time count bounds nothing in a window');
    assert.equal(windowFits('state', 'cumulative'), false);
    const f = fixture();
    const bad: HaidRelease = {
      ...f,
      release: { ...f.release, levels: { ...f.release.levels, '5': { ...f.release.levels['5'], anchors: ['a'] } } },
    };
    assert.ok(validateHaidRelease(bad).some((p) => p.includes('level 5 (days_7) cannot use anchor a')));
  });

  test('exactly levels 1..10 are required, no extras', () => {
    const r = fixture().release;
    const missing = { ...r, levels: Object.fromEntries(Object.entries(r.levels).filter(([k]) => k !== '10')) };
    assert.equal(HaidReleaseFileSchema.safeParse(missing).success, false);
    const extra = { ...r, levels: { ...r.levels, '11': r.levels['10'] } };
    assert.equal(HaidReleaseFileSchema.safeParse(extra).success, false);
  });

  test('population anchor must exist and equal N(≥1)', () => {
    const f = fixture();
    const wrongId: HaidRelease = { ...f, release: { ...f.release, population_anchor: 'nope' } };
    assert.ok(validateHaidRelease(wrongId).some((p) => p.includes('population_anchor')));
    const wrongAnchor: HaidRelease = {
      ...f,
      release: { ...f.release, levels: { ...f.release.levels, '1': { ...f.release.levels['1'], anchors: ['net'] } } },
    };
    assert.ok(validateHaidRelease(wrongAnchor).some((p) => p.includes('level 1')));
  });

  test('unknown anchor and overlap references are reported', () => {
    const f = fixture();
    const badAnchor: HaidRelease = {
      ...f,
      release: { ...f.release, levels: { ...f.release.levels, '4': { ...f.release.levels['4'], anchors: ['ghost'] } } },
    };
    assert.ok(validateHaidRelease(badAnchor).some((p) => p.includes('unknown anchor ghost')));
    const badOverlap: HaidRelease = { ...f, overlap: { level_4: null, level_5: null } };
    assert.ok(validateHaidRelease(badOverlap).some((p) => p.includes('overlap level_4')));
    const overlapOnLevel3: HaidRelease = {
      ...f,
      release: { ...f.release, levels: { ...f.release.levels, '3': { ...f.release.levels['3'], overlap: 'level_4' } } },
    };
    assert.ok(validateHaidRelease(overlapOnLevel3).some((p) => p.includes('level 3 must not carry an overlap')));
  });

  test('a final release refuses placeholders and needs published_at; a draft accepts them', () => {
    const f = fixture();
    const placeholder: HaidRelease = { ...f, anchors: f.anchors.map((a) => (a.id === 'a' ? { ...a, status: 'placeholder' } : a)) };
    assert.ok(validateHaidRelease(placeholder).some((p) => p.includes('anchor a is still placeholder')));
    const unpublished: HaidRelease = { ...f, release: { ...f.release, published_at: null } };
    assert.ok(validateHaidRelease(unpublished).some((p) => p.includes('published_at')));
    const draft: HaidRelease = { ...placeholder, release: { ...placeholder.release, status: 'draft', published_at: null } };
    assert.deepEqual(validateHaidRelease(draft), []);
  });

  test('anchor rows are strict and reject unknown units', () => {
    assert.equal(HaidAnchorSchema.safeParse({ ...anchor({ id: 'x', value: 1 }), unit: 'devices' }).success, false);
    assert.equal(HaidAnchorSchema.safeParse({ ...anchor({ id: 'x', value: 1 }), extra: 1 }).success, false);
  });
});

describe('quarter bounds', () => {
  test('q1..q4 map to calendar quarters', () => {
    assert.deepEqual(quarterBounds('2026-q1'), { start: '2026-01-01', end: '2026-03-31' });
    assert.deepEqual(quarterBounds('2026-q2'), { start: '2026-04-01', end: '2026-06-30' });
    assert.deepEqual(quarterBounds('2026-q3'), { start: '2026-07-01', end: '2026-09-30' });
    assert.deepEqual(quarterBounds('2026-q4'), { start: '2026-10-01', end: '2026-12-31' });
    assert.throws(() => quarterBounds('2026-Q3'));
  });
});

describe('checked-in HAID releases', () => {
  const dirs = readdirSync(HAID_RELEASE_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  test('at least the 2026-q3 release exists and every directory is a release id', () => {
    assert.ok(dirs.includes('2026-q3'));
    for (const d of dirs) assert.match(d, /^\d{4}-q[1-4]$/);
  });

  for (const d of dirs) {
    test(`${d} loads and passes every invariant`, async () => {
      const rel = await loadHaidRelease(join(HAID_RELEASE_ROOT, d));
      assert.equal(rel.release.release, d);
      assert.equal(Object.keys(rel.release.levels).length, 10);
    });
  }
});
