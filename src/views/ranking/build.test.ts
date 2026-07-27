import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildRankings, type Occupation, type RankingSlug, type RankingsBundle } from './index.js';
import { buildWorkConditionsRankings } from './rankings/work-conditions.js';
import { HIGH_DEMAND_MIN, demandScore } from './config.js';
import { EDU, EMP } from '../../data/domain/distribution-labels.js';

function occupation(overrides: Partial<Occupation> & Pick<Occupation, 'id'>): Occupation {
  const { id, ...rest } = overrides;
  return {
    id,
    title_ja: `fixture-${id}`,
    ai_risk: 6,
    risk_band: 'mid',
    workers: 10_000,
    salary: 400,
    monthly_hours: 160,
    average_age: 40,
    recruit_wage: 25,
    recruit_ratio: 1,
    demand_band: 'normal',
    sector_id: 'service',
    sector_ja: 'Service',
    education_pct: {},
    employment_type: {},
    certs: [],
    hourly_wage: 1_500,
    ...rest,
  };
}

const occupations: Occupation[] = [
  occupation({
    id: 1,
    title_ja: 'High risk clerk',
    ai_risk: 9,
    risk_band: 'high',
    workers: 100_000,
    salary: 650,
    demand_band: 'cold',
  }),
  occupation({
    id: 2,
    title_ja: 'High risk operator',
    ai_risk: 8,
    risk_band: 'high',
    workers: 200_000,
    salary: 550,
  }),
  occupation({
    id: 3,
    title_ja: 'Safe senior engineer',
    ai_risk: 5,
    workers: 80_000,
    salary: 900,
    demand_band: 'hot',
    sector_id: 'it',
    certs: ['A', 'B'],
    education_pct: { [EDU.university]: 60 },
    employment_type: { [EMP.regular]: 70 },
  }),
  occupation({
    id: 4,
    title_ja: 'Protected nurse',
    ai_risk: 4,
    workers: 60_000,
    salary: 700,
    demand_band: 'hot',
    sector_id: 'iryo',
    certs: ['A', 'B', 'C'],
    education_pct: { [EDU.highSchool]: 40 },
    employment_type: { [EMP.regular]: 80 },
  }),
  occupation({
    id: 5,
    title_ja: 'High paid unsafe',
    ai_risk: 5.1,
    workers: 90_000,
    salary: 1000,
    demand_band: 'hot',
    certs: ['A', 'B', 'C', 'D'],
  }),
  occupation({
    id: 6,
    title_ja: 'Unscored millionaire',
    ai_risk: null,
    risk_band: null,
    workers: 250_000,
    salary: 1200,
    demand_band: 'hot',
  }),
  occupation({
    id: 7,
    title_ja: 'Craft safe',
    ai_risk: 2,
    workers: 55_000,
    salary: 450,
    demand_band: 'hot',
    sector_id: 'kensetu',
    education_pct: { [EDU.highSchool]: 70 },
    employment_type: { [EMP.selfEmployedFreelance]: 25 },
  }),
  occupation({
    id: 8,
    title_ja: 'Small safe',
    ai_risk: 3,
    workers: 49_000,
    salary: 300,
    demand_band: 'cold',
    average_age: 25,
  }),
];

function ids(bundle: RankingsBundle, slug: RankingSlug): number[] {
  const result = bundle.results.get(slug);
  if (!result) throw new Error(`missing ranking ${slug}`);
  return result.items.map((o) => o.id);
}

