import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { EDU, EMP } from '../domain/distribution-labels.js';
import type { Occupation, RankingSlug } from '../../views/ranking/index.js';
import { RANKING_META } from '../../views/rankings-meta.js';
import {
  assertRankingUniverseMatches,
  buildMePositions,
  computeJobRankingPosition,
  rankIdsForSlug,
  rankingUniverseScope,
  type JobPositions,
} from './me-positions.js';

test('me-positions labels whole-catalogue and eligible-subset universes explicitly', () => {
  assert.equal(rankingUniverseScope('ai-risk-high'), 'all');
  assert.equal(rankingUniverseScope('ai-risk-low'), 'all');
  assert.equal(rankingUniverseScope('salary-safe'), 'eligible');
  assert.equal(rankingUniverseScope('license-required'), 'eligible');
  assert.equal(rankingUniverseScope('public-sector'), 'eligible');
});

test('me-positions computes percentile against the filtered per-slug universe', () => {
  // Arrange
  const fullUniverse = [10, 20, 30, 40];

  // Act
  const position = computeJobRankingPosition(30, null, 2, fullUniverse);

  // Assert
  assert.deepEqual(position, {
    rank: null,
    total: 2,
    outOfUniverse: 3,
    universeSize: 4,
    percentile: 75,
  });
});

test('me-positions keeps unfiltered rankings on the full 556 occupation denominator', () => {
  // Arrange
  const fullUniverse = Array.from({ length: 556 }, (_value, i) => i + 1);

  // Act
  const position = computeJobRankingPosition(278, 2, 30, fullUniverse);

  // Assert
  assert.deepEqual(position, {
    rank: 2,
    total: 30,
    outOfUniverse: 278,
    universeSize: 556,
    percentile: 50,
  });
});

test('me-positions reports jobs outside a filtered universe without percentile', () => {
  // Arrange
  const fullUniverse = [10, 20];

  // Act
  const position = computeJobRankingPosition(30, null, 2, fullUniverse);

  // Assert
  assert.deepEqual(position, {
    rank: null,
    total: 2,
    outOfUniverse: null,
    universeSize: 2,
    percentile: null,
  });
});

test('me-positions drift guard catches order drift beyond TOP_N', () => {
  const canonical = Array.from({ length: 35 }, (_value, i) => i + 1);
  const local = [...canonical];
  [local[32], local[33]] = [local[33]!, local[32]!];

  assert.throws(
    () => assertRankingUniverseMatches('test-ranking', canonical, local),
    /RANKER universe order drift.*position 33/,
  );
});

test('me-positions drift guard catches membership drift beyond TOP_N', () => {
  const canonical = Array.from({ length: 35 }, (_value, i) => i + 1);
  const local = [...canonical];
  local[34] = 999;

  assert.throws(
    () => assertRankingUniverseMatches('test-ranking', canonical, local),
    /RANKER universe membership drift.*35 is missing locally/,
  );
});

test('me-positions drift guard catches size drift beyond TOP_N', () => {
  const canonical = Array.from({ length: 35 }, (_value, i) => i + 1);
  const local = canonical.slice(0, 34);

  assert.throws(
    () => assertRankingUniverseMatches('test-ranking', canonical, local),
    /RANKER universe size drift.*canonical=35 local=34/,
  );
});

test('me-positions drift guard catches duplicate ids in either universe', () => {
  assert.throws(
    () => assertRankingUniverseMatches('dup-canonical', [1, 1], [1]),
    /canonical ranking "dup-canonical" contains duplicate id 1/,
  );
  assert.throws(
    () => assertRankingUniverseMatches('dup-local', [1, 2], [2, 2]),
    /local RANKER "dup-local" contains duplicate id 2/,
  );
});

test('me-positions marks only the two unfiltered AI rankings as the whole catalogue', () => {
  for (const meta of RANKING_META) {
    const scope = meta.slug === 'ai-risk-high' || meta.slug === 'ai-risk-low'
      ? 'all'
      : 'eligible';
    assert.equal(rankingUniverseScope(meta.slug), scope, meta.slug);
  }
});

function occupation(overrides: Partial<Occupation> & Pick<Occupation, 'id'>): Occupation {
  const { id, ...rest } = overrides;
  return {
    id,
    title_ja: `job-${id}`,
    ai_risk: null,
    risk_band: null,
    workers: null,
    salary: null,
    monthly_hours: null,
    average_age: null,
    recruit_wage: null,
    recruit_ratio: null,
    demand_band: null,
    sector_id: 'service',
    sector_ja: 'fixture',
    education_pct: null,
    employment_type: null,
    certs: [],
    hourly_wage: null,
    ...rest,
  };
}

