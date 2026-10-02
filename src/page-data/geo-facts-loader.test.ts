import { afterEach, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../data/schema/index.js';
import { computeGeoFacts, GeoTreemapRowsSchema } from '../site/geo-facts.js';
import { SCORE_ATTRIBUTION } from '../site/score-attribution.js';
import { loadGeoFacts } from './geo-facts-loader.js';

const dirs: string[] = [];
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'page-geo-facts-'));
  dirs.push(root);
  mkdirSync(join(root, 'data', 'scores'), { recursive: true });
  mkdirSync(join(root, 'public'));
  return root;
}
function write(root: string, file: string, value: unknown): void {
  writeFileSync(join(root, file), JSON.stringify(value));
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scoreRun(model = SCORE_ATTRIBUTION.modelId, date = SCORE_ATTRIBUTION.runDate): ScoreRun {
  return {
    schema_version: '2.2', scope: 'occupations',
    scorer: { model, model_provider: 'openai', scoring_method: 'fixture', scoring_method_id: 'aiois-semantic-judgment' },
    run: { run_date: date, run_id: 'fixture' },
    input: { input_data_version: 'fixture', occupation_count_scored: 1, occupation_count_skipped: 0 },
    prompt: { prompt_version: 'fixture', prompt_file: 'fixture', rubric_source: 'fixture' },
    anchors: {}, caveat: 'fixture',
    scores: {
      '7': { ai_risk: 4, rationale_ja: 'Fixture', aiois: {
        d1: 4, d2: 4, d3: 4, d4: 4, d5: 4, d6: 4, d7: 4, d8: 4, d9: 4, d10: 4,
        transformation: 4, displacement: 2,
      } },
    },
  };
}
const rows = [{ id: 7, name_ja: 'Fixture', ai_risk: 4, workers: 100, salary: 400,
  sector_id: 'fixture', sector_ja: 'Fixture' }];
function populate(root: string, run: ScoreRun = scoreRun()): void {
  write(root, 'data/scores/active.json', run);
  write(root, 'public/data.treemap.json', rows);
}

test('loads, validates, computes, and caches facts without rereading files', () => {
  const root = fixtureRoot();
  populate(root);
  writeFileSync(join(root, 'data/scores/README.txt'), 'not JSON');
  const facts = loadGeoFacts(root);
  assert.equal(facts.occupationCount, 1);
  assert.equal(facts.totalWorkforce, 100);
  assert.equal(facts.meanAiImpactRaw, 4);
  assert.equal(facts.meanDisplacementRisk, 2);
  assert.equal(facts.occupations[0].id, 7);
  assert.equal(facts.attribution.modelId, SCORE_ATTRIBUTION.modelId);
  assert.equal(facts.attribution.runDate, SCORE_ATTRIBUTION.runDate);
  rmSync(join(root, 'data'), { recursive: true });
  rmSync(join(root, 'public'), { recursive: true });
  assert.equal(loadGeoFacts(root), facts);
});

test('roots are isolated from each other and from the default build facts', () => {
  const a = fixtureRoot();
  const b = fixtureRoot();
  populate(a);
  populate(b);
  write(b, 'public/data.treemap.json', [{ ...rows[0], workers: 200 }]);
  const first = loadGeoFacts(a);
  const second = loadGeoFacts(b);
  assert.notEqual(first, second);
  assert.equal(first.totalWorkforce, 100);
  assert.equal(second.totalWorkforce, 200);
  const root = process.cwd();
  const runs = readdirSync(join(root, 'data/scores')).filter((name) => name.endsWith('.json')).sort()
    .map((name) => ScoreRunSchema.parse(JSON.parse(readFileSync(join(root, 'data/scores', name), 'utf-8'))));
  const treemap = GeoTreemapRowsSchema.parse(JSON.parse(readFileSync(join(root, 'public/data.treemap.json'), 'utf-8')));
  const defaults = loadGeoFacts();
  assert.notEqual(defaults, first);
  assert.notEqual(defaults, second);
  assert.deepEqual(defaults, computeGeoFacts(treemap, runs));
  assert.equal(loadGeoFacts(), defaults);
  assert.equal(loadGeoFacts(a), first);
  assert.equal(loadGeoFacts(b), second);
});

test('reads JSON score files in sorted order when same-date attribution ties', () => {
  const root = fixtureRoot();
  populate(root);
  write(root, 'data/scores/z.json', scoreRun());
  write(root, 'data/scores/a.json', scoreRun('fixture-earlier-file'));
  assert.equal(loadGeoFacts(root).attribution.modelId, SCORE_ATTRIBUTION.modelId);
});

for (const mismatch of ['model', 'date'] as const) {
  test(`rejects ${mismatch} attribution drift and does not cache the failed result`, () => {
    const root = fixtureRoot();
    populate(root, mismatch === 'model' ? scoreRun('fixture-other-model')
      : scoreRun(SCORE_ATTRIBUTION.modelId, '1900-01-01'));
    assert.throws(() => loadGeoFacts(root), new RegExp(`geo-facts-loader: SCORE_ATTRIBUTION ${mismatch}`));
    populate(root);
    assert.equal(loadGeoFacts(root).attribution.modelId, SCORE_ATTRIBUTION.modelId);
    assert.equal(loadGeoFacts(root).attribution.runDate, SCORE_ATTRIBUTION.runDate);
  });
}

for (const target of ['scores', 'treemap'] as const) {
  for (const failure of ['missing', 'JSON', 'schema'] as const) {
    test(`fails on ${target} ${failure} and retries after repair`, () => {
      const root = fixtureRoot();
      populate(root);
      const file = join(root, target === 'scores' ? 'data/scores/active.json' : 'public/data.treemap.json');
      if (failure === 'missing') {
        rmSync(target === 'scores' ? join(root, 'data/scores') : file, { recursive: true });
      } else {
        writeFileSync(file, failure === 'JSON' ? '{' : '{}');
      }
      assert.throws(() => loadGeoFacts(root), failure === 'missing' ? /ENOENT/
        : failure === 'JSON' ? SyntaxError : /Invalid input|expected/);
      mkdirSync(join(root, 'data/scores'), { recursive: true });
      populate(root);
      assert.equal(loadGeoFacts(root).occupationCount, 1);
    });
  }
}

test('does not silently produce facts without an occupation score run', () => {
  const root = fixtureRoot();
  write(root, 'public/data.treemap.json', rows);
  assert.throws(() => loadGeoFacts(root), /no non-backfill occupations score run/);
});