describe('buildRankings synthetic fixtures', () => {
  test('filters salary-safe by ai_risk <= 5 and sorts by salary desc', () => {
    // Arrange / Act
    const bundle = buildRankings(() => occupations, { limit: Number.POSITIVE_INFINITY });

    // Assert
    assert.deepEqual(ids(bundle, 'salary-safe'), [3, 4, 7, 8]);
  });

  test('filters high-risk and stable workforce rankings at their current thresholds', () => {
    // Arrange / Act
    const bundle = buildRankings(() => occupations, { limit: Number.POSITIVE_INFINITY });

    // Assert
    assert.deepEqual(ids(bundle, 'ai-replaced-soon'), [1, 2]);
    assert.deepEqual(ids(bundle, 'large-workforce-stable'), [3, 4, 7]);
  });

  test('filters regulated and demand-safe rankings, then preserves their sort order', () => {
    // Arrange / Act
    const bundle = buildRankings(() => occupations, { limit: Number.POSITIVE_INFINITY });

    // Assert
    assert.deepEqual(ids(bundle, 'regulated-protected'), [4, 3]);
    // ids 3/4/7 are all `hot`, so the demand-score term ties and the order is
    // the `ai_risk` ascending tiebreak: 2, 4, 5. It used to read [3, 7, 4]
    // because the fixtures gave 4 and 7 the band `warm` — retired vocabulary
    // that cannot occur in real data (issue #216). Only `hot` clears
    // HIGH_DEMAND_MIN, so this ranking is hot-only in production too.
    assert.deepEqual(ids(bundle, 'ai-safe-high-demand'), [7, 4, 3]);
  });

  test('keeps pure salary, workforce, and high-salary-demand ordering stable', () => {
    // Arrange / Act
    const bundle = buildRankings(() => occupations, { limit: Number.POSITIVE_INFINITY });

    // Assert
    assert.deepEqual(ids(bundle, 'salary'), [6, 5, 3, 4, 1, 2, 7, 8]);
    assert.deepEqual(ids(bundle, 'workers'), [6, 2, 1, 5, 3, 4, 7, 8]);
    assert.deepEqual(ids(bundle, 'high-salary-high-demand'), [5, 3, 4, 7]);
  });

  test('honors explicit limit without changing the sorted universe prefix', () => {
    // Arrange / Act
    const bundle = buildRankings(() => occupations, { limit: 2 });

    // Assert
    assert.deepEqual(ids(bundle, 'salary'), [6, 5]);
    assert.deepEqual(ids(bundle, 'salary-safe'), [3, 4]);
  });
});

describe('high-demand headline counts (issue #216)', () => {
  // Fixture bands: hot ×5 (3,4,5,6,7), normal ×1 (2), cold ×2 (1,8).
  const HOT_TOTAL = 5;
  const NORMAL_TOTAL = 1;

  test('counts the whole dataset, not the page slice', () => {
    // Arrange: a limit far below the number of hot occupations. Deriving the
    // count from the sliced list made it tautologically equal to the limit —
    // shipping 「需要高」30件 when the real figure was 270.
    const built = buildWorkConditionsRankings(occupations, 2);

    // Assert
    assert.equal(built.byDemand.length, 2, 'the page itself is still sliced');
    assert.equal(built.hotCount, HOT_TOTAL);
    assert.equal(built.normalCount, NORMAL_TOTAL);
  });

  test('the count is independent of the limit', () => {
    const small = buildWorkConditionsRankings(occupations, 1);
    const large = buildWorkConditionsRankings(occupations, Number.POSITIVE_INFINITY);

    assert.equal(small.hotCount, large.hotCount);
    assert.equal(small.normalCount, large.normalCount);
  });

  test('SEO copy quotes the dataset-wide figures and drops the retired band', () => {
    const built = buildWorkConditionsRankings(occupations, 2);
    const highDemand = built.entries.find(([slug]) => slug === 'high-demand')?.[1];
    assert.ok(highDemand, 'high-demand entry exists');

    // `やや高` was DEMAND_JA['warm'] — a band `DemandBand` does not contain, so
    // the clause was permanently 「やや高」0件.
    assert.equal(highDemand.seoDesc.includes('やや高'), false);
    assert.ok(highDemand.seoDesc.includes(`「需要高」は${HOT_TOTAL}件`), highDemand.seoDesc);
    assert.ok(
      highDemand.statBlocks.some(([label, value]) => label.includes('需要高') && value === String(HOT_TOTAL)),
      JSON.stringify(highDemand.statBlocks),
    );
  });
});

/**
 * Three rankings filter on `demandScore(...) >= HIGH_DEMAND_MIN` and then sort
 * with a `demandScore` term. That term is currently always 0 because only `hot`
 * clears the threshold, so the ordering is carried by the tiebreak alone.
 *
 * The comparators are kept rather than deleted, so admitting `normal` later
 * restores demand ordering instead of silently losing it. This test pins the
 * relationship: change HIGH_DEMAND_MIN or DEMAND_SCORE and it tells you the
 * ordering assumption moved. Follow-up to the observation recorded in #216.
 */
describe('HIGH_DEMAND_MIN admits exactly one band', () => {
  test('only `hot` clears the threshold', () => {
    assert.equal(demandScore('hot') >= HIGH_DEMAND_MIN, true);
    assert.equal(demandScore('normal') >= HIGH_DEMAND_MIN, false);
    assert.equal(demandScore('cold') >= HIGH_DEMAND_MIN, false);
    assert.equal(demandScore(null) >= HIGH_DEMAND_MIN, false);
  });

  test('the band order is cold < normal < hot', () => {
    assert.ok(demandScore('cold') < demandScore('normal'));
    assert.ok(demandScore('normal') < demandScore('hot'));
    // `normal` scoring 0 was the defect: it sorted the 105 mid-demand
    // occupations below the 170 cold ones (#216).
    assert.ok(demandScore('normal') > 0);
  });
});
