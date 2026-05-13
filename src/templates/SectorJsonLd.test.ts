/**
 * SectorJsonLd.test.ts — pin the Schema.org JSON-LD output of
 * the sector hub page's structured-data builder.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderSectorJsonLd, type SectorJsonLdInput } from './SectorJsonLd.js';

const baseInput: SectorJsonLdInput = {
  canonical: 'https://mirai-shigoto.com/ja/sectors/healthcare',
  nameJa: '医療',
  sectorId: 'healthcare',
  siteOrigin: 'https://mirai-shigoto.com',
  occupationCount: 25,
  occupations: [
    { id: 1, titleJa: '看護師' },
    { id: 2, titleJa: '医師' },
  ],
  faqs: [],
  breadcrumbRoot: '未来の仕事',
  breadcrumbSectors: 'セクター',
  datePublished: '2026-05-05',
  dateModified: '2026-05-09',
};

function parse(s: string): { '@graph': Array<{ '@type': string }> } {
  return JSON.parse(s);
}

describe('renderSectorJsonLd', () => {
  test('emits @context + @graph', () => {
    const out = JSON.parse(renderSectorJsonLd(baseInput));
    assert.equal(out['@context'], 'https://schema.org');
    assert.ok(Array.isArray(out['@graph']));
  });

  test('graph has 4 nodes when no FAQs (WebPage / Article / Breadcrumb / ItemList)', () => {
    const out = parse(renderSectorJsonLd(baseInput));
    const types = out['@graph'].map((n) => n['@type']);
    assert.deepEqual(types, ['WebPage', 'Article', 'BreadcrumbList', 'ItemList']);
  });

  test('graph adds FAQPage when faqs is non-empty', () => {
    const out = parse(
      renderSectorJsonLd({
        ...baseInput,
        faqs: [['なぜ?', 'こうだから。']],
      }),
    );
    const types = out['@graph'].map((n) => n['@type']);
    assert.deepEqual(types, ['WebPage', 'Article', 'BreadcrumbList', 'ItemList', 'FAQPage']);
  });

  test('Article.articleSection = "セクター"', () => {
    const out = parse(renderSectorJsonLd(baseInput)) as {
      '@graph': Array<{ '@type': string; articleSection?: string }>;
    };
    const article = out['@graph'].find((n) => n['@type'] === 'Article')!;
    assert.equal(article.articleSection, 'セクター');
  });

  test('ItemList.itemListOrder = descending Schema.org URI', () => {
    const out = parse(renderSectorJsonLd(baseInput)) as {
      '@graph': Array<{ '@type': string; itemListOrder?: string }>;
    };
    const list = out['@graph'].find((n) => n['@type'] === 'ItemList')!;
    assert.equal(list.itemListOrder, 'https://schema.org/ItemListOrderDescending');
  });

  test('ItemList rows: each occupation → ListItem with url + name + position', () => {
    const out = parse(renderSectorJsonLd(baseInput)) as {
      '@graph': Array<{
        '@type': string;
        itemListElement?: Array<{ position: number; url: string; name: string }>;
      }>;
    };
    const list = out['@graph'].find((n) => n['@type'] === 'ItemList')!;
    const items = list.itemListElement!;
    assert.equal(items.length, 2);
    assert.equal(items[0].position, 1);
    assert.equal(items[0].url, 'https://mirai-shigoto.com/ja/1');
    assert.equal(items[0].name, '看護師');
  });

  test('empty titleJa falls back to "#id" in ListItem.name', () => {
    const out = parse(
      renderSectorJsonLd({
        ...baseInput,
        occupations: [{ id: 99, titleJa: '' }],
      }),
    ) as {
      '@graph': Array<{ '@type': string; itemListElement?: Array<{ name: string }> }>;
    };
    const list = out['@graph'].find((n) => n['@type'] === 'ItemList')!;
    assert.equal(list.itemListElement![0].name, '#99');
  });

  test('BreadcrumbList: 3 levels (home → sectors → this sector)', () => {
    const out = parse(renderSectorJsonLd(baseInput)) as {
      '@graph': Array<{
        '@type': string;
        itemListElement?: Array<{ position: number; name: string; item: string }>;
      }>;
    };
    const bc = out['@graph'].find((n) => n['@type'] === 'BreadcrumbList')!;
    const items = bc.itemListElement!;
    assert.equal(items.length, 3);
    assert.equal(items[0].name, '未来の仕事');
    assert.equal(items[1].name, 'セクター');
    assert.equal(items[2].name, '医療');
    assert.equal(items[1].item, 'https://mirai-shigoto.com/ja/sectors');
  });

  test('WebPage + Article share datePublished + dateModified from input', () => {
    const out = parse(renderSectorJsonLd(baseInput)) as {
      '@graph': Array<{
        '@type': string;
        datePublished?: string;
        dateModified?: string;
      }>;
    };
    const webpage = out['@graph'].find((n) => n['@type'] === 'WebPage')!;
    const article = out['@graph'].find((n) => n['@type'] === 'Article')!;
    assert.equal(webpage.datePublished, '2026-05-05');
    assert.equal(article.dateModified, '2026-05-09');
  });

  test('Article.image points to /api/og?sector={id}', () => {
    const out = parse(renderSectorJsonLd(baseInput)) as {
      '@graph': Array<{ '@type': string; image?: string }>;
    };
    const article = out['@graph'].find((n) => n['@type'] === 'Article')!;
    assert.equal(article.image, 'https://mirai-shigoto.com/api/og?sector=healthcare');
  });

  test('FAQPage Q/A tuples mapped to Question/Answer structure', () => {
    const out = parse(
      renderSectorJsonLd({
        ...baseInput,
        faqs: [
          ['Q1?', 'A1.'],
          ['Q2?', 'A2.'],
        ],
      }),
    ) as {
      '@graph': Array<{
        '@type': string;
        mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }>;
      }>;
    };
    const faq = out['@graph'].find((n) => n['@type'] === 'FAQPage')!;
    assert.equal(faq.mainEntity![0].name, 'Q1?');
    assert.equal(faq.mainEntity![0].acceptedAnswer.text, 'A1.');
    assert.equal(faq.mainEntity!.length, 2);
  });

  test('output is pretty-printed JSON (2-space indent)', () => {
    const out = renderSectorJsonLd(baseInput);
    assert.ok(out.includes('\n  '));
  });
});
