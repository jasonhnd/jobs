import { afterEach, beforeEach, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Report, readJsonOrFail } from './shared.js';
import { checkCrossProjectionIdReferences, checkDetailFiles, checkLabels, checkSearch } from './files.js';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'consistency-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function fixture(name: string, raw: string): Promise<string> {
  const path = join(root, name);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, raw);
  return path;
}

test('JSON null and other falsy values remain successful reads', async () => {
  const report = new Report();
  for (const value of [null, false, 0, '']) {
    const path = await fixture('value.json', JSON.stringify(value));
    assert.deepEqual(await readJsonOrFail(report, path, 'value invalid JSON'), { ok: true, data: value });
  }
  assert.deepEqual(report.errors, []);
});

test('invalid JSON preserves the caller prefix and parser message', async () => {
  const report = new Report();
  const path = await fixture('bad.json', '{bad');
  let message = '';
  try { JSON.parse('{bad'); } catch (err) { message = (err as Error).message; }
  assert.deepEqual(await readJsonOrFail(report, path, 'data.search.json is invalid JSON'), { ok: false });
  assert.deepEqual(report.errors, [`data.search.json is invalid JSON: ${message}`]);
});

test('read errors remain failures with the original filesystem message', async () => {
  const report = new Report();
  // A directory is an existing path that cannot be loaded as JSON.
  assert.deepEqual(await readJsonOrFail(report, root, 'projection invalid JSON'), { ok: false });
  assert.equal(report.errors.length, 1);
  assert.ok(report.errors[0]?.startsWith('projection invalid JSON: '));
});

test('malformed details continue to later files and retain the missing-id check', async () => {
  await fixture('data.detail/0001.json', '{bad');
  await fixture('data.detail/0002.json', JSON.stringify({ id: 2, title: { ja: 'fixture' } }));
  const report = new Report();
  await checkDetailFiles(root, report, new Set([1, 2]));
  assert.equal(report.errors.length, 2);
  assert.ok(report.errors[0]?.startsWith('detail/0001.json invalid JSON: '));
  assert.equal(report.errors[1], 'detail/ missing ids: 1');
});

test('a malformed label does not suppress the next language check', async () => {
  await fixture('data.labels/ja.json', '{bad');
  await fixture('data.labels/en.json', JSON.stringify({ lang: 'wrong' }));
  const report = new Report();
  await checkLabels(root, report);
  assert.equal(report.errors.length, 2);
  assert.ok(report.errors[0]?.startsWith('data.labels/ja.json invalid JSON: '));
  assert.equal(report.errors[1], 'data.labels/en.json has wrong lang field: wrong');
  assert.deepEqual(report.warnings, ['data.labels/en.json has 0 dimensions, expected 7']);
});

test('search retains duplicate and missing-title diagnostics in order', async () => {
  await fixture('data.search.json', JSON.stringify({ documents: [{ id: 1 }, { id: 1 }] }));
  const report = new Report();
  await checkSearch(root, report, 3);
  assert.deepEqual(report.errors, [
    'search document_count (2) != total source occupations (3)',
    'id=1 search missing title_ja',
    'duplicate id in search: 1',
    'id=1 search missing title_ja',
  ]);
});

test('cross-references retain duplicate search counts and unique candidate counts', async () => {
  await fixture('data.detail/0001.json', '{}');
  await fixture('data.search.json', JSON.stringify({ documents: [{ id: 9 }, { id: 9 }] }));
  await fixture('data.transfer_paths.json', JSON.stringify({ paths: { a: { candidates: [{ id: 8 }, { id: 8 }] } } }));
  const report = new Report();
  await checkCrossProjectionIdReferences(root, report);
  assert.deepEqual(report.errors, [
    'data.search.json has 2 ids with no matching data.detail/ file: 9, 9',
    'data.transfer_paths.json references 1 candidate ids with no matching data.detail/ file: 8',
  ]);
});

test('cross-reference shape errors retain the broader catch behavior', async () => {
  await fixture('data.detail/0001.json', '{}');
  await fixture('data.search.json', '{"documents":{}}');
  const report = new Report();
  await checkCrossProjectionIdReferences(root, report);
  assert.equal(report.errors.length, 1);
  assert.ok(report.errors[0]?.startsWith('data.search.json id-cross-check failed: '));
});
