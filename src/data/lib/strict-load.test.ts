// Tests for strict-load.ts — the file-system helpers that replaced the
// silent "return [] on failure" pattern across sitemap / genre-hub /
// image-sitemap. We pin two contracts:
//   1. Errors include the tag + path so a 800-page build traces back.
//   2. ALLOW_PARTIAL_DATA=1 restores the legacy "log + skip" semantics,
//      otherwise every failure throws.

import { describe, test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

import {
  strictReadJson,
  tryReadJson,
  strictReaddir,
  strictLoadDir,
  allowPartialData,
} from './strict-load.js';

const Schema = z.object({ id: z.number(), name: z.string() }).passthrough();

describe('strict-load', () => {
  let tmp: string;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'strict-load-test-'));
    writeFileSync(join(tmp, 'good.json'), JSON.stringify({ id: 1, name: 'A' }));
    writeFileSync(join(tmp, 'bad-json.json'), '{ not json');
    writeFileSync(join(tmp, 'bad-shape.json'), JSON.stringify({ id: 'not-a-number' }));
    writeFileSync(join(tmp, 'good2.json'), JSON.stringify({ id: 2, name: 'B' }));
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe('allowPartialData', () => {
    test('false by default (process.env not set to "1")', () => {
      delete process.env.ALLOW_PARTIAL_DATA;
      assert.equal(allowPartialData(), false);
    });
    test('true when ALLOW_PARTIAL_DATA=1', () => {
      process.env.ALLOW_PARTIAL_DATA = '1';
      assert.equal(allowPartialData(), true);
      delete process.env.ALLOW_PARTIAL_DATA;
    });
    test('false for ALLOW_PARTIAL_DATA=0, =true, or empty', () => {
      for (const v of ['0', 'true', '']) {
        process.env.ALLOW_PARTIAL_DATA = v;
        assert.equal(allowPartialData(), false, `value="${v}" should be false`);
      }
      delete process.env.ALLOW_PARTIAL_DATA;
    });
  });

  describe('strictReadJson', () => {
    test('returns parsed data for valid input', () => {
      const got = strictReadJson(join(tmp, 'good.json'), Schema, 'test');
      assert.equal(got.id, 1);
      assert.equal(got.name, 'A');
    });
    test('throws with tag + path on missing file', () => {
      assert.throws(
        () => strictReadJson(join(tmp, 'nope.json'), Schema, 'mytag'),
        (err: Error) => err.message.startsWith('[mytag] read failed:') && err.message.includes('nope.json'),
      );
    });
    test('throws with tag + path on malformed JSON', () => {
      assert.throws(
        () => strictReadJson(join(tmp, 'bad-json.json'), Schema, 'mytag'),
        (err: Error) => err.message.startsWith('[mytag] invalid JSON:'),
      );
    });
    test('throws with tag + path on schema mismatch', () => {
      assert.throws(
        () => strictReadJson(join(tmp, 'bad-shape.json'), Schema, 'mytag'),
        (err: Error) =>
          err.message.startsWith('[mytag] schema mismatch in') &&
          err.message.includes('bad-shape.json'),
      );
    });
  });

  describe('tryReadJson', () => {
    test('returns parsed data on success', () => {
      const got = tryReadJson(join(tmp, 'good.json'), Schema, 'test');
      assert.equal(got?.id, 1);
    });
    test('returns null on failure (no throw)', () => {
      const got = tryReadJson(join(tmp, 'nope.json'), Schema, 'test');
      assert.equal(got, null);
    });
  });

  describe('strictReaddir', () => {
    test('returns filtered + sorted entries', () => {
      const got = strictReaddir(tmp, (f) => f.endsWith('.json'), 'test');
      assert.deepEqual(got.sort(), ['bad-json.json', 'bad-shape.json', 'good.json', 'good2.json']);
    });
    test('throws with tag + path on missing directory by default', () => {
      assert.throws(
        () => strictReaddir(join(tmp, 'nope'), () => true, 'mytag'),
        (err: Error) => err.message.startsWith('[mytag] readdir failed:'),
      );
    });
    test('returns [] on missing directory when ALLOW_PARTIAL_DATA=1', () => {
      process.env.ALLOW_PARTIAL_DATA = '1';
      const got = strictReaddir(join(tmp, 'nope'), () => true, 'test');
      assert.deepEqual(got, []);
      delete process.env.ALLOW_PARTIAL_DATA;
    });
  });

  describe('strictLoadDir', () => {
    test('strict mode: aborts on first bad file', () => {
      assert.throws(() =>
        strictLoadDir(tmp, (f) => f.endsWith('.json'), Schema, 'mytag'),
      );
    });
    test('permissive mode: skips bad files, reports count', () => {
      process.env.ALLOW_PARTIAL_DATA = '1';
      const { items, skipped } = strictLoadDir(tmp, (f) => f.endsWith('.json'), Schema, 'test');
      assert.equal(items.length, 2);
      assert.equal(skipped, 2);
      delete process.env.ALLOW_PARTIAL_DATA;
    });
  });
});
