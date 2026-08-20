import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { NO_OCC_ALIAS_PATH, NO_OCC_PATH } from '../site/no-occ-path.js';

const meAstro = readFileSync(join(import.meta.dirname, 'me.astro'), 'utf8');
const sitemap = readFileSync(join(import.meta.dirname, '../views/sitemap.ts'), 'utf8');
const vercel = readFileSync(join(import.meta.dirname, '../../vercel.json'), 'utf8');

describe('no-occupation entry is /shindan (#259 lock)', () => {
  test('NO_OCC_PATH is /shindan and does not claim 転職', () => {
    assert.equal(NO_OCC_PATH, '/shindan');
    assert.equal(NO_OCC_ALIAS_PATH, '/me/start');
    assert.doesNotMatch(NO_OCC_PATH, /転職|tenshoku|career-change/);
    assert.match(meAstro, /NO_OCC_PATH/);
  });

  test('/me screen 1 has the no-occupation entry without requiring a 556-row hit', () => {
    const searchAt = meAstro.indexOf('id="meForm"');
    const entryAt = meAstro.indexOf('id="meNoOccEntry"');
    const resultsAt = meAstro.indexOf('id="meResults"');
    assert.ok(searchAt > 0 && entryAt > searchAt && resultsAt > entryAt);
    assert.match(meAstro, /仕事がまだ決まっていない方、変えたいと考えている方はこちら/);
  });

  test('/shindan stays in the sitemap; the retired /me/start alias 301s', () => {
    assert.match(sitemap, /\/shindan/);
    assert.doesNotMatch(sitemap, /\/me\/start/);
    assert.match(vercel, /"source": "\/me\/start"/);
    assert.match(vercel, /"destination": "\/shindan"/);
  });
});
