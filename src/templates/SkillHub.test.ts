import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  renderHubJsonLd,
  renderJsonLd,
  renderRelatedSkills,
  renderSkillItem,
  renderSkillsHubCards,
} from './SkillHub.js';
import type { SkillOccupation } from '../views/skills-hub.js';
import type { SkillMeta } from '../views/skills-meta.js';

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

  test('empty name uses the id and skips sector, salary, and workers', () => {
    const got = renderSkillItem({
      ...item,
      id: 11,
      name_ja: '',
      sector_ja: '',
      salary: 0,
      workers: 0,
      ai_risk: 9,
    }, 'Axis');
    assert.match(got, /class="rl-name">#11</);
    assert.match(got, /class="rl-meta"><span class="skill-score">Axis /);
    assert.match(got, /class="risk-pill high"/);
    assert.equal(got.includes('rl-salary'), false);
    assert.equal(got.includes('rl-workers'), false);
  });
});

const skillMeta = (slug: SkillMeta['slug']): SkillMeta => ({
  slug,
  ipd_key: slug,
  short_ja: `S-${slug}`,
  title_ja: `T-${slug}`,
  description_ja: 'd'.repeat(80),
  use_cases_ja: [],
  how_to_train_ja: [],
  og_eyebrow: 'EYE',
});

describe('renderRelatedSkills', () => {
  test('drops the current slug and truncates the description', () => {
    const html = renderRelatedSkills('programming', [
      skillMeta('programming'),
      skillMeta('judgment'),
    ]);
    assert.match(html, /<ul class="related-skills">/);
    assert.equal((html.match(/<li>/g) ?? []).length, 1);
    assert.equal(html.includes('/skills/programming'), false);
    assert.match(html, /href="\/skills\/judgment"/);
    assert.match(html, /class="rs-name">S-judgment</);
    assert.match(html, new RegExp(`class="rs-desc">${'d'.repeat(60)}…`));
  });
});

describe('SkillHub JSON-LD', () => {
  test('detail graph includes the list and an optional FAQPage', () => {
    const withFaq = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/skills/programming',
      skillMeta('programming'),
      [{ ...item, name_ja: '' }],
      'desc',
      [['Q <1>', 'A']],
    ));
    const types = (withFaq['@graph'] as Array<{ '@type': string }>).map((node) => node['@type']);
    assert.equal(types.includes('FAQPage'), true);
    assert.equal(types.includes('ItemList'), true);
    assert.equal(types.includes('CollectionPage'), true);
    const list = (withFaq['@graph'] as Array<{ '@type': string; itemListElement?: Array<{ name: string }> }>)
      .find((node) => node['@type'] === 'ItemList');
    assert.equal(list?.itemListElement?.[0]?.name, '#1');

    const bare = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/skills/programming',
      skillMeta('programming'),
      [],
      'desc',
      null,
    ));
    const bareTypes = (bare['@graph'] as Array<{ '@type': string }>).map((node) => node['@type']);
    assert.equal(bareTypes.includes('FAQPage'), false);
  });

  test('hub JSON-LD points at /skills', () => {
    const got = JSON.parse(renderHubJsonLd());
    const page = (got['@graph'] as Array<{ '@type': string; url?: string }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.equal(page?.url, 'https://mirai-shigoto.com/skills');
  });
});

describe('renderSkillsHubCards', () => {
  test('shows a preview only when one is provided', () => {
    const html = renderSkillsHubCards([
      {
        slug: 'programming',
        short_ja: 'P & P',
        description_ja: 'd'.repeat(20),
        top_preview: 'Top <1>',
        top_count: 30,
      },
      {
        slug: 'judgment',
        short_ja: 'J',
        description_ja: 'short',
        top_preview: undefined,
        top_count: 0,
      },
    ]);
    assert.match(html, /href="\/skills\/programming"/);
    assert.match(html, /class="sci-name">P &amp; P</);
    assert.match(html, /class="sci-preview">Top &lt;1&gt;</);
    assert.match(html, /class="sci-count">TOP 30 /);
    assert.match(html, /href="\/skills\/judgment"/);
    assert.equal((html.match(/class="sci-preview"/g) ?? []).length, 1);
    assert.match(html, /class="sci-desc">short…</);
  });
});
