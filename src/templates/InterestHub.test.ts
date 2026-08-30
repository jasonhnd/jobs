import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderInterestItem } from './InterestHub.js';
import type { InterestOccupation } from '../views/interests.js';

const item: InterestOccupation = {
  id: 1,
  name_ja: '看護師',
  primary_score: 4.82,
  riasec: { R: 2, I: 3, A: 1, S: 4.82, E: 2, C: 2 },
  ai_risk: 3.6,
  risk_band: 'low',
  workers: 100,
  salary: 500,
  sector_id: 'iryo',
  sector_ja: '医療',
};

describe('renderInterestItem', () => {
  test('§3.3 whole-row tap keeps rmini extra + salary + workers', () => {
    const got = renderInterestItem(item, 'S');
    assert.match(got, /<a class="rl-row" href="\/1" data-track-event="list_row_click">/);
    assert.match(got, /<span class="rl-name">看護師<\/span>/);
    assert.match(got, /class="rl-meta"/);
    assert.match(got, /医療/);
    assert.match(got, /<span class="rmini" aria-label="RIASEC profile">/);
    assert.equal((got.match(/rmini-bar/g) ?? []).length, 6);
    assert.match(got, /<span class="rmini-bar primary"/);
    assert.match(got, /<span class="rmini-score">S 4\.82<\/span>/);
    assert.match(got, /<span class="rl-salary">500万円<\/span>/);
    assert.match(got, /<span class="rl-workers">100人<\/span>/);
    assert.match(got, /<span class="risk-pill low">3\.6\/10<\/span>/);
    assert.match(got, /<span class="rl-chevron" aria-hidden="true">›<\/span>/);
    assert.equal(got.includes('class="rl-name" href='), false);
    assert.equal([...got.matchAll(/<a /g)].length, 1);
  });

  test('escapes name and sector; null AI is em-dash', () => {
    const got = renderInterestItem({
      ...item,
      name_ja: '<b>x</b>',
      sector_ja: 'A & B',
      ai_risk: null,
      salary: null,
      workers: null,
    }, 'R');
    assert.equal(got.includes('<b>'), false);
    assert.match(got, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(got, /A &amp; B/);
    assert.match(got, /<span class="risk-pill mid">—<\/span>/);
    assert.match(got, /<span class="rmini-score">R 4\.82<\/span>/);
  });
});
