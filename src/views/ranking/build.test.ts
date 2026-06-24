import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildRankings, type Occupation, type RankingSlug, type RankingsBundle } from './index.js';
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
    demand_band: 'cool',
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
    demand_band: 'warm',
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
    demand_band: 'warm',
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
    assert.deepEqual(ids(bundle, 'ai-safe-high-demand'), [3, 7, 4]);
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
