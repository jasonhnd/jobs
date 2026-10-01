import { afterEach, beforeEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { OccupationSchema, StatsLegacySchema, type Occupation } from '../schema/index.js';
import { EDU_LABELS_EN_TO_JA, EMP_LABELS_EN_TO_JA } from '../domain/distribution-labels.js';
import { buildTreemap } from './treemap.js';
import { buildTransferPaths } from './transfer_paths.js';
import { buildSearch } from './search.js';
import { buildProfile5 } from './profile5.js';
import { buildSkills } from './skills.js';
import { buildHolland } from './holland.js';
import { buildLabels } from './labels.js';
import { buildHaidSpec, buildHaidSpecPayload } from './haid-spec.js';
import {
  HAID_BOUNDARIES, HAID_CANONICAL_PATH, HAID_CASES, HAID_CERTAINTY_JA, HAID_GRADE_JA,
  HAID_LEVELS, HAID_LICENSE, HAID_LICENSE_URL, HAID_NAME_EN, HAID_NAME_JA, HAID_RELATIONS,
  HAID_SPEC_DATE, HAID_SPEC_VERSION, HAID_TERMS, HAID_WINDOW_JA,
} from '../../site/haid-spec.js';

function occupation(id: number, overrides: Partial<Occupation> = {}): Occupation {
  return OccupationSchema.parse({
    id, ipd_id: `IPD_01_01_${id}`, ingested_at: '2026-10-02',
    title_ja: `Fixture ${id}`, aliases_ja: [`Alias ${id}`],
    classifications: {}, description: {}, url: `https://example.test/jobs/${id}`,
    data_source_versions: {
      ipd_numeric: '7.00', ipd_description: '7.00', ipd_retrieved_at: '2026-10-02',
    },
    ...overrides,
  });
}

function indexes(occupations: Occupation[] = []): Indexes {
  return {
    occById: new Map(occupations.map((occ) => [occ.id, occ])),
    transById: new Map(), statsById: new Map(), historyByOcc: new Map(),
    latestScoreByOcc: new Map(), flagshipByOcc: new Map(), canonicalScoreByOcc: new Map(),
    runsByModel: new Map(), labelsByDim: new Map(), sectors: [],
    sectorOverrides: new Map(), sectorByOcc: new Map(),
  };
}

function score(input: Indexes, id: number, risk: number): void {
  input.canonicalScoreByOcc.set(id, {
    model: 'fixture', provider: 'fixture', date: '2026-10-02', backfill: false,
    ai_risk: risk, rationale_ja: `Rationale ${id}`, confidence: null, aiois: null,
  });
}

describe('data projection files', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'JOB_0063-projections-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  // Parse the on-disk result, so serialization and returned file paths are tested too.
  async function json(path: string) {
    const text = await readFile(path, 'utf8');
    assert.equal(text.endsWith('\n'), true);
    return JSON.parse(text);
  }

  test('treemap filters incomplete rows, preserves legacy fields, and ranks ten risks with id ties', async () => {
    const input = indexes(Array.from({ length: 14 }, (_, i) => occupation(14 - i)));
    for (let id = 1; id <= 13; id++) {
      input.statsById.set(id, StatsLegacySchema.parse({ id, source: 'fixture' }));
    }
    for (let id = 1; id <= 12; id++) score(input, id, id <= 2 ? 10 : 8);
    score(input, 14, 10); // No stats; id 13 has stats but no canonical score.
    // A latest observation must not replace the canonical public score.
    input.latestScoreByOcc.set(3, { ...input.canonicalScoreByOcc.get(3)!, ai_risk: 1 });
    input.occById.set(1, occupation(1, {
      education_distribution: { high_school: 0.125, university: 0.8765, unknown: 0.1 },
      employment_type: { regular_employee: 0.5, unknown: 0.2, unmapped: 0.3 },
    }));
    input.statsById.set(1, StatsLegacySchema.parse({
      id: 1, source: 'fixture', salary_man_yen: 450, workers: 120_000,
      monthly_hours: 160, average_age: 40, recruit_wage_man_yen: 25, recruit_ratio: 2,
    }));
    input.sectors.push({ id: 'test', ja: 'Sector fixture', en: 'Sector fixture', hue: 'safe', mhlw_seed_codes: [] });
    input.sectorByOcc.set(1, { sector_id: 'test', provenance: 'override', matched_seeds: [], candidates: [] });
    input.sectorByOcc.set(2, { sector_id: 'missing', provenance: 'override', matched_seeds: [], candidates: [] });

    const result = await buildTreemap(input, root);
    assert.deepEqual(result, {
      files: ['data.treemap.json', 'data.top10.json', 'data.treemap.meta.json'].map((f) => join(root, f)),
      rows: 12, top10Rows: 10,
    });
    const rows = await json(result.files[0]!);
    assert.deepEqual(rows.map((row: { id: number }) => row.id), Array.from({ length: 12 }, (_, i) => i + 1));
    assert.deepEqual(rows[0], {
      id: 1, name_ja: 'Fixture 1', salary: 450, workers: 120_000, hours: 160, age: 40,
      recruit_wage: 25, recruit_ratio: 2, hourly_wage: null, ai_risk: 10,
      ai_rationale_ja: 'Rationale 1',
      education_pct: { [EDU_LABELS_EN_TO_JA.high_school!]: 12.5, [EDU_LABELS_EN_TO_JA.university!]: 87.6 },
      employment_type: { [EMP_LABELS_EN_TO_JA.regular_employee!]: 50, [EMP_LABELS_EN_TO_JA.unknown!]: 20 },
      sector_id: 'test', sector_ja: 'Sector fixture', hue: 'safe',
      risk_band: 'high', workforce_band: 'large', demand_band: 'hot',
      url: 'https://example.test/jobs/1',
    });
    assert.partialDeepStrictEqual(rows[1], { salary: null, workers: null, sector_id: 'missing', sector_ja: null, hue: null });
    assert.partialDeepStrictEqual(rows[2], { ai_risk: 8, education_pct: null, employment_type: null, sector_id: null });
    const top10 = await json(result.files[1]!);
    assert.deepEqual(top10.map((row: { id: number }) => row.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(top10[0], { id: 1, name_ja: 'Fixture 1', salary: 450, workers: 120_000, ai_risk: 10, ai_rationale_ja: 'Rationale 1' });
    assert.partialDeepStrictEqual(await json(result.files[2]!), { schema_version: '2.0', record_count: 12, top10_count: 10 });
  });

  test('search includes missing data and preserves legacy worker bucket boundaries', async () => {
    const input = indexes([6, 5, 4, 3, 2, 1].map((id) => occupation(id)));
    for (const [id, workers] of [[1, 99_999], [2, 100_000], [3, 1_000_000], [4, 1_000_001]] as const) {
      input.statsById.set(id, StatsLegacySchema.parse({ id, source: 'fixture', workers }));
    }
    input.statsById.set(5, StatsLegacySchema.parse({ id: 5, source: 'fixture', workers: null }));
    score(input, 1, 7.25);
    input.sectorByOcc.set(1, { sector_id: 'test', provenance: 'override', matched_seeds: [], candidates: [] });
    const result = await buildSearch(input, root);
    assert.deepEqual(result, { files: [join(root, 'data.search.json')], documents: 6 });
    const payload = await json(result.files[0]!);
    assert.ok(Number.isFinite(Date.parse(payload.generated_at)));
    assert.partialDeepStrictEqual(payload, { schema_version: '1.2', document_count: 6 });
    assert.deepEqual(payload.documents.map((d: { id: number }) => d.id), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(payload.documents.map((d: { category_size: string | null }) => d.category_size), ['small', 'medium', 'medium', 'large', null, null]);
    assert.deepEqual(payload.documents[0], { id: 1, title_ja: 'Fixture 1', aliases_ja: ['Alias 1'], sector_id: 'test', risk_band: 'high', workforce_band: 'mid', category_size: 'small', ai_risk: 7.25 });
    assert.deepEqual(payload.documents[5], { id: 6, title_ja: 'Fixture 6', aliases_ja: ['Alias 6'], sector_id: null, risk_band: null, workforce_band: null, category_size: null, ai_risk: null });
  });

  test('profile5 serializes all axes and counts null axes without filling missing values with zero', async () => {
    const input = indexes([
      occupation(2),
      occupation(1, {
        skills: { active_learning: 2, social_perceptiveness: 0, critical_thinking: 3 },
        abilities: { originality: 4, static_strength: 7 },
        work_characteristics: { repetitive_tasks: 1 },
      }),
    ]);
    const result = await buildProfile5(input, root);
    const axes = ['creative', 'social', 'judgment', 'physical', 'routine'];
    assert.deepEqual(result, { files: [join(root, 'data.profile5.json')], occupations: 2, axes, nullAxes: Object.fromEntries(axes.map((a) => [a, 1])) });
    const payload = await json(result.files[0]!);
    assert.ok(Number.isFinite(Date.parse(payload.generated_at)));
    assert.partialDeepStrictEqual(payload, { schema_version: '1.0', axis_count: 5, occupation_count: 2, null_axes_per_dimension: result.nullAxes });
    assert.deepEqual(payload.profiles, {
      '1': { creative: 60, social: 0, judgment: 60, physical: 100, routine: 20 },
      '2': { creative: null, social: null, judgment: null, physical: null, routine: null },
    });
    assert.deepEqual(Object.keys(payload.axis_definitions), axes);
    assert.deepEqual(payload.axis_definitions.creative, ['work_activities.thinking_creatively', 'abilities.originality', 'abilities.fluency_of_ideas', 'skills.active_learning']);
  });

  test('skills ranks descending with numeric id ties, keeps zero, and skips absent skills', async () => {
    const input = indexes([
      occupation(3, { skills: { active_learning: 3, coordination: 0 } }),
      occupation(2, { skills: { active_learning: 5 } }),
      occupation(1, { skills: { active_learning: 3 } }),
      occupation(4, { skills: null }), occupation(5, { skills: {} }),
    ]);
    input.labelsByDim.set('skills', new Map([
      ['active_learning', { ja: 'Learning fixture', en: 'Unused translation' }],
      ['coordination', { ja: 'Coordination fixture', en: 'Unused translation' }],
      ['empty', { ja: 'Empty fixture', en: 'Unused translation' }],
    ]));
    const result = await buildSkills(input, root);
    assert.equal(result.skillFiles, 3);
    assert.equal(result.dir, join(root, 'data.skills'));
    assert.deepEqual(result.files, ['active_learning.json', 'coordination.json', 'empty.json', '_index.json'].map((f) => join(result.dir, f)));
    assert.deepEqual(await json(result.files[0]!), { skill_key: 'active_learning', label_ja: 'Learning fixture', occupations: [
      { id: 2, name_ja: 'Fixture 2', score: 5 }, { id: 1, name_ja: 'Fixture 1', score: 3 }, { id: 3, name_ja: 'Fixture 3', score: 3 },
    ] });
    assert.deepEqual(await json(result.files[1]!), { skill_key: 'coordination', label_ja: 'Coordination fixture', occupations: [{ id: 3, name_ja: 'Fixture 3', score: 0 }] });
    assert.partialDeepStrictEqual(await json(result.files[2]!), { occupations: [] });
    assert.deepEqual(await json(result.indexFile), { schema_version: '1.0', skills: [
      { key: 'active_learning', label_ja: 'Learning fixture' }, { key: 'coordination', label_ja: 'Coordination fixture' }, { key: 'empty', label_ja: 'Empty fixture' },
    ] });
  });

  test('skills with no label dimension writes only an empty index', async () => {
    const result = await buildSkills(indexes([occupation(1, { skills: { active_learning: 5 } })]), root);
    assert.equal(result.skillFiles, 0);
    assert.deepEqual(result.files, [result.indexFile]);
    assert.deepEqual(await readdir(result.dir), ['_index.json']);
    assert.deepEqual(await json(result.indexFile), { schema_version: '1.0', skills: [] });
  });

  test('holland preserves column order, sorts ids, omits null blocks, and serializes missing keys as null', async () => {
    const input = indexes([
      occupation(3, { interests: { realistic: 1, investigative: 2, artistic: 3, social: 4, enterprising: 5, conventional: 6 } }),
      occupation(2, { interests: null }), occupation(1, { interests: { social: 0 } }), occupation(4),
    ]);
    const result = await buildHolland(input, root);
    assert.deepEqual(result, { files: [join(root, 'data.holland.json')], rows: 2 });
    assert.partialDeepStrictEqual(await json(result.files[0]!), { schema_version: '1.0', row_count: 2, cols: ['id', 'name_ja', 'R', 'I', 'A', 'S', 'E', 'C'], rows: [
      [1, 'Fixture 1', null, null, null, 0, null, null], [3, 'Fixture 3', 1, 2, 3, 4, 5, 6],
    ] });
  });

  test('labels emits only the JA dictionary and retains empty dimensions and insertion order', async () => {
    const input = indexes();
    input.labelsByDim.set('skills', new Map([['b', { ja: 'B fixture', en: 'English B' }], ['a', { ja: 'A fixture', en: 'English A' }]]));
    input.labelsByDim.set('interests', new Map());
    const result = await buildLabels(input, root);
    assert.deepEqual(result, { files: [join(root, 'data.labels/ja.json')], dimensions: 2 });
    const payload = await json(result.files[0]!);
    assert.ok(Number.isFinite(Date.parse(payload.generated_at)));
    assert.deepEqual(payload, { schema_version: '1.0', lang: 'ja', generated_at: payload.generated_at, skills: { b: 'B fixture', a: 'A fixture' }, interests: {} });
    assert.deepEqual(Object.keys(payload.skills), ['b', 'a']);
    assert.deepEqual(await readdir(join(root, 'data.labels')), ['ja.json']);
  });

  test('transfer paths serializes primary and all fallback summaries without adding a null fallback', async () => {
    const input = indexes([
      occupation(4, { skills: { unrelated: 5 } }), occupation(3),
      occupation(2, { skills: { a: 3, b: 4 } }), occupation(1, { skills: { a: 3, b: 4 } }),
    ]);
    for (const [id, risk] of [[1, 8], [2, 2], [3, 4], [4, 6]] as const) {
      score(input, id, risk);
      input.sectorByOcc.set(id, { sector_id: 'test', provenance: 'override', matched_seeds: [], candidates: [] });
    }
    const result = await buildTransferPaths(input, root);
    const summary = { total_sources: 4, primary: 1, fallback_no_safer_in_sector: 1, fallback_no_skills: 1, no_candidates: 1 };
    assert.deepEqual(result, { files: [join(root, 'data.transfer_paths.json')], sources: 4, summary });
    const payload = await json(result.files[0]!);
    assert.ok(Number.isFinite(Date.parse(payload.generated_at)));
    assert.partialDeepStrictEqual(payload, { schema_version: '1.0', summary, rule: { top_n: 5, min_risk_drop: 1, min_similarity: 0.3, ranking_metric: 'cosine_similarity_over_skills', candidate_pool: 'same_sector_id' } });
    assert.deepEqual(payload.paths, {
      '1': { source_id: 1, candidates: [{ id: 2, title_ja: 'Fixture 2', ai_risk: 2, similarity: 1, sector_id: 'test' }] },
      '2': { source_id: 2, candidates: [{ id: 1, title_ja: 'Fixture 1', ai_risk: 8, similarity: 1, sector_id: 'test' }], fallback: 'no_safer_in_sector' },
      '3': { source_id: 3, candidates: [], fallback: 'no_skills' },
      '4': { source_id: 4, candidates: [], fallback: 'no_similar_in_sector' },
    });
  });

  test('HAID spec includes every canonical definition, writes formatted JSON, and has no release counts', async () => {
    const expected = {
      schema_version: '1.0.0', standard: 'HAID', name_ja: HAID_NAME_JA, name_en: HAID_NAME_EN,
      version: HAID_SPEC_VERSION, published: HAID_SPEC_DATE, license: HAID_LICENSE, license_url: HAID_LICENSE_URL,
      url: `https://mirai-shigoto.com${HAID_CANONICAL_PATH}`, relations: HAID_RELATIONS,
      levels: HAID_LEVELS, boundaries: HAID_BOUNDARIES, terms: HAID_TERMS,
      window_labels_ja: HAID_WINDOW_JA, grade_labels_ja: HAID_GRADE_JA,
      certainty_labels_ja: HAID_CERTAINTY_JA, cases: HAID_CASES,
    };
    assert.deepEqual(buildHaidSpecPayload(), expected);
    const result = await buildHaidSpec(root);
    assert.deepEqual(result, { files: [join(root, 'data.haid-spec.json')], rows: HAID_LEVELS.length });
    assert.deepEqual(await json(result.files[0]!), expected);
    assert.equal(await readFile(result.files[0]!, 'utf8'), JSON.stringify(expected, null, 2) + '\n');
    assert.equal(Object.hasOwn(expected, 'counts'), false);
  });

  test('empty inputs still write valid zero-count projection envelopes', async () => {
    const input = indexes();
    const treemap = await buildTreemap(input, root);
    assert.deepEqual(await json(treemap.files[0]!), []);
    assert.deepEqual(await json(treemap.files[1]!), []);
    assert.partialDeepStrictEqual(await json(treemap.files[2]!), { record_count: 0, top10_count: 0 });
    const search = await buildSearch(input, root);
    assert.partialDeepStrictEqual(await json(search.files[0]!), { document_count: 0, documents: [] });
    const profile = await buildProfile5(input, root);
    assert.partialDeepStrictEqual(await json(profile.files[0]!), { occupation_count: 0, profiles: {}, null_axes_per_dimension: { creative: 0, social: 0, judgment: 0, physical: 0, routine: 0 } });
    const transfer = await buildTransferPaths(input, root);
    assert.partialDeepStrictEqual(await json(transfer.files[0]!), { paths: {}, summary: { total_sources: 0, primary: 0, fallback_no_safer_in_sector: 0, fallback_no_skills: 0, no_candidates: 0 } });
    const holland = await buildHolland(input, root);
    assert.partialDeepStrictEqual(await json(holland.files[0]!), { row_count: 0, rows: [] });
    const labels = await buildLabels(input, root);
    assert.equal(labels.dimensions, 0);
    assert.deepEqual(Object.keys(await json(labels.files[0]!)), ['schema_version', 'lang', 'generated_at']);
  });
});
