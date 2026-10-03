import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { LICENSE_HUBS, matchLicense, rankLicense, type LicenseHub } from '@/views/licenses-meta.js';
import type { GenreOccupation } from '@/views/genre-hub.js';
import { buildLicenseBindings, buildLicenseItems } from './_license-bindings.ts';
import { syntheticDetails } from '../_bindings-fixtures.ts';

const hub: LicenseHub = {
  slug: 'test-hub',
  short_ja: '試験資格',
  title_ja: '試験資格ハブ',
  description_ja: 'E'.repeat(120),
  cert_keywords: ['宅地建物'],
  og_eyebrow: 'L',
  cert_examples_ja: ['資格<A>', '資格B', '資格C', '資格D'],
  difficulty_ja: '易',
};

const occ = (id: number, risk: number | null, salary: number | null, workers: number | null, sector: string): GenreOccupation => ({
  id, name_ja: `職業${id}`, primary_score: 1, ai_risk: risk, risk_band: null,
  workers, salary, monthly_hours: null, average_age: null, sector_id: sector, sector_ja: sector,
});

describe('buildLicenseItems', () => {
  test('filters by matcher, ranks, and uses cert count as primary score', () => {
    const items = buildLicenseItems(syntheticDetails(), hub, matchLicense, rankLicense);
    assert.deepEqual(items.map((i) => i.id), [2, 1]);
    assert.equal(items[0]!.primary_score, 2);
    assert.equal(items[1]!.primary_score, 1);
  });

  test('caps at 30 and defaults missing fields', () => {
    const many = Array.from({ length: 35 }, (_, i) => ({ id: i + 1 }));
    const items = buildLicenseItems(many, hub, () => true, (d) => d.id);
    assert.equal(items.length, 30);
    assert.equal(items[0]!.name_ja, '#35');
    assert.equal(items[0]!.primary_score, 0);
    assert.equal(items[0]!.sector_ja, '');
  });
});

describe('buildLicenseBindings', () => {
  test('builds canonical, title, stats with totals', async () => {
    const items = [occ(1, 4, 500, 100, '医療'), occ(2, 6, 700, 200, '医療'), occ(3, null, null, null, '')];
    const b = buildLicenseBindings({ hub, items, graph: await loadGraph() });
    assert.equal(b.canonical, 'https://mirai-shigoto.com/licenses/test-hub');
    assert.equal(b.ogImage, 'https://mirai-shigoto.com/api/og?license=test-hub');
    assert.equal(b.title, '試験資格ハブ｜3 職業 | 未来の仕事');
    assert.ok(b.seoDesc.includes('E'.repeat(80) + '…'));
    assert.ok(b.statsHtml.includes('<dd>3</dd>'));
    assert.ok(b.statsHtml.includes('600 万円'));
    assert.ok(b.statsHtml.includes('300 人'));
  });

  test('shows dashes without risk/salary data and handles no items', async () => {
    const b = buildLicenseBindings({ hub, items: [], graph: await loadGraph() });
    assert.ok(b.statsHtml.includes('<dd>—</dd>'));
    assert.equal(b.rankItems, '');
  });

  test('emits escaped examples, trimmed related list and valid JSON-LD', async () => {
    const b = buildLicenseBindings({ hub, items: [occ(1, 4, 500, 1, '医療')], graph: await loadGraph() });
    assert.ok(b.examplesHtml.startsWith('<ul class="cert-examples"><li>資格&lt;A&gt;</li>'));
    assert.equal((b.relatedHtml.match(/<li>/g) ?? []).length, Math.min(8, LICENSE_HUBS.length));
    const ld = JSON.parse(b.jsonLd);
    const types = ld['@graph'].map((n: { '@type': string }) => n['@type']);
    assert.deepEqual(types, ['WebPage', 'CollectionPage', 'BreadcrumbList', 'ItemList', 'FAQPage']);
    assert.equal(ld['@graph'][4].mainEntity.length, 4);
  });
});
