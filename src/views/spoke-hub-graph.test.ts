import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildRankingHitsByOcc,
  computeSpokeHubs,
  type DetailFileSpoke,
  type RankingHit,
} from './spoke-hub-graph.js';

describe('buildRankingHitsByOcc', () => {
  test('inverts ranking items by occupation id and preserves 1-based ranks', () => {
    const hits = buildRankingHitsByOcc([
      { slug: 'ai-risk-low', items: [{ id: 10 }, { id: 20 }] },
      { slug: 'workers', items: [{ id: 20 }, { id: 10 }] },
    ]);

    assert.deepEqual(hits.get(10), [
      { slug: 'ai-risk-low', rank: 1 },
      { slug: 'workers', rank: 2 },
    ]);
    assert.deepEqual(hits.get(20), [
      { slug: 'ai-risk-low', rank: 2 },
      { slug: 'workers', rank: 1 },
    ]);
  });
});

describe('computeSpokeHubs', () => {
  test('assembles grouped sector, ranking, ability, and interest hubs with caps', () => {
    const id = 999_999;
    const rankingHits: RankingHit[] = [
      { slug: 'workers', rank: 4 },
      { slug: 'salary', rank: 8 },
      { slug: 'ai-risk-low', rank: 1 },
      { slug: 'short-hours', rank: 2 },
    ];
    const detail: DetailFileSpoke = {
      id,
      title: { ja: 'fixture occupation' },
      ai_risk: null,
      stats: null,
      sector: { id: 'test-sector', ja: 'テスト業界' },
      abilities_top5: [
        { key: 'not_configured', label_ja: '未設定', score: 99 },
        { key: 'stamina', label_ja: '持久力', score: 8 },
        { key: 'manual_dexterity', label_ja: '手作業', score: 7 },
        { key: 'static_strength', label_ja: '筋力', score: 6 },
      ],
      interests: {
        realistic: 5,
        investigative: 0,
        artistic: 0,
        social: 4,
        enterprising: 0,
        conventional: 1,
      },
    };

    const result = computeSpokeHubs(detail, {
      rankingHitsByOcc: new Map([[id, rankingHits]]),
    });

    assert.deepEqual(result.groups.map((g) => g.category), [
      '業種',
      'ランキング',
      '能力',
      '興味タイプ',
    ]);
    assert.equal(result.total, 8);

    assert.deepEqual(
      result.groups[1]!.items.map((item) => [item.href, item.desc]),
      [
        ['/rankings/workers', 'この職業は 4 位'],
        ['/rankings/salary', 'この職業は 8 位'],
        ['/rankings/ai-risk-low', 'この職業は 1 位'],
      ],
    );
    assert.deepEqual(
      result.groups[2]!.items.map((item) => [item.name, item.href]),
      [
        ['持久力', '/abilities/stamina'],
        ['細かい手作業', '/abilities/manual-dexterity-fine'],
      ],
    );
    assert.deepEqual(
      result.groups[3]!.items.map((item) => [item.name, item.href]),
      [
        ['R (現実的)', '/interests/realistic'],
        ['S (社会的)', '/interests/social'],
      ],
    );
  });
});
