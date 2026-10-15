import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { CAREER_PERSONAS, type CareerPersona } from '@/views/careers-meta.js';
import type { GenreOccupation } from '@/views/genre-hub.js';
import { buildCareerBindings, buildCareerItems } from './_career-bindings.ts';
import { syntheticDetails } from '../_bindings-fixtures.ts';

const persona: CareerPersona = {
  slug: 'test-persona',
  short_ja: '試験層',
  title_ja: '試験ペルソナ',
  description_ja: 'D'.repeat(120),
  cautions_ja: ['注意<1>', '注意2'],
  advantages_ja: ['利点1', '利点2'],
  og_eyebrow: 'X',
  recommend: (d) => (d.id === 4 ? null : d.id),
};

const occ = (id: number, risk: number | null, salary: number | null, sector: string): GenreOccupation => ({
  id, name_ja: `職業${id}`, primary_score: id, ai_risk: risk, risk_band: null,
  workers: 10, salary, monthly_hours: null, average_age: null, sector_id: sector, sector_ja: sector,
});

describe('buildCareerItems', () => {
  test('drops null scores, sorts by score desc and maps fields', () => {
    const items = buildCareerItems(syntheticDetails(), persona);
    assert.deepEqual(items.map((i) => i.id), [3, 2, 1]);
    assert.equal(items[0]!.primary_score, 3);
    assert.equal(items[0]!.name_ja, '職業3');
    assert.equal(items[0]!.sector_ja, '建設');
  });

  test('caps results at 30 and falls back to #id / empty sector', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: i + 1 }));
    const items = buildCareerItems(many, { ...persona, recommend: (d) => d.id });
    assert.equal(items.length, 30);
    assert.equal(items[0]!.name_ja, '#40');
    assert.equal(items[0]!.sector_id, '');
    assert.equal(items[0]!.ai_risk, null);
  });
});

describe('buildCareerBindings', () => {
  test('builds canonical, title and stats', async () => {
    const items = [occ(1, 4, 500, '医療'), occ(2, 6, 700, '医療'), occ(3, null, null, '建設')];
    const b = buildCareerBindings({ persona, items, graph: await loadGraph() });
    assert.equal(b.canonical, 'https://mirai-shigoto.com/pro/careers/test-persona');
    assert.equal(b.ogImage, 'https://mirai-shigoto.com/api/og?career=test-persona');
    assert.equal(b.title, '試験ペルソナ｜推薦 TOP 3 | 未来の仕事');
    assert.ok(b.seoDesc.includes('D'.repeat(80) + '…'));
    assert.ok(b.statsHtml.includes('<dd>3</dd>'));
    assert.ok(b.statsHtml.includes('5.0/10 変化 中くらい'));
    assert.ok(b.statsHtml.includes('600 万円'));
  });

  test('shows dashes for stats when no risk or salary data exists', async () => {
    const b = buildCareerBindings({ persona, items: [occ(1, null, null, '')], graph: await loadGraph() });
    assert.ok(b.statsHtml.includes('<dd>—</dd>'));
    const empty = buildCareerBindings({ persona, items: [], graph: await loadGraph() });
    assert.ok(empty.faqHtml.includes('推薦数が少ない'));
  });

  test('emits escaped lists, related list without self, and valid JSON-LD', async () => {
    const items = [occ(1, 4, 500, '医療')];
    const b = buildCareerBindings({ persona, items, graph: await loadGraph() });
    assert.equal(b.cautionsHtml, '<ul class="cautions"><li>注意&lt;1&gt;</li><li>注意2</li></ul>');
    assert.equal(b.advantagesHtml, '<ul class="advantages"><li>利点1</li><li>利点2</li></ul>');
    assert.equal((b.relatedHtml.match(/<li>/g) ?? []).length, CAREER_PERSONAS.length);
    const ld = JSON.parse(b.jsonLd);
    const types = ld['@graph'].map((n: { '@type': string }) => n['@type']);
    assert.deepEqual(types, ['WebPage', 'CollectionPage', 'BreadcrumbList', 'ItemList', 'FAQPage']);
    assert.equal(ld['@graph'][3].numberOfItems, 1);
    assert.equal(ld['@graph'][4].mainEntity.length, 4);
  });
});
