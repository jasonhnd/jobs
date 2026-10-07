import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  renderExploreGenreCards,
  renderExploreIndexCards,
  renderExploreIndexJsonLd,
  renderExploreOtherRoutes,
  renderExploreSlugJsonLd,
  renderGenreHubIndexCards,
  renderGenreIndexJsonLd,
  renderGenreIndexSpotlight,
  renderGenreJsonLd,
  renderQGroupsHtml,
  renderRankItem,
} from './Hub.js';
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
  test('omits the genre score chip when the hub hides its sort key (#884)', () => {
    const got = renderRankItem({ ...item, primary_score: -141 }, '育児両立', false);
    assert.ok(!got.includes('genre-score'));
    assert.ok(!got.includes('-141'));
    assert.ok(got.includes('<span class="rl-meta">医療 · <span class="rl-salary">500万円</span>'));
  });

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

  test('detail graph adds FAQPage and falls back to an id label', () => {
    const got = JSON.parse(renderGenreJsonLd(
      'https://mirai-shigoto.com/abilities/test',
      config,
      [{ ...item, id: 9, name_ja: '' }],
      'desc',
      [['Q', 'A & B']],
      'abilities',
      'Label',
    ));
    const types = (got['@graph'] as Array<{ '@type': string }>).map((node) => node['@type']);
    assert.equal(types.includes('FAQPage'), true);
    assert.equal(types.includes('ItemList'), true);
    const list = (got['@graph'] as Array<{ '@type': string; itemListElement?: Array<{ name: string }> }>)
      .find((node) => node['@type'] === 'ItemList');
    assert.equal(list?.itemListElement?.[0]?.name, '#9');
  });
});

