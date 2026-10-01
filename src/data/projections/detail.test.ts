import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import type { SectorAssignment } from '../../graph/sector-resolver.js';
import type { FlagshipMeanScore, ScoreHistEntry } from '../../graph/score-strategy.js';
import type { Aiois10 } from '../../graph/types.js';
import { DetailRecordSchema } from '../../lib/og-helpers.js';
import { DetailFileSchema } from '../../lib/projection-schemas.js';
import type { Indexes } from '../lib/indexes.js';
import type { LabelEntry } from '../schema/labels.js';
import { OccupationSchema, type Occupation } from '../schema/occupation.js';
import type { SectorDef } from '../schema/sector.js';
import { StatsLegacySchema, type StatsLegacy } from '../schema/stats-legacy.js';
import { buildDetail, topN } from './detail.js';

const DETAIL_KEYS = [
  'id',
  'schema_version',
  'title',
  'classifications',
  'sector',
  'risk_band',
  'workforce_band',
  'demand_band',
  'description',
  'ai_risk',
  'consensus_transformation',
  'latest_transformation',
  'latest_delta',
  'stale_vote',
  'consensus_vendor_count',
  'stats',
  'skills_top10',
  'knowledge_top5',
  'abilities_top5',
  'work_values_top5',
  'work_characteristics_top5',
  'training_pre_top5',
  'training_post_top5',
  'experience_top5',
  'education_distribution',
  'employment_type',
  'tasks_count',
  'tasks_lead_ja',
  'related_orgs',
  'related_certs_ja',
  'url',
  'data_source_versions',
] as const;

const ZERO_DIMS = {
  d1: 0, d2: 0, d3: 0, d4: 0, d5: 0,
  d6: 0, d7: 0, d8: 0, d9: 0, d10: 0,
};

function label(ja: string): LabelEntry {
  return { ja, en: ja };
}

function occupation(id: number, overrides: Record<string, unknown> = {}): Occupation {
  return OccupationSchema.parse({
    id,
    ipd_id: `IPD_01_01_${id}`,
    schema_version: '7.00',
    ingested_at: '2026-01-01',
    title_ja: `職業${id}`,
    aliases_ja: [],
    classifications: {
      mhlw_main: null,
      mhlw_all: [],
      jsoc_main: null,
      jsoc_all: [],
    },
    description: {
      summary_ja: null,
      what_it_is_ja: null,
      how_to_become_ja: null,
      working_conditions_ja: null,
    },
    interests: null,
    work_values: null,
    skills: null,
    knowledge: null,
    abilities: null,
    work_characteristics: null,
    work_activities: null,
    education_distribution: null,
    training_pre: null,
    training_post: null,
    experience: null,
    employment_type: null,
    tasks_lead_ja: null,
    tasks: [],
    related_orgs: [],
    related_certs_ja: [],
    url: `https://example.test/occ/${id}`,
    data_source_versions: {
      ipd_numeric: 'v7.00',
      ipd_description: 'v7.00',
      ipd_retrieved_at: '2026-01-01',
    },
    last_updated_per_section: {},
    ...overrides,
    id,
    ipd_id: `IPD_01_01_${id}`,
  });
}

function stats(id: number, overrides: Record<string, unknown> = {}): StatsLegacy {
  return StatsLegacySchema.parse({
    id,
    schema_version: '1.0',
    source: 'fixture',
    salary_man_yen: null,
    workers: null,
    monthly_hours: null,
    average_age: null,
    recruit_wage_man_yen: null,
    recruit_ratio: null,
    ...overrides,
    id,
  });
}

function scoreEntry(overrides: Partial<ScoreHistEntry> = {}): ScoreHistEntry {
  return {
    model: 'fixture-model',
    provider: 'fixture',
    date: '2026-05-01',
    ai_risk: 3.2,
    rationale_ja: 'fixture rationale',
    aiois: null,
    ...overrides,
  };
}

