import { afterEach, beforeEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkCrossProjectionIdReferences, checkDetailFiles, checkLabels, checkNonEmptyJsonShape,
  checkPerOccupationDir, checkPlannedFilesExist, checkSearch,
} from './files.js';
import { relPath, Report } from './shared.js';

describe('projection file consistency with isolated dist fixtures', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'consistency-files-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  async function raw(name: string, value: string): Promise<void> {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
  }
  async function json(name: string, value: unknown): Promise<void> {
    await raw(name, JSON.stringify(value));
  }

  test('required projections report all missing files and directories', async () => {
    const r = new Report();
    await checkPlannedFilesExist(root, r);
    assert.deepEqual(r.errors, [
      ...['treemap', 'top10', 'treemap.meta', 'search', 'sectors', 'review_queue', 'profile5',
        'worktypes', 'transfer_paths', 'score_history', 'models_deep', 'models_by_model', 'holland']
        .map(name => `missing required projection file: ${relPath(join(root, `data.${name}.json`))}`),
      `missing required projection file: ${relPath(join(root, 'data.labels/ja.json'))}`,
      ...['data.detail', 'data.skills'].map(name =>
        `missing required projection directory: ${relPath(join(root, name))}`),
    ]);
  });

  test('required projections accept populated directories and diagnose empty or unreadable ones', async () => {
    for (const name of ['treemap', 'top10', 'treemap.meta', 'search', 'sectors', 'review_queue',
      'profile5', 'worktypes', 'transfer_paths', 'score_history', 'models_deep', 'models_by_model', 'holland']) {
      await json(`data.${name}.json`, {});
    }
    await json('data.labels/ja.json', {});
    await json('data.detail/0001.json', {});
    await json('data.skills/index.json', {});
    const valid = new Report();
    await checkPlannedFilesExist(root, valid);
    assert.deepEqual(valid.errors, []);
    await rm(join(root, 'data.detail/0001.json'));
    await rm(join(root, 'data.skills'), { recursive: true });
    await raw('data.skills', 'not a directory');
    const invalid = new Report();
    await checkPlannedFilesExist(root, invalid);
    assert.equal(invalid.errors.length, 2);
    assert.equal(invalid.errors[0], `projection directory is empty: ${relPath(join(root, 'data.detail'))}`);
    assert.ok(invalid.errors[1]?.startsWith(`cannot read projection directory ${relPath(join(root, 'data.skills'))}: `));
  });

  test('shape checks skip missing files, reject malformed JSON and preserve object/array keys', async () => {
    const skipped = new Report();
    await checkNonEmptyJsonShape(root, 'shape.json', 'items', skipped);
    assert.deepEqual(skipped.errors, []);
    await raw('shape.json', '{bad');
    const malformed = new Report();
    await checkNonEmptyJsonShape(root, 'shape.json', 'items', malformed);
    assert.ok(malformed.errors[0]?.startsWith('shape.json invalid JSON: '));
    for (const value of [null, false, 1, 'text']) {
      await json('shape.json', value);
      const r = new Report();
      await checkNonEmptyJsonShape(root, 'shape.json', 'items', r);
      assert.deepEqual(r.errors, [`shape.json top-level must be an object/array (got ${typeof value})`]);
    }
    await json('shape.json', {});
    const missing = new Report();
    await checkNonEmptyJsonShape(root, 'shape.json', 'items', missing);
    assert.deepEqual(missing.errors, ['shape.json missing expected top-level key: items']);
    for (const [value, key] of [[{ items: [] }, 'items'], [[], 'length']] as const) {
      await json('shape.json', value);
      const r = new Report();
      await checkNonEmptyJsonShape(root, 'shape.json', key, r);
      assert.deepEqual(r.errors, []);
    }
  });

  test('per-occupation directory handles absence, wrong path type and JSON-only counts', async () => {
    const absent = new Report();
    await checkPerOccupationDir(root, 'details', 1, absent);
    assert.deepEqual(absent.errors, []);
    await raw('details', 'file');
    const unreadable = new Report();
    await checkPerOccupationDir(root, 'details', 1, unreadable);
    assert.ok(unreadable.errors[0]?.startsWith('cannot read details: '));
    await rm(join(root, 'details'));
    await raw('details/ignore.txt', '{}');
    const empty = new Report();
    await checkPerOccupationDir(root, 'details', 1, empty);
    assert.deepEqual(empty.errors, ['details has 0 files, expected ≥ 1']);
    await raw('details/0001.json', '{bad');
    const bad = new Report();
    await checkPerOccupationDir(root, 'details', 1, bad);
    assert.ok(bad.errors[0]?.startsWith('details/0001.json sample invalid JSON: '));
    await json('details/0001.json', null);
    const primitive = new Report();
    await checkPerOccupationDir(root, 'details', 2, primitive);
    assert.deepEqual(primitive.errors, ['details has 1 files, expected ≥ 2', 'details/0001.json sample is not an object']);
    await json('details/0001.json', { id: 1 });
    const valid = new Report();
    await checkPerOccupationDir(root, 'details', 1, valid);
    assert.deepEqual(valid.errors, []);
  });

  test('search skips absence, reports parse failures, and accepts empty defaults or titled unique IDs', async () => {
    const absent = new Report();
    await checkSearch(root, absent, 0);
    assert.deepEqual(absent.errors, []);
    await raw('data.search.json', '{bad');
    const bad = new Report();
    await checkSearch(root, bad, 0);
    assert.ok(bad.errors[0]?.startsWith('data.search.json is invalid JSON: '));
    for (const value of [{}, { documents: [{ id: 1, title_ja: 'fixture' }] }]) {
      await json('data.search.json', value);
      const r = new Report();
      await checkSearch(root, r, 0);
      assert.deepEqual(r.errors, []);
    }
  });

  test('detail checks accept padded IDs and ignore other file extensions', async () => {
    const absent = new Report();
    await checkDetailFiles(root, absent, new Set([1]));
    assert.deepEqual(absent.errors, []);
    await json('data.detail/0001.json', { id: 1, title: { ja: 'fixture' } });
    await raw('data.detail/readme.txt', 'fixture');
    const r = new Report();
    await checkDetailFiles(root, r, new Set([1]));
    assert.deepEqual(r.errors, []);
  });

  test('detail checks retain count, identity, title, padding, missing and extra diagnostics', async () => {
    await json('data.detail/1.json', { id: 9 });
    await json('data.detail/0002.json', { id: 2, title: { ja: 'fixture' } });
    await json('data.detail/bad.json', {});
    const r = new Report();
    await checkDetailFiles(root, r, new Set([3]));
    assert.deepEqual(r.errors, [
      'detail file count (3) != total source occupations (1)',
      'detail/1.json inner id 9 != filename stem 1', 'detail/1.json missing title.ja',
      'detail/1.json filename must be 4-digit zero-padded', 'detail file with non-int name: bad.json',
      'detail/ missing ids: 3', 'detail/ has unknown ids: 2, 1',
    ]);
  });

  test('labels accept seven dimensions and skip absent languages', async () => {
    const absent = new Report();
    await checkLabels(root, absent);
    assert.deepEqual(absent.errors, []);
    await json('data.labels/ja.json', {
      schema_version: 1, generated_at: 'fixture', lang: 'ja',
      a: {}, b: {}, c: {}, d: {}, e: {}, f: {}, g: {},
    });
    const valid = new Report();
    await checkLabels(root, valid);
    assert.deepEqual(valid.errors, []);
    assert.deepEqual(valid.warnings, []);
  });

  test('cross-reference checks skip absent projections and handle an unreadable detail directory', async () => {
    const absent = new Report();
    await checkCrossProjectionIdReferences(root, absent);
    assert.deepEqual(absent.errors, []);
    await raw('data.detail', 'file');
    const unreadable = new Report();
    await checkCrossProjectionIdReferences(root, unreadable);
    assert.ok(unreadable.errors[0]?.startsWith('cannot enumerate data.detail/: '));
  });

  test('cross-reference defaults and nonnumeric IDs are ignored while known IDs pass', async () => {
    await json('data.detail/0001.json', {});
    await json('data.detail/bad.json', {});
    await raw('data.detail/readme.txt', 'fixture');
    for (const [search, paths] of [
      [{}, {}],
      [{ documents: [{ id: 1 }, { id: 'unknown' }, {}] },
        { paths: { a: { candidates: [{ id: 1 }, { id: 'unknown' }, {}] }, b: {} } }],
    ]) {
      await json('data.search.json', search);
      await json('data.transfer_paths.json', paths);
      const r = new Report();
      await checkCrossProjectionIdReferences(root, r);
      assert.deepEqual(r.errors, []);
    }
  });

  test('cross-reference diagnostics truncate large lists and retain parse failures for both projections', async () => {
    await json('data.detail/0001.json', {});
    const candidates = [2, 3, 4, 5, 6, 7].map(id => ({ id }));
    await json('data.search.json', { documents: candidates });
    await json('data.transfer_paths.json', { paths: { a: { candidates } } });
    const dangling = new Report();
    await checkCrossProjectionIdReferences(root, dangling);
    assert.deepEqual(dangling.errors, [
      'data.search.json has 6 ids with no matching data.detail/ file: 2, 3, 4, 5, 6…',
      'data.transfer_paths.json references 6 candidate ids with no matching data.detail/ file: 2, 3, 4, 5, 6…',
    ]);
    await raw('data.search.json', '{bad');
    await raw('data.transfer_paths.json', '{bad');
    const malformed = new Report();
    await checkCrossProjectionIdReferences(root, malformed);
    assert.equal(malformed.errors.length, 2);
    assert.ok(malformed.errors[0]?.startsWith('data.search.json id-cross-check failed: '));
    assert.ok(malformed.errors[1]?.startsWith('data.transfer_paths.json id-cross-check failed: '));
  });
});
