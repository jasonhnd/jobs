import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { asOccupationId, asSectorId, type KnowledgeGraph } from '@/graph';
import type { OccupationId } from '@/graph';
import { getMbtiContentBySlug } from './mbti-content.js';
import { buildMbtiPageView } from './mbti-page.js';

const content = getMbtiContentBySlug('enfp')!;

function makeAiois(score: number) {
  return {
    d1: score,
    d2: score,
    d3: 1,
    d4: 2,
    d5: 3,
    d6: 4,
    d7: 5,
    d8: 6,
    d9: 7,
    d10: 8,
    transformation: score,
    displacement: 1.2,
  };
}

function makeGraph(): KnowledgeGraph {
  const sectorId = asSectorId('creative');
  const occupationSector = new Map<number, ReturnType<typeof asSectorId>>();
  const occupations = new Map(
    content.occupations.map((item, index) => {
      const id = asOccupationId(item.occupationId);
      occupationSector.set(item.occupationId, sectorId);
      return [
        id,
        {
          id,
          titleJa: `職業${item.occupationId}`,
          aiRisk: {
            score: 4 + index / 10,
            rationaleJa: 'fixture',
            confidence: null,
            model: 'fixture',
            date: '2026-06-13',
            aiois: makeAiois(4 + index / 10),
          },
        },
      ];
    }),
  );

  return {
    occupations,
    sectors: new Map([[sectorId, { id: sectorId, nameJa: 'クリエイティブ・メディア' }]]),
    sectorOf(id: OccupationId) {
      return occupationSector.get(Number(id)) ?? null;
    },
  } as unknown as KnowledgeGraph;
}

describe('buildMbtiPageView', () => {
  test('builds route metadata and occupation cards from graph AIOIS data', () => {
    const page = buildMbtiPageView(content, makeGraph());

    assert.equal(page.canonical, 'https://mirai-shigoto.com/mbti/enfp');
    assert.equal(page.title, 'ENFPのAI時代の働き方｜職業データで見るAI影響度');
    assert.equal(page.occupations.length, content.occupations.length);
    assert.equal(page.occupations[0]?.id, content.occupations[0]?.occupationId);
    assert.equal(page.occupations[0]?.nameJa, `職業${content.occupations[0]?.occupationId}`);
    assert.equal(page.occupations[0]?.transformation, 4);
    assert.equal(page.occupations[0]?.displacement, 1.2);
    assert.equal(page.occupations[0]?.sectorJa, 'クリエイティブ・メディア');
  });

  test('emits WebPage and BreadcrumbList JSON-LD with required ids', () => {
    const page = buildMbtiPageView(content, makeGraph());
    const parsed = JSON.parse(page.jsonLd) as {
      '@graph': Array<Record<string, unknown>>;
    };

    const webPage = parsed['@graph'].find((node) => node['@type'] === 'WebPage');
    const breadcrumb = parsed['@graph'].find((node) => node['@type'] === 'BreadcrumbList');

    assert.equal(webPage?.['@id'], 'https://mirai-shigoto.com/mbti/enfp#webpage');
    assert.equal(webPage?.url, 'https://mirai-shigoto.com/mbti/enfp');
    assert.equal(webPage?.inLanguage, 'ja');
    assert.equal(breadcrumb?.['@id'], 'https://mirai-shigoto.com/mbti/enfp#breadcrumb');
    assert.deepEqual(
      (breadcrumb?.itemListElement as Array<{ name: string }>).map((item) => item.name),
      ['日本の職業 AI 影響マップ', 'MBTIタイプ x AI時代の働き方', 'ENFPのAI時代の働き方'],
    );
  });
});
