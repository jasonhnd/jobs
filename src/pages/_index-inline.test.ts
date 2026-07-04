import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/pages/_index-inline.js', 'utf8');

test('home screen-reader fallback list is capped and links to the full map list', () => {
  assert.match(source, /const SR_FALLBACK_LIMIT = 120;/);
  assert.match(source, /data\.slice\(0, SR_FALLBACK_LIMIT\)/);
  assert.match(source, /href="\/map"/);
  assert.doesNotMatch(source, /data\.slice\(0, __OCCUPATION_COUNT_SCORED__\)/);
});
