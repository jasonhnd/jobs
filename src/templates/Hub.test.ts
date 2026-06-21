import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderGenreIndexJsonLd, renderGenreJsonLd } from './Hub.js';
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
