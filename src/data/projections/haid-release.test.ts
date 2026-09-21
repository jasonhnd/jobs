import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { HAID_RELEASE_ROOT, loadHaidRelease, type HaidAnchor, type HaidRelease } from '../schema/haid-release.js';
import { buildHaidRelease, buildHaidReleasePayload, pickLatestRelease } from './haid-release.js';

function anchor(overrides: Partial<HaidAnchor> & Pick<HaidAnchor, 'id' | 'value' | 'as_of'>): HaidAnchor {
  return {
    entity: 'Fixture',
    entity_ja: '架空',
    metric_ja: '月間利用者',
    unit: 'people',
    window: 'days_30',
    published_at: overrides.as_of,
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
      anchor({ id: 'pop', value: 80, as_of: '2026-01-01', grade: 'A', window: 'state' }),
      anchor({ id: 'net', value: 60, as_of: '2026-02-01', grade: 'A', window: 'itu_3m' }),
      anchor({ id: 'shown', value: 10, as_of: '2026-03-01' }),
      anchor({ id: 'a', value: 12, as_of: '2026-04-01' }),
      anchor({ id: 'w', value: 8, as_of: '2026-05-01', window: 'days_7' }),
      anchor({ id: 'agent', value: 1, as_of: '2026-06-01' }),
      anchor({ id: 'uncited', value: 1, as_of: '2026-12-31', status: 'placeholder' }),
    ],
    overlap: {
      level_4: { rate: 0.3, low: 0.2, high: 0.4, grade: 'D', source_name: 'Survey', source_url: null, as_of: null, status: 'verified', note: '' },
      level_5: null,
    },
    release: {
      release: '2026-q3',
      label_ja: '2026 年 第 3 四半期',
      version: '2026-Q3.0',
      status: 'draft',
      spec_version: '1.0',
      planned_publish: '2026-10-24',
      published_at: null,
      population_anchor: 'pop',
      previous: null,
      levels: {
        '1': { certainty: 'measured', method: 'single', anchors: ['pop'], method_ja: '総人口' },
        '2': { certainty: 'measured', method: 'single', anchors: ['net'], method_ja: 'インターネット' },
        // lower bound (10) below the level-4 estimate (14): nesting must clamp it up.
        '3': { certainty: 'lower_bound', method: 'max_single', anchors: ['shown'], method_ja: '下限' },
        // a (12, monthly) + w (8, weekly floor) = 20; max 12; mid = 20 × 0.7 = 14
        '4': { certainty: 'range', method: 'sum_minus_overlap', anchors: ['a', 'w'], overlap: 'level_4', method_ja: '幅' },
        '5': { certainty: 'lower_bound', method: 'max_single', anchors: ['w'], method_ja: '下限' },
        '6': { certainty: 'lower_bound', method: 'max_single', anchors: ['agent'], method_ja: '下限' },
        '7': none, '8': none, '9': none, '10': none,
      },
      payment: { certainty: 'none', count: null, anchors: [], method_ja: 'なし' },
    },
  };
}