// Thirteen hand-built jobs. Ids 4, 5, and 6 share a salary so the salary-safe
// tie-breaks run; fewer than 30 hot jobs so high-demand uses its fallback.
const occupations: Occupation[] = [
  occupation({
    id: 1,
    ai_risk: 9,
    workers: 90_000,
    salary: 900,
    monthly_hours: 190,
    average_age: 55,
    recruit_wage: 30,
    recruit_ratio: 0.5,
    demand_band: 'cold',
    sector_id: 'service',
    hourly_wage: 3000,
  }),
  occupation({
    id: 2,
    ai_risk: 9,
    workers: 40_000,
    salary: 900,
    monthly_hours: 180,
    average_age: 44,
    recruit_wage: 28,
    recruit_ratio: 1.1,
    demand_band: 'normal',
    sector_id: 'it',
    education_pct: { [EDU.university]: 49 },
    employment_type: { [EMP.regular]: 59 },
    certs: ['A'],
    hourly_wage: 2800,
  }),
  occupation({
    id: 3,
    ai_risk: 8,
    workers: 120_000,
    salary: 700,
    monthly_hours: 175,
    average_age: 48,
    recruit_wage: 22,
    recruit_ratio: 0.9,
    demand_band: 'hot',
    sector_id: 'seizo',
    education_pct: {
      [EDU.highSchool]: 30,
      [EDU.university]: 50,
      [EDU.masters]: 20,
      [EDU.doctorate]: 10,
    },
    employment_type: {
      [EMP.regular]: 60,
      [EMP.selfEmployedFreelance]: 20,
      [EMP.executive]: 10,
    },
    certs: ['A', 'B', 'C'],
    hourly_wage: 2000,
  }),
  occupation({
    id: 4,
    ai_risk: 5,
    workers: 80_000,
    salary: 600,
    monthly_hours: 165,
    average_age: 40,
    recruit_wage: 26,
    recruit_ratio: 2,
    demand_band: 'hot',
    sector_id: 'it',
    education_pct: {
      [EDU.highSchool]: 10,
      [EDU.university]: 70,
      [EDU.masters]: 5,
    },
    employment_type: { [EMP.regular]: 80 },
    certs: ['A', 'B'],
    hourly_wage: 2200,
  }),
  occupation({
    id: 5,
    ai_risk: 5,
    workers: 50_000,
    salary: 600,
    monthly_hours: 140,
    average_age: 30,
    recruit_wage: 18,
    recruit_ratio: 1.5,
    demand_band: 'hot',
    sector_id: 'kensetu',
    education_pct: {
      [EDU.highSchool]: 60,
      [EDU.university]: 20,
      [EDU.masters]: 40,
    },
    employment_type: {
      [EMP.regular]: 70,
      [EMP.selfEmployedFreelance]: 25,
    },
    hourly_wage: 1500,
  }),
  occupation({
    id: 6,
    ai_risk: 4,
    workers: 20_000,
    salary: 600,
    monthly_hours: 150,
    average_age: 33,
    recruit_wage: 16,
    recruit_ratio: 3,
    demand_band: 'cold',
    sector_id: 'iryo',
    education_pct: {
      [EDU.highSchool]: 45,
      [EDU.university]: 50,
      [EDU.masters]: 10,
      [EDU.doctorate]: 20,
    },
    employment_type: {
      [EMP.regular]: 61,
      [EMP.executive]: 30,
    },
    certs: ['A'],
    hourly_wage: 1600,
  }),
  occupation({
    id: 7,
    ai_risk: 3,
    workers: 10_000,
    salary: 250,
    monthly_hours: 110,
    average_age: 23,
    recruit_wage: 12,
    recruit_ratio: 4,
    demand_band: 'hot',
    sector_id: 'keiseki',
    education_pct: {
      [EDU.highSchool]: 90,
      [EDU.university]: 10,
    },
    employment_type: {
      [EMP.regular]: 20,
      [EMP.selfEmployedFreelance]: 40,
    },
    hourly_wage: 800,
  }),
  occupation({
    id: 8,
    ai_risk: 2,
    workers: 15_000,
    salary: 1000,
    monthly_hours: 200,
    average_age: 62,
    recruit_wage: 40,
    recruit_ratio: 0.2,
    demand_band: 'normal',
    sector_id: 'hoan',
    education_pct: {
      [EDU.highSchool]: 5,
      [EDU.university]: 100,
      [EDU.masters]: 40,
      [EDU.doctorate]: 40,
    },
    employment_type: {
      [EMP.regular]: 100,
      [EMP.selfEmployedFreelance]: 10,
      [EMP.executive]: 15,
    },
    certs: ['A', 'B', 'C', 'D'],
    hourly_wage: 4000,
  }),
  occupation({
    id: 9,
    ai_risk: 2,
    workers: 10_000,
    salary: 180,
    monthly_hours: 130,
    average_age: 27,
    recruit_wage: 15,
    recruit_ratio: 2.5,
    demand_band: 'cold',
    sector_id: 'noringyo',
    education_pct: { [EDU.highSchool]: 35 },
    employment_type: {
      [EMP.regular]: 40,
      [EMP.selfEmployedFreelance]: 21,
    },
    hourly_wage: 700,
  }),
  occupation({
    id: 10,
    ai_risk: null,
    workers: 200_000,
    salary: 2000,
    monthly_hours: 90,
    average_age: 18,
    recruit_wage: 50,
    recruit_ratio: 9,
    demand_band: 'hot',
    sector_id: 'noringyo',
    education_pct: {
      [EDU.highSchool]: 100,
      [EDU.university]: 100,
      [EDU.masters]: 50,
      [EDU.doctorate]: 50,
    },
    employment_type: {
      [EMP.regular]: 100,
      [EMP.selfEmployedFreelance]: 50,
      [EMP.executive]: 50,
    },
    certs: ['A', 'B'],
    hourly_wage: 5000,
  }),
  occupation({
    id: 11,
    ai_risk: 0,
    workers: 2_000,
    salary: 50,
    monthly_hours: 210,
    average_age: 70,
    recruit_wage: 8,
    recruit_ratio: 0,
    demand_band: 'cold',
    sector_id: 'hoan',
    education_pct: { [EDU.doctorate]: 30 },
    employment_type: { [EMP.executive]: 30 },
    hourly_wage: 500,
  }),
  occupation({
    id: 12,
    ai_risk: 5,
    workers: null,
    salary: null,
    monthly_hours: 166,
    average_age: 41,
    recruit_wage: 9,
    recruit_ratio: 1,
    demand_band: 'hot',
    sector_id: 'fukushi',
    education_pct: { [EDU.highSchool]: 29 },
    employment_type: {
      [EMP.regular]: 60,
      [EMP.selfEmployedFreelance]: 19,
    },
    hourly_wage: 900,
  }),
  occupation({
    id: 13,
    ai_risk: 7,
    workers: 1,
    salary: 500,
    sector_id: 'service',
  }),
];