function flagship(overrides: Partial<FlagshipMeanScore> = {}): FlagshipMeanScore {
  const latest = overrides.latest ?? scoreEntry();
  return {
    transformation: 4.4,
    displacement: 1,
    dims: ZERO_DIMS,
    panel: [
      { provider: 'fixture', model: 'fixture-model', date: '2026-05-01', transformation: 4.4 },
    ],
    staleVendors: [],
    rationaleEntry: latest,
    latest,
    latestDelta: 0.2,
    ...overrides,
  };
}

function assignment(
  sectorId: string,
  provenance: SectorAssignment['provenance'],
): SectorAssignment {
  return {
    sector_id: sectorId,
    provenance,
    matched_seeds: provenance === 'auto' ? ['12_*'] : [],
    candidates: [sectorId],
  };
}

function indexes(partial: {
  occById?: Map<number, Occupation>;
  statsById?: Map<number, StatsLegacy>;
  canonicalScoreByOcc?: Map<number, ScoreHistEntry>;
  flagshipByOcc?: Map<number, FlagshipMeanScore>;
  labelsByDim?: Map<string, Map<string, LabelEntry>>;
  sectors?: SectorDef[];
  sectorByOcc?: Map<number, SectorAssignment>;
} = {}): Indexes {
  return {
    occById: partial.occById ?? new Map(),
    transById: new Map(),
    statsById: partial.statsById ?? new Map(),
    historyByOcc: new Map(),
    latestScoreByOcc: new Map(),
    flagshipByOcc: partial.flagshipByOcc ?? new Map(),
    canonicalScoreByOcc: partial.canonicalScoreByOcc ?? new Map(),
    runsByModel: new Map(),
    labelsByDim: partial.labelsByDim ?? new Map(),
    sectors: partial.sectors ?? [],
    sectorOverrides: new Map(),
    sectorByOcc: partial.sectorByOcc ?? new Map(),
  };
}

async function withTempRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'jobs-detail-'));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function readWritten(dir: string, id: number): Promise<Record<string, unknown>> {
  const text = await readFile(join(dir, `${String(id).padStart(4, '0')}.json`), 'utf8');
  assert.equal(text.endsWith('\n'), true);
  assert.equal(text.endsWith('\n\n'), false);
  const raw = JSON.parse(text) as Record<string, unknown>;
  DetailRecordSchema.parse(raw);
  DetailFileSchema.parse(raw);
  assert.deepEqual(Object.keys(raw), [...DETAIL_KEYS]);
  return raw;
}

describe('topN', () => {
  test('returns null for nullish blocks', () => {
    assert.equal(topN(null, new Map(), 3), null);
    assert.equal(topN(undefined, new Map(), 3), null);
  });

  test('sorts by score descending, breaks ties by key, labels entries, and slices', () => {
    const labels = new Map<string, LabelEntry>([
      ['a_key', label('A label')],
      ['c_key', label('C label')],
    ]);

    assert.deepEqual(
      topN(
        {
          z_key: 1,
          c_key: 3,
          a_key: 3,
          b_key: 2,
        },
        labels,
        3,
      ),
      [
        { key: 'a_key', label_ja: 'A label', score: 3 },
        { key: 'c_key', label_ja: 'C label', score: 3 },
        { key: 'b_key', label_ja: 'b_key', score: 2 },
      ],
    );
  });
});

