import { afterEach, beforeEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ModelsByModelProjectionShape, ModelsDeepProjectionShape, ScoreHistoryProjectionShape } from '../../lib/projection-schemas.js';
import { checkModelsByModel, checkModelsDeep, checkScoreHistory } from './models.js';
import { Report } from './shared.js';

function historyEntry(date = '2026-01-01') {
  return { model: 'fixture', date, transformation: 5, displacement: null, dims: null };
}
function deepFixture(): ModelsDeepProjectionShape {
  const latest = { provider: 'fixture', vendorDisplay: 'fixture', model: 'fixture', modelDisplay: 'fixture',
    date: '2026-01-01', covered_count: 3, personality_sentence_id: 'fixture' };
  return {
    generated_at: 'fixture', panel: { entries: [latest], compared_count: 3 },
    lanes: [{ provider: 'fixture', vendorDisplay: 'fixture', latest, history: [] }],
    consensus: [1, 2, 3].map(id => ({ id, title_ja: 'fixture', href: `/${id}` })),
    stories: [1, 2, 3].map(id => ({ id, title_ja: 'fixture', href: `/${id}`, spread: 1,
      editorial_sentence_id: 'fixture', scores: [4, 5].map(transformation => ({ provider: 'fixture',
        model: 'fixture', modelDisplay: 'fixture', transformation, rationale_ja: 'fixture' })) })),
  };
}
function byModelFixture(): ModelsByModelProjectionShape {
  const row = { id: 1, title_ja: 'fixture', href: '/1', transformation: 5, band: 'mid' as const };
  return { generated_at: 'fixture', models: { fixture: {
    slug: 'fixture', model: 'fixture', modelDisplay: 'fixture', provider: 'fixture', in_panel: true,
    date: '2026-01-01', covered_count: 1, prompt_version: 'fixture',
    distribution: { mean_transformation: 5, median_transformation: 5,
      bands: { low: { count: 0, pct: 0 }, mid: { count: 1, pct: 100 }, high: { count: 0, pct: 0 } },
      histogram: Array.from({ length: 20 }, (_, i) => ({ from: i / 2, to: (i + 1) / 2, count: i === 10 ? 1 : 0 })) },
    highest: [row], lowest: [{ ...row }], drift: { baseline: true, note_id: 'first_aiois_batch' },
    nav: { prev: null, next: null },
  } } };
}

