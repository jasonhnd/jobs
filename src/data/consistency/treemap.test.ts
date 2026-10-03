import { afterEach, beforeEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkReviewQueue, checkSectors, checkTop10, checkTreemap, checkTreemapV110 } from './treemap.js';
import { Report } from './shared.js';

function record(id = 1, ai_risk: number | null = 2) {
  return {
    id, name_ja: 'fixture', salary: 500, workers: 5_000_000, hours: null, age: null,
    recruit_wage: null, recruit_ratio: null, hourly_wage: null, ai_risk, ai_rationale_ja: 'fixture',
    education_pct: null, employment_type: null, url: 'fixture', sector_id: 'fixture', sector_ja: 'fixture',
    hue: 'safe', risk_band: ai_risk === null ? null : ai_risk < 4 ? 'low' : ai_risk < 7 ? 'mid' : 'high',
    workforce_band: 'large', demand_band: 'normal',
  };
}

describe('treemap consistency with isolated dist fixtures', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'consistency-treemap-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  async function json(name: string, value: unknown): Promise<void> {
    await writeFile(join(root, name), JSON.stringify(value));
  }

  test('all disk readers skip absent files and retain invalid JSON prefixes', async () => {
    const checks = [
      ['treemap', (r: Report) => checkTreemap(root, r), []],
      ['top10', (r: Report) => checkTop10(root, [], r), undefined],
      ['sectors', (r: Report) => checkSectors(root, r), null],
      ['review_queue', (r: Report) => checkReviewQueue(root, r), undefined],
    ] as const;
    for (const [name, check, expected] of checks) {
      const absent = new Report();
      assert.deepEqual(await check(absent), expected);
      assert.deepEqual(absent.errors, []);
      await writeFile(join(root, `data.${name}.json`), '{bad');
      const malformed = new Report();
      assert.deepEqual(await check(malformed), expected);
      assert.equal(malformed.errors.length, 1);
      assert.ok(malformed.errors[0]?.startsWith(`data.${name}.json ${name === 'treemap' || name === 'top10' ? 'is invalid JSON' : 'invalid JSON'}: `));
      assert.deepEqual(malformed.info, []);
    }
  });

  test('treemap rejects non-arrays and empty arrays emit zero percentages', async () => {
    await json('data.treemap.json', {});
    const invalid = new Report();
    assert.deepEqual(await checkTreemap(root, invalid), []);
    assert.deepEqual(invalid.errors, ['data.treemap.json must be a top-level array (got object)']);
    await json('data.treemap.json', []);
    const empty = new Report();
    assert.deepEqual(await checkTreemap(root, empty), []);
    assert.deepEqual(empty.errors, []);
    assert.deepEqual(empty.info, [
      'treemap: 0 records, 0 unique ids', '  ai_risk coverage:  0/0 (0%)',
      '  salary coverage:   0/0 (0%)', '  workers coverage:  0/0 (0%)',
      '  workforce total:   0', '  risk tiers:        low=0 mid=0 high=0',
    ]);
    assert.deepEqual(empty.warnings, ['workforce total 0 suspiciously low']);
  });

  test('treemap telemetry preserves canonical boundaries and nullable coverage', async () => {
    const rows = [record(1, 3.9), record(2, 4), record(3, 7), { ...record(4, null), salary: null, workers: null }];
    await json('data.treemap.json', rows);
    const r = new Report();
    assert.deepEqual(await checkTreemap(root, r), rows);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.info, [
      'treemap: 4 records, 4 unique ids', '  ai_risk coverage:  3/4 (75%)',
      '  salary coverage:   3/4 (75%)', '  workers coverage:  3/4 (75%)',
      '  workforce total:   15,000,000', '  risk tiers:        low=1 mid=1 high=1',
    ]);
  });

  test('treemap reports malformed rows, schema drift once, duplicate IDs and degenerate tiers', async () => {
    await json('data.treemap.json', [null, { id: 1 }, { id: 1 }]);
    const r = new Report();
    await checkTreemap(root, r);
    assert.equal(r.errors.length, 5);
    assert.equal(r.errors[0], 'treemap[0] is not an object');
    assert.equal(r.errors.filter(e => e.startsWith('treemap record missing required keys:')).length, 1);
    assert.deepEqual(r.errors.slice(2), ['id=1 treemap name_ja empty/non-string', 'duplicate id in treemap: 1', 'id=1 treemap name_ja empty/non-string']);
    await json('data.treemap.json', [{ ...record(), workers: 1 }]);
    const degenerate = new Report();
    await checkTreemap(root, degenerate);
    assert.deepEqual(degenerate.errors, []);
    assert.deepEqual(degenerate.warnings, [
      'workforce total 1 suspiciously low', "zero records in risk tier 'mid' — distribution degenerate?",
      "zero records in risk tier 'high' — distribution degenerate?",
    ]);
  });

  test('treemap rejects out-of-range risk, inconsistent band stamps and workforce overflow', async () => {
    await json('data.treemap.json', [{ ...record(1, 11), risk_band: 'low', workers: 70_000_001 }]);
    const r = new Report();
    await checkTreemap(root, r);
    assert.deepEqual(r.errors, [
      'id=1 ai_risk out of range: 11', 'id=1 risk_band "low" != canonical "high" (ai_risk=11)',
      "workforce total 70,000,001 exceeds Japan's ~67M ceiling",
    ]);
    await json('data.treemap.json', [{ ...record(1, 4), risk_band: null }]);
    const unstamped = new Report();
    await checkTreemap(root, unstamped);
    assert.deepEqual(unstamped.errors, []);
  });

  test('top10 orders equal risks by numeric ID and ignores unscored records', async () => {
    const rows = [record(11, null), ...Array.from({ length: 10 }, (_, i) => record(10 - i, 7))];
    const expected = rows.slice(1).reverse();
    await json('data.top10.json', expected);
    const r = new Report();
    await checkTop10(root, rows, r);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.info, ['top10: 10 records']);
    await json('data.top10.json', expected.slice().reverse());
    const wrong = new Report();
    await checkTop10(root, rows, wrong);
    assert.deepEqual(wrong.errors, ['data.top10.json ids 10,9,8,7,6,5,4,3,2,1 != treemap top10 1,2,3,4,5,6,7,8,9,10']);
    const unequal = Array.from({ length: 11 }, (_, i) => record(i + 1, i));
    await json('data.top10.json', unequal.slice(1).reverse());
    const descending = new Report();
    await checkTop10(root, unequal, descending);
    assert.deepEqual(descending.errors, []);
  });

  test('top10 diagnoses shape, length, required fields, ID types and duplicates', async () => {
    await json('data.top10.json', {});
    const object = new Report();
    await checkTop10(root, [], object);
    assert.deepEqual(object.errors, ['data.top10.json must be a top-level array (got object)']);
    await json('data.top10.json', [null, {}, { ...record(), id: 'bad', name_ja: '', ai_risk: 'bad' }, record(), record()]);
    const r = new Report();
    await checkTop10(root, [], r);
    assert.deepEqual(r.errors, [
      'data.top10.json must contain exactly 10 records (got 5)', 'top10[0] is not an object',
      ...['id', 'name_ja', 'salary', 'workers', 'ai_risk', 'ai_rationale_ja'].map(k => `top10[1] missing required key: ${k}`),
      'top10[1].id is not a number', 'top10[1].name_ja empty/non-string', 'top10[1].ai_risk must be a number',
      'top10[2].id is not a number', 'top10[2].name_ja empty/non-string', 'top10[2].ai_risk must be a number',
      'duplicate id in top10: 1',
    ]);
    assert.deepEqual(r.info, ['top10: 5 records']);
  });

  test('sectors accept valid hues and exempt uncategorized from minimum counts', async () => {
    const sectors = ['safe', 'mid', 'warm', 'risk'].map(hue => ({ id: hue, hue, ja: 'fixture', occupation_count: 5 }));
    sectors.push({ id: '_uncategorized', hue: 'safe', ja: 'fixture', occupation_count: 0 });
    await json('data.sectors.json', { sectors });
    const r = new Report();
    assert.deepEqual(await checkSectors(root, r), new Set(['safe', 'mid', 'warm', 'risk', '_uncategorized']));
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.info, ['sectors: 5 entries, 20 occupations covered']);
  });

  test('sectors reject empty defaults, missing IDs, duplicates, invalid hues and absent labels', async () => {
    for (const value of [{}, { sectors: [] }]) {
      await json('data.sectors.json', value);
      const empty = new Report();
      assert.equal(await checkSectors(root, empty), null);
      assert.deepEqual(empty.errors, ['data.sectors.json has no sectors']);
    }
    await json('data.sectors.json', { sectors: [{}, { id: 'a' }, { id: 'a', hue: 'bad', ja: '', occupation_count: 1 }] });
    const r = new Report();
    assert.deepEqual(await checkSectors(root, r), new Set(['a']));
    assert.deepEqual(r.errors, [
      'sector entry missing id', 'sector a has invalid hue: undefined', 'sector a missing ja label',
      'duplicate sector id: a', 'sector a has invalid hue: bad', 'sector a missing ja label',
    ]);
    assert.deepEqual(r.warnings, ['sector a has only 0 occupations (min 5)', 'sector a has only 1 occupations (min 5)']);
    assert.deepEqual(r.info, ['sectors: 3 entries, 1 occupations covered']);
  });

  test('review queue defaults to zero and independently warns for nonzero counts', async () => {
    await json('data.review_queue.json', {});
    const empty = new Report();
    await checkReviewQueue(root, empty);
    assert.deepEqual(empty.info, ['review_queue: uncategorized=0 ambiguous=0 overrides=0']);
    assert.deepEqual(empty.warnings, []);
    await json('data.review_queue.json', { summary: { uncategorized: 2, ambiguous: 3, override_count: 4 } });
    const r = new Report();
    await checkReviewQueue(root, r);
    assert.deepEqual(r.info, ['review_queue: uncategorized=2 ambiguous=3 overrides=4']);
    assert.deepEqual(r.warnings, ['2 occupation(s) uncategorized', '3 occupation(s) ambiguous']);
    assert.deepEqual(r.errors, []);
  });

  test('v1.1 fields accept null bands, uncategorized sectors and absent sector lists', () => {
    const empty = new Report();
    checkTreemapV110([], null, empty);
    assert.deepEqual(empty.info, []);
    const rows = [record(), { ...record(2, null), sector_id: '_uncategorized', hue: null,
      workforce_band: null, demand_band: null }];
    for (const ids of [null, new Set(['fixture'])]) {
      const r = new Report();
      checkTreemapV110(rows, ids, r);
      assert.deepEqual(r.errors, []);
      assert.deepEqual(r.info, [
        '  risk_band:         low=1 mid=0 high=0', '  workforce_band:    small=0 mid=0 large=1',
        '  demand_band:       cold=0 normal=1 hot=0',
      ]);
    }
  });

  test('v1.1 fields report missing keys and invalid bands and truncate unknown sector samples', () => {
    const missing = new Report();
    checkTreemapV110([{ id: 1 }], null, missing);
    assert.deepEqual(missing.errors.slice(0, 6), ['sector_id', 'sector_ja', 'hue', 'risk_band', 'workforce_band', 'demand_band']
      .map(k => `treemap[0] missing v1.1.0 field: ${k}`));
    assert.equal(missing.errors.length, 9);
    const rows = Array.from({ length: 6 }, (_, i) => ({ ...record(i + 1), sector_id: 'unknown' }));
    const r = new Report();
    checkTreemapV110([{ ...rows[0], hue: 'bad', risk_band: 'bad', workforce_band: 'bad', demand_band: 'bad' }, ...rows.slice(1)], new Set(), r);
    assert.deepEqual(r.errors, [
      'id=1 treemap hue invalid: bad', 'id=1 risk_band invalid: bad', 'id=1 workforce_band invalid: bad',
      'id=1 demand_band invalid: bad', 'treemap has unknown sector_id values for ids: 1, 2, 3, 4, 5',
    ]);
  });
});
