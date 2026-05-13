/**
 * occupation-aux-data.test.ts — pin readJsonSafe + smoke-test the
 * two lazy getters.
 *
 * The getters (`getProfile5` / `getTransferPaths`) carry module-
 * scope cache state that survives across the test run, so they
 * can only be exercised once per run. Integration is covered by
 * the live build (which would fail at page render time if the
 * aux JSONs disappeared); these tests focus on the pure
 * read-and-fall-back helper.
 */

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { after, before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  readJsonSafe,
  getProfile5,
  getTransferPaths,
} from './occupation-aux-data.js';

describe('readJsonSafe — pure fallback-aware JSON loader', () => {
  let tempDir: string;

  before(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'aux-data-test-'));
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('returns parsed JSON for a well-formed file', () => {
    const p = path.join(tempDir, 'good.json');
    writeFileSync(p, '{"foo":"bar","n":42}');
    const out = readJsonSafe<{ foo: string; n: number }>(p);
    assert.deepEqual(out, { foo: 'bar', n: 42 });
  });

  test('returns null for a missing file (no throw)', () => {
    const out = readJsonSafe(path.join(tempDir, 'does-not-exist.json'));
    assert.equal(out, null);
  });

  test('returns null for unparseable bytes (no throw)', () => {
    const p = path.join(tempDir, 'bad.json');
    writeFileSync(p, '{this is not json');
    const out = readJsonSafe(p);
    assert.equal(out, null);
  });

  test('returns null for an empty file (no throw)', () => {
    const p = path.join(tempDir, 'empty.json');
    writeFileSync(p, '');
    const out = readJsonSafe(p);
    assert.equal(out, null);
  });

  test('returns null for a directory passed as a path', () => {
    const dirPath = path.join(tempDir, 'a-dir');
    mkdirSync(dirPath);
    const out = readJsonSafe(dirPath);
    assert.equal(out, null);
  });
});

describe('getProfile5 — lazy loader (integration smoke)', () => {
  test('returns a Record<string, Record<string, number | null>>', () => {
    const out = getProfile5();
    assert.equal(typeof out, 'object');
    assert.ok(out !== null);
    assert.ok(!Array.isArray(out));
  });

  test('cache: two consecutive calls return the same reference', () => {
    const a = getProfile5();
    const b = getProfile5();
    assert.equal(a, b);
  });
});

describe('getTransferPaths — lazy loader (integration smoke)', () => {
  test('returns a Record<string, TransferPathEntry>', () => {
    const out = getTransferPaths();
    assert.equal(typeof out, 'object');
    assert.ok(out !== null);
    assert.ok(!Array.isArray(out));
  });

  test('cache: two consecutive calls return the same reference', () => {
    const a = getTransferPaths();
    const b = getTransferPaths();
    assert.equal(a, b);
  });
});