const scored = occupations.filter((job) => job.ai_risk !== null);
const withSalary = occupations.filter((job) => job.salary && job.ai_risk !== null);

const expected = {
  'ai-risk-high': [1, 2, 3, 13, 4, 5, 12, 6, 7, 8, 9, 11],
  'ai-risk-low': [11, 8, 9, 7, 6, 4, 5, 12, 13, 3, 1, 2],
  'salary-safe': [8, 6, 4, 5, 7, 9, 11],
  workers: [10, 3, 1, 4, 5, 2, 6, 8, 7, 9, 11, 13],
  salary: [10, 8, 1, 2, 3, 4, 5, 6, 13, 7, 9, 11],
  'entry-salary': [10, 8, 1, 2, 4, 3, 5, 6, 9, 7, 12, 11],
  'young-workforce': [10, 7, 9, 5, 6, 4, 12, 2, 3, 1, 8, 11],
  'short-hours': [10, 7, 9, 5, 6, 4, 12, 3, 2, 1, 8, 11],
  'high-demand': [10, 3, 4, 5, 7, 12, 8, 2, 1, 6, 9, 11],
  'hourly-wage': [10, 8, 1, 2, 4, 3, 6, 5, 12, 7, 9, 11],
  'recruit-ratio': [10, 7, 6, 9, 4, 5, 2, 12, 3, 1, 8, 11],
  'aging-workforce': [11, 8, 1, 3, 2, 12, 4, 6, 5, 9, 7, 10],
  'monthly-hours-long': [11, 8, 1, 2, 3, 12, 4, 6, 5, 9, 7, 10],
  'recruit-ratio-low': [11, 8, 1, 3, 12, 2, 5, 4, 9, 6, 7, 10],
  'ai-replaced-soon': [1, 2, 3],
  'ai-resistant-craft': [9, 7],
  'ai-at-risk-but-paid': [1, 2, 3, 13],
  'ai-augmented': [4, 5, 6, 12],
  'ai-frontier': [2, 4],
  'ai-stable-employment': [8, 4, 5, 6, 12],
  'ai-safe-high-demand': [7, 4, 5, 12],
  'ai-safe-short-hours': [7, 9, 5, 6, 4, 12, 8, 11],
  'ai-safe-young-workforce': [7, 9, 5, 6, 4, 12, 8, 11],
  'ai-safe-no-license': [11, 9, 7, 5, 12],
  'ai-safe-physical': [9, 7, 5],
  'ai-safe-interpersonal': [6, 12],
  'high-salary-high-demand': [3, 4, 5, 7],
  'high-salary-young-entry': [10, 4, 5, 6, 9, 7],
  'license-required': [8, 3, 10, 4, 2, 6],
  'no-license-required': [11, 9, 7, 5, 12],
  'high-school-ok': [10, 7, 5, 6, 9, 3],
  'university-required': [10, 8, 4, 3, 6],
  'graduate-school-required': [10, 8, 5, 3, 6, 11],
  'public-sector': [8, 11],
  'freelance-friendly': [10, 7, 5, 9, 3],
  'self-employed-typical': [10, 7, 3, 6, 11],
  'large-workforce-stable': [4, 5],
  'regulated-protected': [8, 4],
  'low-stress-stable': [7, 9, 5, 6, 4],
} as const satisfies Record<RankingSlug, readonly number[]>;

