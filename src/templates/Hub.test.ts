import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderGenreIndexJsonLd, renderGenreJsonLd, renderRankItem } from './Hub.js';
import type { GenreHubConfig, GenreOccupation } from '../views/genre-hub.js';

const config: GenreHubConfig = {
  slug: 'test',
  short_ja: 'テスト',
  title_ja: 'テスト職業',
  description_ja: 'テスト説明',
  og_eyebrow: 'テスト',
};

const item: GenreOccupation = {
  id: 1,
  name_ja: '看護師',
  primary_score: 1,
  ai_risk: 4,
  risk_band: 'mid',
  workers: 100,
  salary: 500,
  monthly_hours: 160,
  average_age: 40,
  sector_id: 'iryo',
  sector_ja: '医療',
};

describe('renderRankItem', () => {
  test('§3.3 whole-row tap keeps genre-score extra + salary + workers', () => {
    const got = renderRankItem(item, '問題敏感性');
    assert.equal(
      got,
      '<li>' +
      '<a class="rl-row" href="/1" data-track-event="list_row_click">' +
      '<span class="rl-main">' +
      '<span class="rl-name">看護師</span>' +
      '<span class="rl-meta">医療 · <span class="genre-score">問題敏感性 1.00</span> · <span class="rl-salary">500万円</span> · <span class="rl-workers">100人</span></span>' +
      '</span>' +
      '<span class="rl-end">' +
      '<span class="risk-pill mid">4/10</span>' +
      '<span class="rl-chevron" aria-hidden="true">›</span>' +
      '</span>' +
      '</a>' +
      '</li>',
    );
  });

  test('escapes name, sector, and shortJa; null AI is em-dash', () => {
    const got = renderRankItem({
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
    assert.match(got, /&lt;script&gt; 1\.00/);
    assert.match(got, /<span class="risk-pill mid">—<\/span>/);
  });

  test('whole-row anchor is the only link', () => {
    const got = renderRankItem(item, 'テスト');
    assert.equal([...got.matchAll(/<a /g)].length, 1);
    assert.equal(got.includes('class="rl-name" href='), false);
  });
});

describe('Hub JSON-LD speakable', () => {
  test('genre detail WebPage points to the citable fact block', () => {
    const got = JSON.parse(renderGenreJsonLd(
      'https://mirai-shigoto.com/abilities/test',
      config,
      [item],
      'desc',
      null,
      'abilities',
      '能力から探す',
    ));
    const webpage = (got['@graph'] as Array<{ '@type': string; speakable?: unknown }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.deepEqual(webpage?.speakable, {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.ai-fact', '.intro'],
    });
  });

  test('genre index WebPage keeps a speakable hint without requiring a fact block', () => {
    const got = JSON.parse(renderGenreIndexJsonLd(
      'https://mirai-shigoto.com/abilities',
      '能力から探す',
      'desc',
    ));
    const webpage = (got['@graph'] as Array<{ '@type': string; speakable?: unknown }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.deepEqual(webpage?.speakable, {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.intro'],
    });
  });
});