describe('buildDetail', () => {
  test('writes nothing when there are no occupations', async () => {
    await withTempRoot(async (root) => {
      const result = await buildDetail(indexes(), root);
      assert.equal(result.fileCount, 0);
      assert.deepEqual(result.files, []);
      assert.equal(result.dir, join(root, 'data.detail'));
      assert.deepEqual(await readdir(result.dir), []);
    });
  });

  test('projects full, absent, and partial occupations into temp files', async () => {
    const aiois: Aiois10 = {
      ...ZERO_DIMS,
      transformation: 6.5,
      displacement: 2,
    };
    const sector: SectorDef = {
      id: 'iryo',
      ja: '医療',
      en: 'Medical',
      hue: 'safe',
      description_ja: null,
      mhlw_seed_codes: ['12_*'],
    };
    const full = occupation(20, {
      title_ja: '医師',
      aliases_ja: ['医者'],
      classifications: {
        mhlw_main: '12_072-06',
        mhlw_all: ['12_072-06', '12_072-07'],
        jsoc_main: 'H533',
        jsoc_all: ['H533'],
      },
      description: {
        summary_ja: '要約',
        what_it_is_ja: '内容',
        how_to_become_ja: '経路',
        working_conditions_ja: '条件',
      },
      skills: {
        s10: 6.5,
        s9: 6,
        s8: 5.5,
        s7: 5,
        tie_b: 4,
        tie_a: 4,
        mid: 3,
        s6: 2.5,
        s5: 2,
        low: 1,
        dropped: 0.5,
      },
      knowledge: { k_f: 0, k_b: 1, k_a: 1, k_e: 2, k_d: 2, k_c: 3 },
      abilities: { reading: 2 },
      work_values: { achievement: 1 },
      work_characteristics: { structured: 3 },
      training_pre: { university: 0.4 },
      training_post: { on_the_job: 0.2 },
      experience: { related: 0.1 },
      education_distribution: { university: 0.6, high_school: 0.4 },
      employment_type: { regular: 0.8 },
      tasks_lead_ja: '主な作業',
      tasks: [
        { task_id: 1, description_ja: '作業A', execution_rate: 0.5, importance: 3 },
        { task_id: 2, description_ja: '作業B', execution_rate: null, importance: null },
      ],
      related_orgs: [
        { name_ja: '団体', url: 'https://example.test/org' },
        { name_ja: '無URL', url: null },
      ],
      related_certs_ja: ['資格'],
      url: 'https://example.test/occ/20',
      data_source_versions: {
        ipd_numeric: 'v7.00',
        ipd_description: 'v7.01',
        ipd_retrieved_at: '2026-04-01',
      },
    });
    const absent = occupation(3);
    const partial = occupation(7, {
      title_ja: '未分類',
      skills: null,
    });

    await withTempRoot(async (root) => {
      const result = await buildDetail(indexes({
        occById: new Map([
          [20, full],
          [3, absent],
          [7, partial],
        ]),
        statsById: new Map([
          [20, stats(20, {
            source: 'jobtag-fixture',
            salary_man_yen: 800,
            workers: 50_000,
            monthly_hours: 160,
            average_age: 42,
            recruit_wage_man_yen: 30,
            recruit_ratio: 2.5,
          })],
          [7, stats(7, { source: 'partial-fixture' })],
        ]),
        canonicalScoreByOcc: new Map([
          [20, scoreEntry({
            model: 'canonical-model',
            date: '2026-06-01',
            ai_risk: 3.2,
            rationale_ja: '正典理由',
          })],
        ]),
        flagshipByOcc: new Map([
          [20, flagship({
            transformation: 4.4,
            latestDelta: 0.2,
            staleVendors: ['old-vendor'],
            latest: scoreEntry({ aiois }),
          })],
          [7, flagship({
            transformation: 1.25,
            latestDelta: -0.4,
            staleVendors: [],
            panel: [
              { provider: 'a', model: 'a-model', date: '2026-01-01', transformation: 1 },
              { provider: 'b', model: 'b-model', date: '2026-02-01', transformation: 1.5 },
            ],
            latest: scoreEntry({ aiois: null, ai_risk: 1.25 }),
          })],
        ]),
        labelsByDim: new Map([
          ['skills', new Map([['s10', label('技能十')]])],
          ['abilities', new Map([['reading', label('読解')]])],
          ['work_characteristics', new Map([['structured', label('構造')]])],
        ]),
        sectors: [sector],
        sectorByOcc: new Map([
          [20, assignment('iryo', 'auto')],
          [7, assignment('missing_sector', 'unmatched')],
        ]),
      }), root);

      assert.equal(result.fileCount, 3);
      assert.deepEqual(
        result.files,
        [3, 7, 20].map((id) => join(result.dir, `${String(id).padStart(4, '0')}.json`)),
      );
      assert.deepEqual(
        [...await readdir(result.dir)].sort(),
        ['0003.json', '0007.json', '0020.json'],
      );

      const fullRaw = await readWritten(result.dir, 20);
      assert.equal(fullRaw.id, 20);
      assert.equal(fullRaw.schema_version, '1.2');
      assert.deepEqual(fullRaw.title, { ja: '医師', aliases_ja: ['医者'] });
      assert.deepEqual(fullRaw.classifications, {
        mhlw_main: '12_072-06',
        mhlw_all: ['12_072-06', '12_072-07'],
        jsoc_main: 'H533',
        jsoc_all: ['H533'],
      });
      assert.deepEqual(fullRaw.sector, {
        id: 'iryo',
        ja: '医療',
        hue: 'safe',
        provenance: 'auto',
      });
      assert.equal(fullRaw.risk_band, 'low');
      assert.equal(fullRaw.workforce_band, 'mid');
      assert.equal(fullRaw.demand_band, 'hot');
      assert.deepEqual(fullRaw.description, {
        summary_ja: '要約',
        what_it_is_ja: '内容',
        how_to_become_ja: '経路',
        working_conditions_ja: '条件',
      });
      assert.deepEqual(fullRaw.ai_risk, {
        score: 3.2,
        model: 'canonical-model',
        scored_at: '2026-06-01',
        rationale_ja: '正典理由',
      });
      assert.equal(fullRaw.consensus_transformation, 4.4);
      assert.equal(fullRaw.latest_transformation, 6.5);
      assert.equal(fullRaw.latest_delta, 0.2);
      assert.equal(fullRaw.stale_vote, true);
      assert.equal(fullRaw.consensus_vendor_count, 1);
      assert.deepEqual(fullRaw.stats, {
        source: 'jobtag-fixture',
        salary_man_yen: 800,
        workers: 50_000,
        monthly_hours: 160,
        average_age: 42,
        recruit_wage_man_yen: 30,
        recruit_ratio: 2.5,
      });
      assert.deepEqual(fullRaw.skills_top10, [
        { key: 's10', label_ja: '技能十', score: 6.5 },
        { key: 's9', label_ja: 's9', score: 6 },
        { key: 's8', label_ja: 's8', score: 5.5 },
        { key: 's7', label_ja: 's7', score: 5 },
        { key: 'tie_a', label_ja: 'tie_a', score: 4 },
        { key: 'tie_b', label_ja: 'tie_b', score: 4 },
        { key: 'mid', label_ja: 'mid', score: 3 },
        { key: 's6', label_ja: 's6', score: 2.5 },
        { key: 's5', label_ja: 's5', score: 2 },
        { key: 'low', label_ja: 'low', score: 1 },
      ]);
      assert.deepEqual(fullRaw.knowledge_top5, [
        { key: 'k_c', label_ja: 'k_c', score: 3 },
        { key: 'k_d', label_ja: 'k_d', score: 2 },
        { key: 'k_e', label_ja: 'k_e', score: 2 },
        { key: 'k_a', label_ja: 'k_a', score: 1 },
        { key: 'k_b', label_ja: 'k_b', score: 1 },
      ]);
      assert.deepEqual(fullRaw.abilities_top5, [
        { key: 'reading', label_ja: '読解', score: 2 },
      ]);
      assert.deepEqual(fullRaw.work_values_top5, [
        { key: 'achievement', label_ja: 'achievement', score: 1 },
      ]);
      assert.deepEqual(fullRaw.work_characteristics_top5, [
        { key: 'structured', label_ja: '構造', score: 3 },
      ]);
      assert.deepEqual(fullRaw.training_pre_top5, [
        { key: 'university', label_ja: 'university', score: 0.4 },
      ]);
      assert.deepEqual(fullRaw.training_post_top5, [
        { key: 'on_the_job', label_ja: 'on_the_job', score: 0.2 },
      ]);
      assert.deepEqual(fullRaw.experience_top5, [
        { key: 'related', label_ja: 'related', score: 0.1 },
      ]);
      assert.deepEqual(fullRaw.education_distribution, { university: 0.6, high_school: 0.4 });
      assert.deepEqual(fullRaw.employment_type, { regular: 0.8 });
      assert.equal(fullRaw.tasks_count, 2);
      assert.equal(fullRaw.tasks_lead_ja, '主な作業');
      assert.deepEqual(fullRaw.related_orgs, [
        { name_ja: '団体', url: 'https://example.test/org' },
        { name_ja: '無URL', url: null },
      ]);
      assert.deepEqual(fullRaw.related_certs_ja, ['資格']);
      assert.equal(fullRaw.url, 'https://example.test/occ/20');
      assert.deepEqual(fullRaw.data_source_versions, {
        ipd_numeric: 'v7.00',
        ipd_description: 'v7.01',
        ipd_retrieved_at: '2026-04-01',
      });

      const absentRaw = await readWritten(result.dir, 3);
      assert.equal(absentRaw.sector, null);
      assert.equal(absentRaw.risk_band, null);
      assert.equal(absentRaw.workforce_band, null);
      assert.equal(absentRaw.demand_band, null);
      assert.equal(absentRaw.ai_risk, null);
      assert.equal(absentRaw.consensus_transformation, null);
      assert.equal(absentRaw.latest_transformation, null);
      assert.equal(absentRaw.latest_delta, null);
      assert.equal(absentRaw.stale_vote, false);
      assert.equal(absentRaw.consensus_vendor_count, null);
      assert.equal(absentRaw.stats, null);
      assert.equal(absentRaw.skills_top10, null);
      assert.equal(absentRaw.knowledge_top5, null);
      assert.equal(absentRaw.abilities_top5, null);
      assert.equal(absentRaw.work_values_top5, null);
      assert.equal(absentRaw.work_characteristics_top5, null);
      assert.equal(absentRaw.training_pre_top5, null);
      assert.equal(absentRaw.training_post_top5, null);
      assert.equal(absentRaw.experience_top5, null);
      assert.equal(absentRaw.education_distribution, null);
      assert.equal(absentRaw.employment_type, null);
      assert.equal(absentRaw.tasks_count, 0);
      assert.equal(absentRaw.tasks_lead_ja, null);
      assert.deepEqual(absentRaw.related_orgs, []);
      assert.deepEqual(absentRaw.classifications, {
        mhlw_main: null,
        mhlw_all: [],
        jsoc_main: null,
        jsoc_all: [],
      });
      assert.deepEqual(absentRaw.description, {
        summary_ja: null,
        what_it_is_ja: null,
        how_to_become_ja: null,
        working_conditions_ja: null,
      });

      const partialRaw = await readWritten(result.dir, 7);
      assert.deepEqual(partialRaw.sector, {
        id: 'missing_sector',
        ja: null,
        hue: null,
        provenance: 'unmatched',
      });
      assert.equal(partialRaw.ai_risk, null);
      assert.equal(partialRaw.risk_band, null);
      assert.equal(partialRaw.workforce_band, null);
      assert.equal(partialRaw.demand_band, null);
      assert.equal(partialRaw.consensus_transformation, 1.25);
      assert.equal(partialRaw.latest_transformation, null);
      assert.equal(partialRaw.latest_delta, -0.4);
      assert.equal(partialRaw.stale_vote, false);
      assert.equal(partialRaw.consensus_vendor_count, 2);
      assert.deepEqual(partialRaw.stats, {
        source: 'partial-fixture',
        salary_man_yen: null,
        workers: null,
        monthly_hours: null,
        average_age: null,
        recruit_wage_man_yen: null,
        recruit_ratio: null,
      });
      assert.equal(partialRaw.skills_top10, null);

      const parsed = [fullRaw, absentRaw, partialRaw].map((raw) => DetailRecordSchema.parse(raw));
      assert.deepEqual(parsed.map((row) => row.id), [20, 3, 7]);
      assert.equal(parsed[0]?.title && 'ja' in parsed[0].title ? parsed[0].title.ja : undefined, '医師');
      assert.equal(parsed[0]?.ai_risk && 'score' in parsed[0].ai_risk ? parsed[0].ai_risk.score : undefined, 3.2);
      assert.equal(parsed[0]?.stats && 'workers' in parsed[0].stats ? parsed[0].stats.workers : undefined, 50_000);
      assert.equal(parsed[1]?.ai_risk ?? null, null);
      assert.equal(parsed[1]?.stats ?? null, null);
      assert.equal(parsed[2]?.ai_risk ?? null, null);
    });
  });
});
