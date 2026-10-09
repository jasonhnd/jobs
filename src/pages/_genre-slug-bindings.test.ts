import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { loadGeoFacts } from '@/page-data/geo-facts-loader';
import { buildGenreResult, type GenreHubConfig } from '@/views/genre-hub.js';
import { buildGenreSlugBindings, type GenreSlugInput } from './_genre-slug-bindings.ts';
import { syntheticDetails } from './_bindings-fixtures.ts';

const CONFIGS: GenreHubConfig[] = [
  {
    slug: 'alpha',
    short_ja: 'アルファ',
    title_ja: 'アルファ職業',
    description_ja: '説明A',
    og_eyebrow: 'A',
    dimension_field: 'abilities_top5',
    dimension_key: 'ab-1',
    characteristics_ja: ['特徴<1>'],
    how_to_develop_ja: ['伸ばす1'],
  },
  { slug: 'beta', short_ja: 'ベータ', title_ja: 'ベータ職業', description_ja: 'B'.repeat(100), og_eyebrow: 'B', custom_filter: () => null },
];

async function input(overrides: Partial<GenreSlugInput> = {}, cfg = CONFIGS[0]!): Promise<GenreSlugInput> {
  return {
    result: buildGenreResult(syntheticDetails(), cfg),
    graph: await loadGraph(),
    genrePath: 'abilities',
    genreLabel: '能力から探す',
    ogParam: 'ability',
    allConfigs: CONFIGS,
    subTemplate: (s, n) => `${s}:${n}`,
    seoDescTemplate: (s, n, d) => `${s}|${n}|${d}`,
    relatedHeading: '他の能力',
    crossHubKey: 'abilities',
    geoFacts: loadGeoFacts(),
    ...overrides,
  };
}

describe('buildGenreSlugBindings', () => {
  test('derives canonical, og image, default title and templated text', async () => {
    const b = buildGenreSlugBindings(await input());
    assert.equal(b.canonical, 'https://mirai-shigoto.com/pro/abilities/alpha');
    assert.equal(b.ogImage, 'https://mirai-shigoto.com/api/og?ability=alpha');
    assert.ok(b.title.startsWith('アルファ職業｜TOP 4'));
    assert.equal(b.seoDesc, 'アルファ|4|説明A');
    assert.equal(b.subHtml, 'アルファ:4');
  });

  test('uses the title override when provided', async () => {
    const b = buildGenreSlugBindings(await input({ titleTemplate: (t, n) => `T-${t}-${n}` }));
    assert.equal(b.title, 'T-アルファ職業-4');
  });

  test('renders stats, rank items, FAQ and JSON-LD', async () => {
    const b = buildGenreSlugBindings(await input());
    assert.match(b.statsHtml, /^<dl class="stats">/);
    assert.equal(b.rankItems.length > 0, true);
    assert.ok(b.faqHtml.length > 0);
    const ld = JSON.parse(b.jsonLd);
    assert.ok(ld['@context'] || Array.isArray(ld) || ld['@graph']);
    assert.ok(b.aiFactHtml.length > 0);
    assert.ok(b.crossHubHtml.length >= 0);
  });

  test('renders an empty stats block when the result has no stats', async () => {
    const base = await input();
    const b = buildGenreSlugBindings({ ...base, result: { ...base.result, stats: [] } });
    assert.equal(b.statsHtml, '');
  });

  test('escapes characteristic lists and omits them when absent', async () => {
    const withLists = buildGenreSlugBindings(await input());
    assert.equal(withLists.charsHtml, '<ul class="characteristics"><li>特徴&lt;1&gt;</li></ul>');
    assert.equal(withLists.developHtml, '<ul class="how-to-develop"><li>伸ばす1</li></ul>');
    const none = buildGenreSlugBindings(await input({ result: buildGenreResult(syntheticDetails(), CONFIGS[1]!) }, CONFIGS[1]));
    assert.equal(none.charsHtml, '');
    assert.equal(none.developHtml, '');
  });

  test('related list excludes the current slug and truncates descriptions', async () => {
    const b = buildGenreSlugBindings(await input());
    assert.ok(!b.relatedHtml.includes('/pro/abilities/alpha"'));
    assert.ok(b.relatedHtml.includes('href="/pro/abilities/beta"'));
    assert.ok(b.relatedHtml.includes('B'.repeat(60) + '…'));
    assert.ok(!b.relatedHtml.includes('B'.repeat(61)));
  });

  test('falls back to loading geo facts when none are injected', async () => {
    const b = buildGenreSlugBindings(await input({ geoFacts: undefined }));
    assert.ok(b.aiFactHtml.length > 0);
  });
});
