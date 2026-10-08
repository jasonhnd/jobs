import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  renderHubJsonLd,
  renderInterestItem,
  renderInterestsHubCards,
  renderJsonLd,
  renderRelatedInterests,
  renderRiasecMini,
} from './InterestHub.js';
import type { InterestOccupation } from '../views/interests.js';
import type { InterestMeta } from '../views/interests-meta.js';

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
    assert.match(got, /<span class="risk-pill low">3\.6\/10 変化 小さい<\/span>/);
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

  test('empty name uses the id and skips sector, salary, and workers', () => {
    const got = renderInterestItem({
      ...item,
      id: 7,
      name_ja: '',
      sector_ja: '',
      salary: 0,
      workers: 0,
      ai_risk: 9,
    }, 'S');
    assert.match(got, /class="rl-name">#7</);
    assert.match(got, /class="rl-meta"><span class="rmini-wrap">/);
    assert.match(got, /class="risk-pill high"/);
    assert.equal(got.includes('rl-salary'), false);
    assert.equal(got.includes('rl-workers'), false);
  });
});

describe('renderRiasecMini', () => {
  test('clamps bar height and marks only the primary letter', () => {
    const got = renderRiasecMini({
      ...item,
      riasec: { R: 0, I: 10, A: 2.5, S: 5, E: 1, C: 3 },
    }, 'I');
    assert.match(got, /class="rmini" aria-label="RIASEC profile"/);
    assert.equal((got.match(/rmini-bar/g) ?? []).length, 6);
    assert.match(got, /class="rmini-bar" style="height:2%"/);
    assert.match(got, /class="rmini-bar primary" style="height:100%"/);
    assert.equal((got.match(/primary/g) ?? []).length, 1);
  });
});

const interestMeta = (slug: InterestMeta['slug'], letter: InterestMeta['letter']): InterestMeta => ({
  slug,
  letter,
  name_ja: `N-${letter}`,
  title_ja: `T-${letter}`,
  description_ja: 'd'.repeat(100),
  characteristics_ja: [],
  typical_fields_ja: ['A', 'B', 'C', 'D'],
  og_eyebrow: 'EYE',
});

describe('renderRelatedInterests', () => {
  test('drops the current type and joins the first three fields', () => {
    const html = renderRelatedInterests('social', [
      interestMeta('social', 'S'),
      interestMeta('realistic', 'R'),
    ]);
    assert.match(html, /<ul class="related-interests">/);
    assert.equal((html.match(/<li>/g) ?? []).length, 1);
    assert.equal(html.includes('/interests/social'), false);
    assert.match(html, /href="\/interests\/realistic"/);
    assert.match(html, /class="ri-letter">R</);
    assert.match(html, /class="ri-name">N-R/);
    assert.match(html, /class="ri-desc">A・B・C</);
    assert.equal(html.includes('D'), false);
  });
});

describe('InterestHub JSON-LD', () => {
  test('detail graph includes the list and an optional FAQPage', () => {
    const withFaq = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/interests/social',
      interestMeta('social', 'S'),
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
      'https://mirai-shigoto.com/interests/social',
      interestMeta('social', 'S'),
      [],
      'desc',
      null,
    ));
    const bareTypes = (bare['@graph'] as Array<{ '@type': string }>).map((node) => node['@type']);
    assert.equal(bareTypes.includes('FAQPage'), false);
  });

  test('hub JSON-LD points at /interests', () => {
    const got = JSON.parse(renderHubJsonLd());
    const page = (got['@graph'] as Array<{ '@type': string; url?: string }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.equal(page?.url, 'https://mirai-shigoto.com/interests');
  });
});

describe('renderInterestsHubCards', () => {
  test('shows a preview only when one is provided', () => {
    const html = renderInterestsHubCards([
      {
        slug: 'social',
        letter: 'S',
        name_ja: 'N & N',
        description_ja: 'd'.repeat(20),
        top_preview: 'P <1>',
        top_count: 30,
      },
      {
        slug: 'realistic',
        letter: 'R',
        name_ja: 'R',
        description_ja: 'short',
        top_preview: null,
        top_count: 0,
      },
    ]);
    assert.match(html, /href="\/interests\/social"/);
    assert.match(html, /class="iri-letter">S</);
    assert.match(html, /class="iri-name">N &amp; N/);
    assert.match(html, /class="iri-preview">P &lt;1&gt;</);
    assert.match(html, /class="iri-count">TOP 30 /);
    assert.match(html, /href="\/interests\/realistic"/);
    assert.equal((html.match(/class="iri-preview"/g) ?? []).length, 1);
    assert.match(html, /class="iri-desc">short…</);
  });
});