describe('model consistency with isolated dist fixtures', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'consistency-models-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  async function json(name: string, value: unknown): Promise<void> {
    await writeFile(join(root, name), JSON.stringify(value));
  }

  for (const [name, check] of [
    ['score_history', checkScoreHistory], ['models_deep', checkModelsDeep], ['models_by_model', checkModelsByModel],
  ] as const) {
    test(`${name} skips missing files and reports invalid JSON or schemas without telemetry`, async () => {
      const absent = new Report();
      await check(root, absent, new Set([1]));
      assert.deepEqual(absent.errors, []);
      assert.deepEqual(absent.info, []);
      await writeFile(join(root, `data.${name}.json`), '{bad');
      const malformed = new Report();
      await check(root, malformed, new Set([1]));
      assert.equal(malformed.errors.length, 1);
      assert.ok(malformed.errors[0]?.startsWith(`data.${name}.json invalid JSON: `));
      assert.deepEqual(malformed.info, []);
      await json(`data.${name}.json`, { unexpected: true });
      const invalid = new Report();
      await check(root, invalid, new Set([1]));
      assert.equal(invalid.errors.length, 1);
      assert.ok(invalid.errors[0]?.startsWith(`data.${name}.json schema invalid: `));
      assert.deepEqual(invalid.info, []);
    });
  }

  test('score history accepts legacy and complete dimension entries ordered by date', async () => {
    const current = { ...historyEntry('2026-02-01'), displacement: 4,
      dims: { d1: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7, d8: 8, d9: 9, d10: 10 } };
    const data: ScoreHistoryProjectionShape = { '1': [historyEntry(), current] };
    await json('data.score_history.json', data);
    const r = new Report();
    await checkScoreHistory(root, r, new Set([1]));
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.info, ['score_history: 1 occupations, 2 entries']);
  });

  test('score history reports key-count drift, missing/extra IDs and descending dates', async () => {
    await json('data.score_history.json', { '2': [historyEntry('2026-02-01'), historyEntry()] });
    const r = new Report();
    await checkScoreHistory(root, r, new Set([1, 3]));
    assert.deepEqual(r.errors, [
      'data.score_history.json key count (1) != total source occupations (2)',
      'data.score_history.json missing ids: 1, 3', 'data.score_history.json has unknown ids: 2',
      'data.score_history.json id=2 entries are not ordered by date ascending',
    ]);
    assert.deepEqual(r.info, ['score_history: 1 occupations, 2 entries']);
  });

  test('score history schema rejects rationale leaks and incomplete dimensions', async () => {
    for (const entry of [
      { ...historyEntry(), rationale_ja: 'fixture' },
      { ...historyEntry(), displacement: 4, dims: { d1: 1 } },
    ]) {
      await json('data.score_history.json', { '1': [entry] });
      const r = new Report();
      await checkScoreHistory(root, r, new Set([1]));
      assert.equal(r.errors.length, 1);
      assert.ok(r.errors[0]?.startsWith('data.score_history.json schema invalid: '));
    }
  });

  test('models deep accepts valid references and reports deterministic counts and bytes', async () => {
    await json('data.models_deep.json', deepFixture());
    const r = new Report();
    await checkModelsDeep(root, r, new Set([1, 2, 3]));
    assert.deepEqual(r.errors, []);
    const bytes = (await stat(join(root, 'data.models_deep.json'))).size;
    assert.deepEqual(r.info, [`models_deep: lanes=1 panel=1 consensus=3 stories=3 bytes=${bytes}`]);
  });

  test('models deep independently rejects oversized payloads, unknown references and duplicate stories', async () => {
    const data = deepFixture();
    data.stories[0]!.scores[0]!.rationale_ja = 'x'.repeat(30 * 1024);
    data.consensus[0]!.id = 9;
    data.stories[1]!.id = 9;
    data.stories[2]!.id = 9;
    await json('data.models_deep.json', data);
    const bytes = (await stat(join(root, 'data.models_deep.json'))).size;
    const r = new Report();
    await checkModelsDeep(root, r, new Set([1, 2, 3]));
    assert.deepEqual(r.errors, [
      `data.models_deep.json is ${bytes} bytes, expected <= 30720`,
      ...Array(3).fill('data.models_deep.json references unknown occupation id: 9'),
      'data.models_deep.json stories contain duplicate occupation ids',
    ]);
    assert.deepEqual(r.info, [`models_deep: lanes=1 panel=1 consensus=3 stories=3 bytes=${bytes}`]);
  });

  test('per-model payload accepts both baseline and drift references with exact telemetry', async () => {
    const data = byModelFixture();
    data.models.comparison = { ...structuredClone(data.models.fixture!), slug: 'comparison', drift: {
      predecessor: { model: 'fixture', modelDisplay: 'fixture', date: '2026-01-01', slug: 'fixture' },
      compared_count: 1, mean_delta_t: 1,
      movers: [{ id: 1, title_ja: 'fixture', href: '/1', delta_t: 1, from: 4, to: 5 }],
      band_crossings: [{ id: 1, title_ja: 'fixture', href: '/1', from_band: 'low', to_band: 'mid' }],
    } };
    await json('data.models_by_model.json', data);
    const r = new Report();
    await checkModelsByModel(root, r, new Set([1]));
    assert.deepEqual(r.errors, []);
    const bytes = Math.max(...Object.values(data.models).map(model => Buffer.byteLength(JSON.stringify(model))));
    assert.deepEqual(r.info, [`models_by_model: models=2 max_page_bytes=${bytes}`]);
  });

  test('per-model payload rejects size, slug, histogram and occupation/drift references together', async () => {
    const data = byModelFixture();
    const model = data.models.fixture!;
    model.modelDisplay = 'x'.repeat(24 * 1024);
    model.slug = 'different';
    model.covered_count = 2;
    model.highest[0]!.id = 8;
    model.lowest[0]!.id = 9;
    model.drift = {
      predecessor: { model: 'fixture', modelDisplay: 'fixture', date: '2026-01-01', slug: 'fixture' },
      compared_count: 1, mean_delta_t: 1,
      movers: [{ id: 10, title_ja: 'fixture', href: '/10', delta_t: 1, from: 4, to: 5 }],
      band_crossings: [{ id: 11, title_ja: 'fixture', href: '/11', from_band: 'low', to_band: 'mid' }],
    };
    await json('data.models_by_model.json', data);
    const bytes = Buffer.byteLength(JSON.stringify(model));
    const r = new Report();
    await checkModelsByModel(root, r, new Set([1]));
    assert.deepEqual(r.errors, [
      `data.models_by_model.json fixture page payload is ${bytes} bytes, expected <= 24576`,
      'data.models_by_model.json key fixture does not match inner slug different',
      'data.models_by_model.json fixture histogram count 1 != covered_count 2',
      'data.models_by_model.json fixture references unknown occupation id: 8',
      'data.models_by_model.json fixture references unknown occupation id: 9',
      'data.models_by_model.json fixture drift references unknown occupation id: 10',
      'data.models_by_model.json fixture drift references unknown occupation id: 11',
    ]);
    assert.deepEqual(r.info, [`models_by_model: models=1 max_page_bytes=${bytes}`]);
  });

  test('per-model strict schema rejects nested rationale leaks', async () => {
    const data = byModelFixture();
    const leaking = { ...data, models: { fixture: { ...data.models.fixture,
      highest: [{ ...data.models.fixture!.highest[0], rationale_ja: 'fixture' }] } } };
    await json('data.models_by_model.json', leaking);
    const r = new Report();
    await checkModelsByModel(root, r, new Set([1]));
    assert.equal(r.errors.length, 1);
    assert.ok(r.errors[0]?.startsWith('data.models_by_model.json schema invalid: '));
  });
});