describe('HAID release projection', () => {
  test('display values nest: a level-3 lower bound below level 4 is clamped and recorded', () => {
    const p = buildHaidReleasePayload(fixture());
    const l3 = p.levels[2];
    assert.equal(l3.n_at_least.display, 14);
    assert.equal(l3.n_at_least.clamped, true);
    assert.equal(l3.n_at_least.low, 10, 'the computed value is kept as computed');
    assert.equal(l3.derivation.floored_to, 14);
    assert.equal(p.levels[3].n_at_least.clamped, false);
    for (let i = 0; i + 1 < p.levels.length; i += 1) {
      const a = p.levels[i].n_at_least.display;
      const b = p.levels[i + 1].n_at_least.display;
      if (a !== null && b !== null) assert.ok(a >= b, `N(≥${i + 1}) >= N(≥${i + 2})`);
    }
  });

  test('n(k) sums to the population and shares sum to 1', () => {
    const p = buildHaidReleasePayload(fixture());
    const sum = p.levels.reduce((acc, l) => acc + (l.n.display ?? 0), 0);
    assert.equal(sum, p.population);
    const shares = p.levels.reduce((acc, l) => acc + (l.n.share ?? 0), 0);
    assert.ok(Math.abs(shares - 1) < 1e-12);
    assert.deepEqual(p.levels.map((l) => l.n.display), [20, 46, 0, 6, 7, 1, null, null, null, null]);
  });

  test('n(k) certainty: none stays none, level 2 is residual, otherwise the weaker side', () => {
    const p = buildHaidReleasePayload(fixture());
    assert.deepEqual(
      p.levels.map((l) => l.n.certainty),
      ['measured', 'residual', 'lower_bound', 'lower_bound', 'lower_bound', 'lower_bound', 'none', 'none', 'none', 'none'],
    );
  });

  test('the derivation trace spells out every method', () => {
    const p = buildHaidReleasePayload(fixture());
    const d4 = p.levels[3].derivation;
    assert.equal(d4.method, 'sum_minus_overlap');
    assert.deepEqual(d4.terms.map((t) => [t.id, t.value, t.narrower_window]), [['a', 12, false], ['w', 8, true]]);
    assert.equal(d4.sum, 20);
    assert.equal(d4.max, 12);
    assert.equal(d4.overlap_rate, 0.3);
    assert.deepEqual([d4.low, d4.mid, d4.high], [12, 14, 20]);
    const d1 = p.levels[0].derivation;
    assert.equal(d1.method, 'single');
    assert.equal(d1.computed, 80);
    const d6 = p.levels[5].derivation;
    assert.equal(d6.method, 'max_single');
    assert.equal(d6.max, 1);
    assert.equal(p.levels[6].derivation.method, 'none');
    assert.equal(p.levels[6].derivation.computed, null);
  });

  test('as_of is the latest cited anchor, ignoring uncited ones', () => {
    const p = buildHaidReleasePayload(fixture());
    assert.equal(p.as_of, '2026-06-01');
    assert.deepEqual(p.placeholder_anchors, ['uncited']);
  });

  test('payload carries the definitions and the release meta', () => {
    const p = buildHaidReleasePayload(fixture());
    assert.equal(p.standard, 'HAID');
    assert.equal(p.spec_version, '1.0');
    assert.equal(p.status, 'draft');
    assert.equal(p.url, 'https://mirai-shigoto.com/aiadoption/2026-q3');
    assert.equal(p.levels.length, 10);
    assert.equal(p.boundaries.length, 3);
    assert.equal(p.relations.length, 4);
    assert.equal(p.levels[0].relation, 'none');
    assert.equal(p.levels[9].ja, '分けられない');
  });

  test('latest is the lexically newest release id', () => {
    assert.equal(pickLatestRelease(['2026-q3', '2027-q1', '2026-q4']), '2027-q1');
    assert.throws(() => pickLatestRelease([]));
  });

  test('a データなし level between two data levels is floored to the next level, n = 0, certainty none', () => {
    const f = fixture();
    f.release.levels['3'] = { certainty: 'none', method: 'none', anchors: [], method_ja: 'なし' };
    const p = buildHaidReleasePayload(f);
    const l3 = p.levels[2];
    assert.equal(l3.n_at_least.certainty, 'none');
    assert.equal(l3.n_at_least.display, 14, 'floored to N(≥4)');
    assert.equal(l3.n_at_least.clamped, true);
    assert.equal(l3.n.certainty, 'none');
    assert.equal(l3.n.display, 0);
    const sum = p.levels.reduce((acc, l) => acc + (l.n.display ?? 0), 0);
    assert.equal(sum, p.population);
  });

  test('round and previous_levels come from the context; a missing previous payload throws', () => {
    const first = buildHaidReleasePayload(fixture(), { releases: ['2026-q3', '2026-q4'], previous: null });
    assert.equal(first.round, 1);
    assert.equal(first.previous_levels, null);
    assert.deepEqual(first.releases, ['2026-q3', '2026-q4']);
    const g = fixture();
    g.release.release = '2026-q4';
    g.release.version = '2026-Q4.0';
    g.release.previous = '2026-q3';
    const second = buildHaidReleasePayload(g, { releases: ['2026-q3', '2026-q4'], previous: first });
    assert.equal(second.round, 2);
    assert.equal(second.previous_levels?.length, 10);
    assert.equal(second.previous_levels?.[3].n_at_least_display, 14);
    assert.deepEqual(second.previous_levels?.[3].anchor_grades, ['B']);
    assert.deepEqual(second.previous_levels?.[6].anchor_grades, []);
    assert.throws(() => buildHaidReleasePayload(g, { releases: ['2026-q3', '2026-q4'], previous: null }), /no payload/);
    assert.throws(() => buildHaidReleasePayload(g, { releases: ['2026-q3'], previous: first }), /not in the release list/);
  });

  test('buildHaidRelease writes one file per checked-in release plus latest', async () => {
    const out = await mkdtemp(join(tmpdir(), 'haid-release-'));
    try {
      const r = await buildHaidRelease(out);
      assert.ok(r.releases.includes('2026-q3'));
      assert.equal(r.latest, r.releases.at(-1));
      const latest = JSON.parse(await readFile(join(out, 'data.haid-latest.json'), 'utf-8'));
      assert.equal(latest.release, r.latest);
      assert.deepEqual(latest.releases, r.releases);
      assert.ok(r.releases.includes('2026-q2'));
      assert.equal(latest.previous, '2026-q2');
      assert.equal(latest.round, r.releases.length);
      assert.equal(latest.previous_levels.length, 10);
      const stub = JSON.parse(await readFile(join(out, 'data.ai-adoption.json'), 'utf-8'));
      assert.equal(stub.deprecated, true);
      assert.equal(stub.successor, '/data.haid-latest.json');
      assert.equal(stub.successor_release, `/data.haid-${r.latest}.json`);
      assert.equal(r.files.length, r.releases.length + 2, 'one per release + latest + the retired stub');
      const q3 = JSON.parse(await readFile(join(out, 'data.haid-2026-q3.json'), 'utf-8'));
      assert.equal(q3.population, 8_300_000_000);
      const sum = q3.levels.reduce((acc: number, l: { n: { display: number | null } }) => acc + (l.n.display ?? 0), 0);
      assert.equal(sum, q3.population);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  test('the checked-in 2026-q3 draft derives without a clamp on levels 1, 2 and 4', async () => {
    const q2 = buildHaidReleasePayload(await loadHaidRelease(join(HAID_RELEASE_ROOT, '2026-q2')), { releases: ['2026-q2', '2026-q3'], previous: null });
    const p = buildHaidReleasePayload(await loadHaidRelease(join(HAID_RELEASE_ROOT, '2026-q3')), { releases: ['2026-q2', '2026-q3'], previous: q2 });
    assert.equal(p.levels[0].n_at_least.clamped, false);
    assert.equal(p.levels[1].n_at_least.clamped, false);
    assert.equal(p.levels[3].n_at_least.clamped, false);
    assert.equal(p.status, 'draft');
    assert.ok(p.placeholder_anchors.length > 0, 'a draft carries placeholders');
  });
});
