import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildRankingHitsByOcc,
  computeSpokeHubs,
  renderSpokeHubsSection,
  type DetailFileSpoke,
  type RankingHit,
} from './spoke-hub-graph.js';
import { QA_ITEMS } from './qa-meta.js';

describe('buildRankingHitsByOcc', () => {
  test('empty rankings and empty item lists yield no hits', () => {
    assert.deepEqual(buildRankingHitsByOcc([]), new Map());
    assert.deepEqual(buildRankingHitsByOcc([{ slug: 'workers', items: [] }]), new Map());
  });
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
  test('missing, null, and empty optional dimensions omit all groups', () => {
    assert.deepEqual(computeSpokeHubs({ id: 999_999 }), { groups: [], total: 0 });
    assert.deepEqual(computeSpokeHubs({
      id: 999_999,
      sector: { id: 'incomplete' },
      abilities_top5: [], knowledge_top5: null, skills_top10: [],
      work_values_top5: null, work_characteristics_top5: [], interests: null,
    }, { rankingHitsByOcc: new Map() }), { groups: [], total: 0 });
    assert.deepEqual(computeSpokeHubs({
      id: 999_999, interests: { realistic: 0, investigative: -1 },
    }), { groups: [], total: 0 });
  });

  test('keeps unknown ranking slugs as display-name fallbacks', () => {
    const result = computeSpokeHubs({ id: 999_999 }, {
      rankingHitsByOcc: new Map([[999_999, [{ slug: 'fixture-ranking' as RankingHit['slug'], rank: 9 }]]]),
    });
    assert.deepEqual(result.groups[0]?.items, [{
      category: 'ランキング', name: 'fixture-ranking', href: '/rankings/fixture-ranking',
      desc: 'この職業は 9 位',
    }]);
    assert.equal(result.total, 1);
  });
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

  test('orders and caps knowledge, skills, values, work styles, career, license, QA, and compare groups', () => {
    const dimension = (key: string, score: number) => ({ key, score, label_ja: 'fixture' });
    const detail: DetailFileSpoke = {
      id: 156,
      ai_risk: { score: 2 },
      stats: { salary_man_yen: 600, workers: 100_000, monthly_hours: 140, average_age: 32, recruit_ratio: 2 },
      related_certs_ja: ['看護師', '簿記'],
      knowledge_top5: [
        dimension('production_processing', 3), dimension('mechanical', 5),
        dimension('unconfigured', 10), dimension('customer_personal_service', 7),
      ],
      skills_top10: [
        dimension('coordination', 2), dimension('critical_thinking', 6),
        dimension('programming', 8), dimension('unconfigured', 10),
      ],
      work_values_top5: [dimension('autonomy', 8), dimension('achievement', 3)],
      work_characteristics_top5: [dimension('standing', 9), dimension('outdoor_work', 2)],
    };
    const before = structuredClone(detail);
    const result = computeSpokeHubs(detail);
    assert.deepEqual(result.groups.map((g) => g.category), [
      '知識', 'スキル', '価値観', '働き方', 'キャリア段階', '資格', 'Q&A', '比較',
    ]);
    assert.deepEqual(result.groups.map((g) => g.items.map((item) => item.href)), [
      ['/knowledge/customer-service', '/knowledge/mechanical-knowledge'],
      ['/skills/programming', '/skills/critical-thinking'],
      ['/values/independence'],
      ['/work-styles/desk-vs-genba'],
      ['/careers/30s-early', '/careers/20-late'],
      ['/licenses/national-vs-private', '/licenses/gyoumu-dokusen'],
      ['/q/shikaku-mamoru', '/q/tenshoku-30s'],
      ['/compare/kango-vs-helper', '/compare/kango-vs-yakuzaishi'],
    ]);
    assert.equal(result.total, 14);
    for (const group of result.groups) {
      assert.ok(group.items.every((item) => item.category === group.category && item.name && item.desc));
    }
    const qaItems = result.groups[6]!.items;
    for (const [index, slug] of ['shikaku-mamoru', 'tenshoku-30s'].entries()) {
      const qa = QA_ITEMS.find((q) => q.slug === slug)!;
      assert.equal(qaItems[index]!.name, qa.question);
      assert.equal(qaItems[index]!.desc, qa.short_answer.slice(0, 50) + '…');
    }
    assert.deepEqual(detail, before);
  });

  test('finds comparisons when the occupation is the second side of a pair', () => {
    const result = computeSpokeHubs({ id: 133 });
    assert.deepEqual(result.groups.map((g) => g.items.map((item) => item.href)), [
      ['/compare/kango-vs-helper'],
    ]);
    assert.equal(result.total, 1);
  });

  test('ranks dimensions before applying the top-five window and interest defaults', () => {
    const dimensions = [
      { key: 'stamina', label_ja: 'fixture', score: 1 },
      ...Array.from({ length: 5 }, (_, i) => ({ key: `unknown-${i}`, label_ja: 'fixture', score: 10 - i })),
    ];
    const result = computeSpokeHubs({ id: 999_999, abilities_top5: dimensions, interests: { artistic: 4 } });
    assert.deepEqual(result.groups.map((g) => g.items.map((item) => item.href)), [['/interests/artistic']]);
    assert.equal(result.total, 1);
    assert.equal(dimensions[0]!.key, 'stamina');
  });
});

describe('renderSpokeHubsSection', () => {
  test('omits empty results', () => {
    assert.equal(renderSpokeHubsSection({ groups: [], total: 0 }), '');
  });

  test('renders grouped links in order, escapes all fields, and omits absent descriptions', () => {
    const raw = `<tag>&"'`;
    const escaped = '&lt;tag&gt;&amp;&quot;&#x27;';
    const html = renderSpokeHubsSection({
      total: 3,
      groups: [
        { category: raw, items: [
          { category: raw, name: raw, href: `/hub?name=${raw}`, desc: raw },
          { category: raw, name: 'second', href: '/second' },
        ] },
        { category: 'last', items: [{ category: 'last', name: 'last', href: '/last', desc: '' }] },
      ],
    });
    assert.match(html, /<section class="related-hubs"/);
    assert.match(html, /<div class="related-hubs-grid">/);
    assert.equal((html.match(/class="related-hub-group"/g) ?? []).length, 2);
    assert.equal((html.match(/class="rh-link"/g) ?? []).length, 3);
    assert.equal((html.match(/class="rh-desc"/g) ?? []).length, 1);
    assert.ok(html.includes(`<h3 class="rh-cat">${escaped}</h3>`));
    assert.ok(html.includes(`<span class="rh-name">${escaped}</span>`));
    assert.ok(html.includes(`<span class="rh-desc">${escaped}</span>`));
    assert.ok(html.includes(`href="/hub?name=${escaped}"`));
    assert.ok(html.includes('（3 件）'));
    assert.ok(html.indexOf('href="/second"') < html.indexOf('href="/last"'));
    assert.ok(!html.includes(raw));
    assert.ok(html.endsWith('</section>'));
  });
});
