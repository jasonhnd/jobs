/**
 * JsonLd.test.ts — pin the Schema.org JSON-LD output of the
 * occupation detail page's structured-data builder.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderOccupationJsonLd, type OccupationJsonLdInput } from './occupation-jsonld.js';

const baseInput: OccupationJsonLdInput = {
  id: 42,
  canonical: 'https://mirai-shigoto.com/42',
  pageName: 'プログラマー — AI 影響 6/10',
  pageDesc: '高度な情報通信プロフェッショナル。',
  nameJa: 'プログラマー',
  aliasesJa: [],
  sectorJa: null,
  aiRisk: 6,
  mhlwUrl: null,
  salaryMan: null,
  workers: null,
  age: null,
  hours: null,
  recruitRatio: null,
  hourlyWage: null,
  classificationMain: null,
  skillLabels: [],
  relatedCertsJa: [],
  tasksLeadJa: '',
  howToBecomeJa: '',
  faqs: [],
  datePublished: '2026-04-25',
  dateModified: '2026-04-30',
};

function parse(s: string): unknown {
  return JSON.parse(s);
}

describe('renderOccupationJsonLd', () => {
  test('emits a Schema.org @context and @graph wrapper', () => {
    const out = parse(renderOccupationJsonLd(baseInput)) as Record<string, unknown>;
    assert.equal(out['@context'], 'https://schema.org');
    assert.ok(Array.isArray(out['@graph']));
  });

  test('graph contains exactly 3 nodes when no FAQs (WebPage / Occupation / Breadcrumb)', () => {
    const out = parse(renderOccupationJsonLd(baseInput)) as { '@graph': Array<{ '@type': string }> };
    const types = out['@graph'].map((n) => n['@type']);
    assert.deepEqual(types, ['WebPage', 'Occupation', 'BreadcrumbList']);
  });

  test('graph contains 4 nodes (adds FAQPage) when faqs present', () => {
    const out = parse(
      renderOccupationJsonLd({
        ...baseInput,
        faqs: [
          ['なぜ?', 'こうだから。'],
          ['いつ?', 'いま。'],
        ],
      }),
    ) as { '@graph': Array<{ '@type': string }> };
    const types = out['@graph'].map((n) => n['@type']);
    assert.deepEqual(types, ['WebPage', 'Occupation', 'BreadcrumbList', 'FAQPage']);
  });

  test('WebPage references the canonical URL and uses pageName + pageDesc', () => {
    const out = parse(renderOccupationJsonLd(baseInput)) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const webpage = out['@graph'][0];
    assert.equal(webpage['@id'], 'https://mirai-shigoto.com/42#webpage');
    assert.equal(webpage.url, 'https://mirai-shigoto.com/42');
    assert.equal(webpage.name, 'プログラマー — AI 影響 6/10');
    assert.equal(webpage.description, '高度な情報通信プロフェッショナル。');
    assert.equal(webpage.inLanguage, 'ja');
    assert.equal(webpage.datePublished, '2026-04-25');
    assert.equal(webpage.dateModified, '2026-04-30');
  });

  test('Occupation classification: defaults to String(id) when classificationMain is null', () => {
    const out = parse(renderOccupationJsonLd(baseInput)) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const occ = out['@graph'][1];
    assert.equal(occ.occupationalCategory, '42');
  });

  test('Occupation classification: overridden by classificationMain when present', () => {
    const out = parse(
      renderOccupationJsonLd({ ...baseInput, classificationMain: 'mhlw-12345' }),
    ) as { '@graph': Array<Record<string, unknown>> };
    const occ = out['@graph'][1];
    assert.equal(occ.occupationalCategory, 'mhlw-12345');
  });

  test('Occupation.sameAs: null mhlwUrl ships as "sameAs": null (legacy parity)', () => {
    // JSON.stringify keeps `null` but drops `undefined`. The legacy
    // builder set sameAs from rec.url unconditionally; null values
    // are preserved as null in the rendered JSON.
    const out = parse(renderOccupationJsonLd(baseInput)) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const occ = out['@graph'][1];
    assert.equal(occ.sameAs, null);
  });

  test('Occupation.alternateName: single alias → string; multiple → array', () => {
    const single = parse(
      renderOccupationJsonLd({ ...baseInput, aliasesJa: ['プログラマ'] }),
    ) as { '@graph': Array<Record<string, unknown>> };
    assert.equal((single['@graph'][1] as { alternateName: unknown }).alternateName, 'プログラマ');

    const many = parse(
      renderOccupationJsonLd({ ...baseInput, aliasesJa: ['プログラマ', 'コーダー'] }),
    ) as { '@graph': Array<Record<string, unknown>> };
    assert.deepEqual(
      (many['@graph'][1] as { alternateName: unknown }).alternateName,
      ['プログラマ', 'コーダー'],
    );
  });

  test('Occupation.estimatedSalary present when salaryMan is set (in 万円, × 10_000)', () => {
    const out = parse(renderOccupationJsonLd({ ...baseInput, salaryMan: 540 })) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const salary = (out['@graph'][1] as { estimatedSalary?: Record<string, unknown> }).estimatedSalary!;
    assert.equal(salary.currency, 'JPY');
    assert.equal(salary.median, 5_400_000);
  });

  test('Occupation.workHours formatted with month + annual estimates when hours set', () => {
    const out = parse(renderOccupationJsonLd({ ...baseInput, hours: 165 })) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const occ = out['@graph'][1] as { workHours?: string };
    assert.equal(occ.workHours, '月平均 165 時間（年間約 1980 時間）');
  });

  test('Occupation.additionalProperty includes AI risk only when aiRisk is non-null', () => {
    const withRisk = parse(renderOccupationJsonLd({ ...baseInput, aiRisk: 8 })) as {
      '@graph': Array<{ additionalProperty?: Array<{ name: string; value: number }> }>;
    };
    const ap = withRisk['@graph'][1].additionalProperty ?? [];
    const aiProp = ap.find((p) => p.name === 'AI risk score (0-10)');
    assert.ok(aiProp);
    assert.equal(aiProp.value, 8);

    const noRisk = parse(renderOccupationJsonLd({ ...baseInput, aiRisk: null })) as {
      '@graph': Array<{ additionalProperty?: Array<{ name: string }> }>;
    };
    const ap2 = noRisk['@graph'][1].additionalProperty ?? [];
    assert.equal(ap2.find((p) => p.name === 'AI risk score (0-10)'), undefined);
  });

  test('Occupation.qualifications + educationRequirements both set when certs present', () => {
    const out = parse(
      renderOccupationJsonLd({ ...baseInput, relatedCertsJa: ['看護師', '保健師'] }),
    ) as { '@graph': Array<Record<string, unknown>> };
    const occ = out['@graph'][1] as {
      qualifications?: string[];
      educationRequirements?: string;
    };
    assert.deepEqual(occ.qualifications, ['看護師', '保健師']);
    assert.equal(occ.educationRequirements, '関連資格：看護師、保健師');
  });

  test('Occupation.experienceRequirements: first sentence of howToBecomeJa, ≤240 chars', () => {
    const out = parse(
      renderOccupationJsonLd({
        ...baseInput,
        howToBecomeJa: '専門学校または大学で関連分野を学ぶ。実務経験を経て現場で活躍する。',
      }),
    ) as { '@graph': Array<Record<string, unknown>> };
    const occ = out['@graph'][1] as { experienceRequirements?: string };
    assert.equal(occ.experienceRequirements, '専門学校または大学で関連分野を学ぶ。');
  });

  test('Occupation.experienceRequirements omitted when first sentence > 240 chars', () => {
    const out = parse(
      renderOccupationJsonLd({ ...baseInput, howToBecomeJa: 'あ'.repeat(300) + '。' }),
    ) as { '@graph': Array<Record<string, unknown>> };
    const occ = out['@graph'][1] as { experienceRequirements?: string };
    assert.equal(occ.experienceRequirements, undefined);
  });

  test('Occupation.responsibilities truncated to first 600 chars of tasksLeadJa', () => {
    const long = 'タスク。'.repeat(200);
    const out = parse(renderOccupationJsonLd({ ...baseInput, tasksLeadJa: long })) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const occ = out['@graph'][1] as { responsibilities?: string };
    assert.equal(occ.responsibilities!.length, 600);
  });

  test('BreadcrumbList: root → occupation, both positions correct', () => {
    const out = parse(renderOccupationJsonLd(baseInput)) as {
      '@graph': Array<{ itemListElement?: Array<{ position: number; name: string }> }>;
    };
    const items = out['@graph'][2].itemListElement!;
    assert.equal(items[0].position, 1);
    assert.equal(items[0].name, '日本の職業 AI 影響マップ');
    assert.equal(items[1].position, 2);
    assert.equal(items[1].name, 'プログラマー');
  });

  test('FAQPage entities map Q/A tuples to Question/Answer structure', () => {
    const out = parse(
      renderOccupationJsonLd({
        ...baseInput,
        faqs: [['Q1?', 'A1.']],
      }),
    ) as {
      '@graph': Array<{
        mainEntity?: Array<{
          name: string;
          acceptedAnswer: { text: string };
        }>;
      }>;
    };
    const faq = out['@graph'][3];
    assert.equal(faq.mainEntity![0].name, 'Q1?');
    assert.equal(faq.mainEntity![0].acceptedAnswer.text, 'A1.');
  });

  test('output is pretty-printed JSON (2-space indent)', () => {
    const out = renderOccupationJsonLd(baseInput);
    // First 50 chars should include a newline + 2-space indent pattern.
    assert.ok(out.includes('\n  '));
  });

  test('Occupation key insertion order (qualifications BEFORE estimatedSalary, educationRequirements AFTER responsibilities)', () => {
    // Regression guard: JSON.stringify preserves object insertion
    // order, so the SEO baseline byte-compare depends on us assigning
    // qualifications + educationRequirements in their split legacy
    // positions. Merging them under one `if` re-orders the JSON keys
    // and produces drift on every page with related_certs_ja.
    const out = renderOccupationJsonLd({
      ...baseInput,
      relatedCertsJa: ['看護師'],
      salaryMan: 540,
      hours: 165,
      tasksLeadJa: 'タスク',
      howToBecomeJa: '専門学校で学ぶ。',
    });
    const parsed = JSON.parse(out) as { '@graph': Array<Record<string, unknown>> };
    const occ = parsed['@graph'][1];
    const keys = Object.keys(occ);
    const qualAt = keys.indexOf('qualifications');
    const estAt = keys.indexOf('estimatedSalary');
    const respAt = keys.indexOf('responsibilities');
    const eduAt = keys.indexOf('educationRequirements');
    assert.ok(qualAt > -1 && estAt > -1 && respAt > -1 && eduAt > -1);
    assert.ok(qualAt < estAt, `qualifications (${qualAt}) must come before estimatedSalary (${estAt})`);
    assert.ok(respAt < eduAt, `responsibilities (${respAt}) must come before educationRequirements (${eduAt})`);
    assert.ok(estAt < eduAt, `estimatedSalary (${estAt}) must come before educationRequirements (${eduAt})`);
  });
});
