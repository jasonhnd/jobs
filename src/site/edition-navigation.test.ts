import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageEdition, ORDINARY_READING_ENTRIES } from './edition-navigation';

test('navigation recognises the static Pro index and descendants without leaking into ordinary routes', () => {
  for (const path of ['/pro', '/pro.html', '/pro/428', '/pro/skills.html']) assert.equal(pageEdition(path), 'pro');
  for (const path of ['/', '/map.html', '/proposed', '/me']) assert.equal(pageEdition(path), 'ordinary');
  assert.deepEqual(ORDINARY_READING_ENTRIES.map(it => it.href), ['/me', '/shindan', '/rankings', '/map', '/sectors', '/pro']);
});
