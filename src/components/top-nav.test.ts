import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const source = readFileSync(join(import.meta.dirname, 'TopNav.astro'), 'utf8');

describe('desktop top nav — /me', () => {
  test('lists 自分の現在地 before 診断', () => {
    const meAt = source.indexOf("href: '/me'");
    const shindanAt = source.indexOf("href: '/shindan'");
    assert.ok(meAt > 0 && shindanAt > meAt);
    assert.match(source, /label: '自分の現在地'/);
  });

  test('the /me row carries the me_entry_click contract Footer.astro reads', () => {
    assert.match(source, /trackEvent: 'me_entry_click'/);
    assert.match(source, /entrySource: 'top_nav'/);
    assert.match(source, /data-occupation-id': '0'/);
  });
});