test('me-positions fixture lists every RankingSlug', () => {
  const slugs = RANKING_META.map((meta) => meta.slug).sort();
  const covered = (Object.keys(expected) as RankingSlug[]).sort();
  assert.deepEqual(covered, slugs);
  assert.equal(covered.length, 39);
});

for (const slug of Object.keys(expected) as RankingSlug[]) {
  test(`me-positions ranks ${slug} from the occupation fixture`, () => {
    assert.deepEqual(
      rankIdsForSlug(slug, scored, occupations, withSalary),
      [...expected[slug]],
      slug,
    );
  });
}

test('me-positions build writes a temp payload without touching data/', { timeout: 180_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'me-positions-'));
  const repoData = join(process.cwd(), 'data');
  try {
    const result = await buildMePositions(dir);
    const outPath = join(dir, 'data.me-positions.json');
    assert.deepEqual(result.files, [outPath]);
    assert.equal(outPath.startsWith(repoData), false);
    assert.equal(result.rankingCount, RANKING_META.length);
    assert.ok(result.jobCount > 0);

    const payload = JSON.parse(await readFile(outPath, 'utf8')) as {
      meta: {
        schema_version: string;
        generated_at: string;
        record_count: number;
        ranking_count: number;
        universe_size: number;
      };
      rankings: Array<{ slug: RankingSlug; universe_scope: 'all' | 'eligible' }>;
      positions: Record<string, JobPositions>;
    };

    assert.equal(payload.meta.schema_version, '1.1');
    assert.equal(typeof payload.meta.generated_at, 'string');
    assert.equal(payload.meta.record_count, result.jobCount);
    assert.equal(payload.meta.ranking_count, result.rankingCount);
    assert.equal(payload.meta.universe_size, result.jobCount);
    assert.equal(payload.rankings.length, RANKING_META.length);

    for (const ranking of payload.rankings) {
      assert.equal(ranking.universe_scope, rankingUniverseScope(ranking.slug), ranking.slug);
    }

    const positions = Object.values(payload.positions);
    assert.equal(positions.length, result.jobCount);
    const publicUniverse = positions[0]?.inRankings['public-sector']?.universeSize;
    assert.equal(typeof publicUniverse, 'number');
    assert.ok(publicUniverse! > 0 && publicUniverse! < payload.meta.universe_size);

    for (const position of positions) {
      assert.equal(Object.keys(position.inRankings).length, RANKING_META.length);
      for (const slug of Object.keys(expected) as RankingSlug[]) {
        const slot = position.inRankings[slug];
        assert.ok(slot, slug);
        if (slug === 'ai-risk-high' || slug === 'ai-risk-low') {
          assert.equal(slot!.universeSize, payload.meta.universe_size, slug);
        }
        if (slot!.outOfUniverse === null) {
          assert.equal(slot!.percentile, null, slug);
        } else {
          const percentile = Math.round(((slot!.outOfUniverse / slot!.universeSize) * 100) * 10) / 10;
          assert.equal(slot!.percentile, percentile, slug);
          assert.ok(slot!.outOfUniverse >= 1 && slot!.outOfUniverse <= slot!.universeSize);
        }
        if (slot!.rank !== null) {
          assert.ok(slot!.rank >= 1 && slot!.rank <= slot!.total);
        }
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
