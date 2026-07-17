/**
 * urls.test.ts — pin the canonical URL helpers.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jaUrl, occupationPath } from './urls.js';
import { OCCUPATION_COUNT } from '@/site/config';

describe('occupationPath', () => {
  test('keeps historic root-level paths for ordinary occupation IDs', () => {
    assert.equal(occupationPath(1), '/1');
    assert.equal(occupationPath(584), '/584');
  });

  test('moves occupation 404 away from the custom /404 error document', () => {
    assert.equal(occupationPath(404), '/occupations/404');
  });

  test('maps all 556 source occupations to unique, non-reserved canonicals', () => {
    const dir = join(process.cwd(), 'data', 'occupations');
    const ids = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as { id: number })
      .map((record) => record.id);
    const paths = ids.map(occupationPath);

    assert.equal(ids.length, OCCUPATION_COUNT.TOTAL);
    assert.equal(new Set(ids).size, OCCUPATION_COUNT.TOTAL);
    assert.equal(new Set(paths).size, OCCUPATION_COUNT.TOTAL);
    assert.ok(!paths.includes('/404'));
    assert.ok(paths.includes('/occupations/404'));
  });
});

describe('jaUrl', () => {
  test('builds /{id} on the mirai-shigoto.com origin', () => {
    assert.equal(jaUrl(42), 'https://mirai-shigoto.com/42');
  });

  test('preserves numeric id (no leading zero, no string coercion quirks)', () => {
    assert.equal(jaUrl(1), 'https://mirai-shigoto.com/1');
    assert.equal(jaUrl(584), 'https://mirai-shigoto.com/584');
  });

  test('uses the collision-free canonical for occupation 404', () => {
    assert.equal(jaUrl(404), 'https://mirai-shigoto.com/occupations/404');
  });
});