describe('renderRankItem empty fields', () => {
  test('uses the id label and skips an empty sector, salary, and worker count', () => {
    const got = renderRankItem({
      ...item,
      id: 3,
      name_ja: '',
      sector_ja: '',
      salary: 0,
      workers: 0,
      ai_risk: 9,
    }, 'Axis');
    assert.match(got, /class="rl-name">#3</);
    assert.match(got, /class="rl-meta"><span class="genre-score">Axis /);
    assert.match(got, /class="risk-pill high"/);
    assert.equal(got.includes('rl-salary'), false);
    assert.equal(got.includes('rl-workers'), false);
    assert.equal(got.includes('class="rl-name" href='), false);
  });
});

describe('renderGenreHubIndexCards', () => {
  test('prefixes the path, truncates the description, and omits an empty top line', () => {
    const html = renderGenreHubIndexCards([
      {
        slug: 'one',
        short_ja: 'A & B',
        description_ja: 'x'.repeat(100),
        count: 4,
        top: '<top>',
        countLabel: '4 items',
      },
      {
        slug: 'two',
        short_ja: 'C',
        description_ja: 'short',
        count: 1,
        top: '',
        countLabel: '1 <item>',
      },
    ], 'abilities', 10);
    assert.match(html, /href="\/abilities\/one"/);
    assert.match(html, /class="gci-name">A &amp; B</);
    assert.match(html, new RegExp(`class="gci-desc">${'x'.repeat(10)}…`));
    assert.match(html, /class="iri-preview">1位 &lt;top&gt;</);
    assert.match(html, /class="gci-count">4 items</);
    assert.match(html, /href="\/abilities\/two"/);
    assert.match(html, /class="gci-count">1 &lt;item&gt;</);
    assert.equal((html.match(/class="iri-preview"/g) ?? []).length, 1);
  });
});

describe('renderGenreIndexSpotlight', () => {
  test('returns empty markup when there is nothing to show', () => {
    assert.equal(renderGenreIndexSpotlight([]), '');
  });

  test('links each occupation and uses an em dash when salary is missing', () => {
    const html = renderGenreIndexSpotlight([
      { ...item, id: 8, name_ja: 'N & N', ai_risk: 2, salary: 400 },
      { ...item, id: 404, name_ja: 'Z', ai_risk: null, salary: null },
    ]);
    assert.match(html, /<section aria-label=/);
    assert.match(html, /<ul class="genre-spotlight">/);
    assert.match(html, /href="\/8"/);
    assert.match(html, /href="\/occupations\/404"/);
    assert.match(html, /class="gsp-name">N &amp; N</);
    assert.match(html, /class="risk-pill low"/);
    assert.match(html, /class="risk-pill mid"/);
    assert.match(html, /class="gsp-salary">400 万円</);
    assert.match(html, /class="gsp-salary">—</);
  });
});

describe('renderQGroupsHtml', () => {
  test('one details block per question, with a detail link', () => {
    const html = renderQGroupsHtml([
      ['Group <1>', [{ slug: 'alpha', question: 'Q <1>', short_answer: 'A & B' }]],
      ['Empty', []],
    ]);
    assert.equal((html.match(/<section>/g) ?? []).length, 2);
    assert.match(html, /<h2>Group &lt;1&gt; \(1\)<\/h2>/);
    assert.match(html, /<h2>Empty \(0\)<\/h2>/);
    assert.match(html, /<ul class="qa-list">/);
    assert.match(html, /<li class="qa-item"><details><summary>Q &lt;1&gt;<\/summary>/);
    assert.match(html, /class="qa-short">A &amp; B</);
    assert.match(html, /class="qa-detail-link" href="\/q\/alpha"/);
  });
});

describe('explore hub renderers', () => {
  test('index cards count genres and truncate the description', () => {
    const html = renderExploreIndexCards([{
      slug: 'work',
      short_ja: 'W & W',
      description_ja: 'y'.repeat(100),
      genreCount: 3,
    }]);
    assert.match(html, /href="\/explore\/work"/);
    assert.match(html, /class="gci-name">W &amp; W</);
    assert.match(html, new RegExp(`class="gci-desc">${'y'.repeat(90)}…`));
    assert.match(html, /class="gci-count">3 /);
  });

  test('genre cards prefix a relative path and keep an absolute one', () => {
    const html = renderExploreGenreCards([
      { path: 'abilities/x', label: 'L & L', desc: 'd' },
      { path: '/skills/y', label: 'M', desc: 'e <f>' },
    ]);
    assert.match(html, /href="\/abilities\/x"/);
    assert.match(html, /href="\/skills\/y"/);
    assert.match(html, /class="gci-name">L &amp; L</);
    assert.match(html, /class="gci-desc">e &lt;f&gt;</);
    assert.match(html, /class="gci-count">/);
  });

  test('other routes wrap a related-genre list', () => {
    const html = renderExploreOtherRoutes([{
      slug: 'compare',
      short_ja: 'C & C',
      description_ja: 'z'.repeat(70),
    }]);
    assert.match(html, /^<ul class="related-genre">/);
    assert.match(html, /href="\/explore\/compare"/);
    assert.match(html, /class="rg-name">C &amp; C</);
    assert.match(html, new RegExp(`class="rg-desc">${'z'.repeat(60)}…`));
    assert.match(html, /<\/ul>$/);
  });

  test('explore JSON-LD is a WebPage plus breadcrumbs', () => {
    const index = JSON.parse(renderExploreIndexJsonLd());
    const indexTypes = (index['@graph'] as Array<{ '@type': string; url?: string }>).map((node) => node['@type']);
    assert.deepEqual(indexTypes, ['WebPage', 'BreadcrumbList']);
    assert.equal(
      (index['@graph'] as Array<{ url?: string }>)[0]?.url,
      'https://mirai-shigoto.com/explore',
    );

    const slug = JSON.parse(renderExploreSlugJsonLd('work', 'Title <T>', 'desc'));
    const page = (slug['@graph'] as Array<{ '@type': string; url?: string; name?: string }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.equal(page?.url, 'https://mirai-shigoto.com/explore/work');
    assert.equal(page?.name, 'Title <T>');
    const crumbs = (slug['@graph'] as Array<{ itemListElement?: unknown[] }>)
      .find((node) => node.itemListElement);
    assert.equal(crumbs?.itemListElement?.length, 3);
  });
});
