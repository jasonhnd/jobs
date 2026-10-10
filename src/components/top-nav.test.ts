import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { ORDINARY_READING_ENTRIES } from '../site/edition-navigation';

const source = readFileSync(join(import.meta.dirname, 'TopNav.astro'), 'utf8');

describe('desktop top nav — /me', () => {
  test('lists occupation search before diagnosis in ordinary navigation', () => {
    assert.deepEqual(ORDINARY_READING_ENTRIES.slice(0, 2).map(it => it.href), ['/me', '/shindan']);
    assert.equal(ORDINARY_READING_ENTRIES[0]!.label, '自分の仕事を探す');
    assert.match(source, /ORDINARY_READING_ENTRIES\.map/);
  });

  test('the /me row carries the me_entry_click contract Footer.astro reads', () => {
    assert.match(source, /trackEvent: 'me_entry_click'/);
    assert.match(source, /entrySource: 'top_nav'/);
    assert.match(source, /data-occupation-id': '0'/);
  });
});
