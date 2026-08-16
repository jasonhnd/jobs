import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { NO_OCC_PATH } from '../site/no-occ-path.js';

const meAstro = readFileSync(join(import.meta.dirname, 'me.astro'), 'utf8');
const startAstro = readFileSync(join(import.meta.dirname, 'me/start.astro'), 'utf8');
const meJs = readFileSync(join(import.meta.dirname, '_me-inline.js'), 'utf8');
const sitemap = readFileSync(join(import.meta.dirname, '../views/sitemap.ts'), 'utf8');

describe('/me no-occupation branch (#259)', () => {
  test('path is a single named constant and does not claim 転職', () => {
    assert.equal(NO_OCC_PATH, '/me/start');
    assert.doesNotMatch(NO_OCC_PATH, /転職|tenshoku|career-change/);
    assert.match(meAstro, /NO_OCC_PATH/);
    assert.match(startAstro, /NO_OCC_PATH/);
  });

  test('/me screen 1 has the no-occupation entry without requiring a 556-row hit', () => {
    const searchAt = meAstro.indexOf('id="meForm"');
    const entryAt = meAstro.indexOf('id="meNoOccEntry"');
    const resultsAt = meAstro.indexOf('id="meResults"');
    assert.ok(searchAt > 0 && entryAt > searchAt && resultsAt > entryAt);
    assert.match(meAstro, /仕事がまだ決まっていない方、変えたいと考えている方はこちら/);
  });

  test('no-id result is occupation recommendations, not a gap against a missing job', () => {
    assert.match(startAstro, /id="meOccList"/);
    assert.doesNotMatch(startAstro, /id="meGap"|id="shindanJobInput"/);
    assert.match(meJs, /if \(noOccMode\)/);
    assert.match(meJs, /function renderFamilyOccupations/);
    assert.match(meJs, /function initNoOcc/);
    assert.doesNotMatch(
      meJs,
      /if \(noOccMode\)[\s\S]{0,400}showGap/,
    );
  });

  test('route stays out of the sitemap until #236 decides indexing', () => {
    assert.doesNotMatch(sitemap, /\/me\/start|NO_OCC_PATH/);
    assert.match(startAstro, /noindex=\{true\}/);
  });
});
