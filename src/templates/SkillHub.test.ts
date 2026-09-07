import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderSkillItem } from './SkillHub.js';
import type { SkillOccupation } from '../views/skills-hub.js';

const item: SkillOccupation = {
  id: 1,
  name_ja: '看護師',
  skill_score: 4.82,
  ai_risk: 3.6,
  risk_band: 'low',
  workers: 100,
  salary: 500,
  sector_id: 'iryo',
  sector_ja: '医療',
};

describe('renderSkillItem', () => {
  test('§3.3 whole-row tap keeps skill-score extra + salary + workers', () => {
    const got = renderSkillItem(item, '批判的思考');
    assert.equal(
      got,
      '<li>' +
      '<a class="rl-row" href="/1" data-track-event="list_row_click">' +
      '<span class="rl-main">' +
      '<span class="rl-name">看護師</span>' +
      '<span class="rl-meta">医療 · <span class="skill-score">批判的思考 4.82</span> · <span class="rl-salary">500万円</span> · <span class="rl-workers">100人</span></span>' +
      '</span>' +
      '<span class="rl-end">' +
      '<span class="risk-pill low">3.6/10</span>' +
      '<span class="rl-chevron" aria-hidden="true">›</span>' +
      '</span>' +
      '</a>' +
      '</li>',
    );
  });

  test('escapes name, sector, and shortJa; null AI is em-dash', () => {
    const got = renderSkillItem({
      ...item,
      name_ja: '<b>x</b>',
      sector_ja: 'A & B',
      ai_risk: null,
      salary: null,
      workers: null,
    }, '<script>');
    assert.equal(got.includes('<b>'), false);
    assert.equal(got.includes('<script>'), false);
    assert.match(got, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(got, /A &amp; B/);
    assert.match(got, /&lt;script&gt; 4\.82/);
    assert.match(got, /<span class="risk-pill mid">—<\/span>/);
    assert.equal([...got.matchAll(/<a /g)].length, 1);
    assert.equal(got.includes('class="rl-name" href='), false);
  });
});
