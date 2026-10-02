import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  DetailFileSchema,
  HollandFileSchema,
  ScoreHistoryProjectionSchema,
  SkillRankingFileSchema,
  TreemapFileSummarySchema,
} from '../lib/projection-schemas.js';
import {
  loadAllDetails,
  loadDetailById,
  loadHolland,
  loadScoreHistory,
  loadSkillRanking,
  loadTreemapSummary,
} from './projection-loaders.js';

const dirs: string[] = [];
function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'page-projections-'));
  dirs.push(dir);
  return dir;
}
function write(dir: string, file: string, value: unknown): void {
  const path = join(dir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const detail = { id: 7, title: { ja: 'Fixture' }, extra: 'preserved' };
const holland = { cols: ['id', 'realistic'], rows: [[7, 6], ['missing', null]] };
const treemap = [{ id: 7, ai_risk: null, risk_band: null, workers: null, salary: null }];
const skill = { skill_key: 'complex_problem_solving', label_ja: 'Fixture', occupations: [{ id: 7, name_ja: 'Fixture', score: 6 }] };
const history = { '7': [{ model: 'fixture', date: '2026-01-01', transformation: 6, displacement: null, dims: null }] };

const cases = [
  { name: 'all details', file: 'data.detail/0007.json', tag: 'detail', load: loadAllDetails,
    valid: detail, expected: [detail], invalid: { id: '7' } },
  { name: 'detail by id', file: 'data.detail/0007.json', tag: 'detail',
    load: (dir?: string) => loadDetailById(7, dir), valid: detail, expected: detail, invalid: { id: '7' } },
  { name: 'Holland', file: 'data.holland.json', tag: 'holland', load: loadHolland,
    valid: holland, expected: holland, invalid: { cols: [], rows: [[true]] } },
  { name: 'treemap', file: 'data.treemap.json', tag: 'treemap', load: loadTreemapSummary,
    valid: treemap, expected: treemap, invalid: [{ id: 7 }] },
  { name: 'skill ranking', file: 'data.skills/complex_problem_solving.json', tag: 'skill',
    load: (dir?: string) => loadSkillRanking('complex_problem_solving', dir), valid: skill, expected: skill,
    invalid: { ...skill, occupations: [{ id: 7, name_ja: 'Fixture', score: '6' }] } },
  { name: 'score history', file: 'data.score_history.json', tag: 'score-history', load: loadScoreHistory,
    valid: history, expected: history,
    invalid: { '7': [{ ...history['7'][0], displacement: 2 }] } },
];

for (const loader of cases) {
  describe(loader.name, () => {
    test('validates data and keeps the same cached object after the file changes', () => {
      const dir = fixtureDir();
      write(dir, loader.file, loader.valid);
      const value = loader.load(dir);
      assert.deepEqual(value, loader.expected);
      writeFileSync(join(dir, loader.file), 'invalid JSON');
      assert.equal(loader.load(dir), value);
    });

    test('isolates injected paths from each other and the default cache', () => {
      const a = fixtureDir();
      const b = fixtureDir();
      write(a, loader.file, loader.valid);
      write(b, loader.file, loader.valid);
      const first = loader.load(a);
      const second = loader.load(b);
      assert.notEqual(first, second);
      assert.deepEqual(second, loader.expected);
      assert.notEqual(loader.load(), first);
      assert.notEqual(loader.load(), second);
      assert.equal(loader.load(a), first);
      assert.equal(loader.load(b), second);
    });

    for (const failure of ['missing', 'JSON', 'schema'] as const) {
      test(`reports ${failure} errors with the path and tag, then retries after repair`, () => {
        const dir = fixtureDir();
        if (failure !== 'missing') {
          write(dir, loader.file, loader.invalid);
          if (failure === 'JSON') writeFileSync(join(dir, loader.file), '{');
        }
        assert.throws(() => loader.load(dir), (error: Error) => {
          assert.ok(error.message.includes(`[projection-loaders.${loader.tag}]`));
          assert.ok(error.message.includes(dir));
          assert.match(error.message, failure === 'missing' ? /read failed|readdir failed/
            : failure === 'JSON' ? /invalid JSON/ : /schema mismatch/);
          return true;
        });
        write(dir, loader.file, loader.valid);
        assert.deepEqual(loader.load(dir), loader.expected);
      });
    }
  });
}

test('all details are sorted by padded filename, filter non-JSON files, and warm id lookups', () => {
  const dir = fixtureDir();
  write(dir, 'data.detail/0010.json', { id: 10 });
  write(dir, 'data.detail/0002.json', { id: 2 });
  write(dir, 'data.detail/README.txt', { invalid: true });
  const all = loadAllDetails(dir);
  assert.deepEqual(all.map((row) => row.id), [2, 10]);
  rmSync(join(dir, 'data.detail'), { recursive: true });
  assert.equal(loadDetailById(2, dir), all[0]);
  assert.equal(loadDetailById(10, dir), all[1]);
  assert.equal(loadAllDetails(dir), all);
});

test('an empty detail directory is cached as an empty array', () => {
  const dir = fixtureDir();
  mkdirSync(join(dir, 'data.detail'));
  const all = loadAllDetails(dir);
  assert.deepEqual(all, []);
  write(dir, 'data.detail/0007.json', detail);
  assert.equal(loadAllDetails(dir), all);
});

test('skill keys and detail ids select separate files within the same root', () => {
  const dir = fixtureDir();
  write(dir, 'data.detail/0007.json', detail);
  write(dir, 'data.detail/0008.json', { id: 8 });
  write(dir, 'data.skills/S01.json', { ...skill, skill_key: 'S01' });
  write(dir, 'data.skills/S02.json', { ...skill, skill_key: 'S02', occupations: [] });
  assert.equal(loadDetailById(7, dir).id, 7);
  assert.equal(loadDetailById(8, dir).id, 8);
  assert.equal(loadSkillRanking('S01', dir).skill_key, 'S01');
  assert.equal(loadSkillRanking('S02', dir).skill_key, 'S02');
});

test('default paths return the validated build projections', () => {
  const dir = join(process.cwd(), 'public');
  const read = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), 'utf-8'));
  const details = readdirSync(join(dir, 'data.detail')).filter((name) => name.endsWith('.json')).sort()
    .map((name) => DetailFileSchema.parse(read(`data.detail/${name}`)));
  assert.deepEqual(loadAllDetails(), details);
  assert.deepEqual(loadDetailById(7), DetailFileSchema.parse(read('data.detail/0007.json')));
  assert.deepEqual(loadHolland(), HollandFileSchema.parse(read('data.holland.json')));
  assert.deepEqual(loadTreemapSummary(), TreemapFileSummarySchema.parse(read('data.treemap.json')));
  assert.deepEqual(loadScoreHistory(), ScoreHistoryProjectionSchema.parse(read('data.score_history.json')));
  const skillKey = readdirSync(join(dir, 'data.skills')).find((name) => name.endsWith('.json'))!.slice(0, -5);
  assert.deepEqual(loadSkillRanking(skillKey), SkillRankingFileSchema.parse(read(`data.skills/${skillKey}.json`)));
});
