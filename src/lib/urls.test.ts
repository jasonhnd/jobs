/**
 * urls.test.ts — pin the canonical URL helpers.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { jaUrl } from './urls.js';

describe('jaUrl', () => {
  test('builds /ja/{id} on the mirai-shigoto.com origin', () => {
    assert.equal(jaUrl(42), 'https://mirai-shigoto.com/ja/42');
  });

  test('preserves numeric id (no leading zero, no string coercion quirks)', () => {
    assert.equal(jaUrl(1), 'https://mirai-shigoto.com/ja/1');
    assert.equal(jaUrl(584), 'https://mirai-shigoto.com/ja/584');
  });
});
