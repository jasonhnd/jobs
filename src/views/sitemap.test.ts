/**
 * sitemap.test.ts — pin the pure XML serializer + key invariants
 * of the URL enumeration.
 *
 * `buildSitemapEntries(graph, lastmods)` requires a graph
 * fixture, which doesn't exist as a stand-alone artifact at the
 * unit-test level. The full enumeration is covered by the SEO
 * baseline gate (byte-compare of dist-astro/sitemap.xml across
 * all 821 URLs). This test file focuses on the pure-function
 * `renderSitemapXml(entries)` serializer + entry-shape invariants.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSitemapEntries,
  renderSitemapXml,
  latestContentDate,
  sitemapLastmods,
  type SitemapEntry,
} from './sitemap.js';
import type { KnowledgeGraph } from '@/graph';

function fakeEntry(loc: string, lastmod = '2026-05-13'): SitemapEntry {
  return { loc, lastmod, changefreq: 'weekly', priority: '0.6' };
}

describe('renderSitemapXml — pure XML serializer', () => {
  test('emits <?xml> declaration + <urlset> wrapper', () => {
    const out = renderSitemapXml([fakeEntry('https://example.com/')]);
    assert.ok(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(out.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(out.trimEnd().endsWith('</urlset>'));
  });

  test('empty entries array still produces a valid (empty) urlset', () => {
    const out = renderSitemapXml([]);
    assert.ok(out.includes('<urlset'));
    assert.ok(out.includes('</urlset>'));
    assert.ok(!out.includes('<url>'));
  });

  test('each entry emits a <url> block with the 4 standard children', () => {
    const out = renderSitemapXml([fakeEntry('https://example.com/x')]);
    assert.ok(out.includes('<loc>https://example.com/x</loc>'));
    assert.ok(out.includes('<lastmod>2026-05-13</lastmod>'));
    assert.ok(out.includes('<changefreq>weekly</changefreq>'));
    assert.ok(out.includes('<priority>0.6</priority>'));
  });

  test('multiple entries render in order', () => {
    const out = renderSitemapXml([
      fakeEntry('https://example.com/a'),
      fakeEntry('https://example.com/b'),
      fakeEntry('https://example.com/c'),
    ]);
    const urlCount = (out.match(/<url>/g) ?? []).length;
    assert.equal(urlCount, 3);
    assert.ok(out.indexOf('/a</loc>') < out.indexOf('/b</loc>'));
    assert.ok(out.indexOf('/b</loc>') < out.indexOf('/c</loc>'));
  });

  test('XML escape on <loc>: ampersand', () => {
    const out = renderSitemapXml([fakeEntry('https://example.com/?a=1&b=2')]);
    assert.ok(out.includes('<loc>https://example.com/?a=1&amp;b=2</loc>'));
    assert.ok(!out.includes('<loc>https://example.com/?a=1&b=2</loc>'));
  });

  test('XML escape on <loc>: angle brackets', () => {
    const out = renderSitemapXml([fakeEntry('https://example.com/<x>')]);
    assert.ok(out.includes('&lt;x&gt;'));
    assert.ok(!out.includes('<loc>https://example.com/<x></loc>'));
  });

  test('XML escape on <loc>: quotes', () => {
    const out = renderSitemapXml([fakeEntry('https://example.com/a"b\'c')]);
    assert.ok(out.includes('&quot;'));
    assert.ok(out.includes('&apos;'));
  });

  test('safe characters pass through unescaped', () => {
    const out = renderSitemapXml([fakeEntry('https://mirai-shigoto.com/sectors/healthcare')]);
    assert.ok(out.includes('<loc>https://mirai-shigoto.com/sectors/healthcare</loc>'));
  });

  test('output ends with a trailing newline (filesystem-friendly)', () => {
    const out = renderSitemapXml([fakeEntry('https://example.com/')]);
    assert.ok(out.endsWith('\n'));
  });

  test('changefreq + priority pass through verbatim (no validation)', () => {
    const out = renderSitemapXml([
      { loc: 'https://x/', lastmod: '2026-01-01', changefreq: 'yearly', priority: '0.3' },
    ]);
    assert.ok(out.includes('<changefreq>yearly</changefreq>'));
    assert.ok(out.includes('<priority>0.3</priority>'));
  });
});

describe('latestContentDate — content-derived <lastmod> (NOT the build clock)', () => {
  // Minimal graph stub — latestContentDate only reads each occupation's
  // `aiRisk?.date`, so we don't construct a full KnowledgeGraph.
  function makeGraph(dates: Array<string | null>): KnowledgeGraph {
    const occupations = new Map(
      dates.map((d, i) => [i + 1, { aiRisk: d === null ? null : { date: d } }]),
    );
    return { occupations } as unknown as KnowledgeGraph;
  }

  test('returns the max run_date across occupations', () => {
    const graph = makeGraph(['2026-05-01', '2026-05-20', '2026-04-15']);
    assert.equal(latestContentDate(graph, '2099-01-01'), '2026-05-20');
  });

  test('ignores unscored occupations (aiRisk null)', () => {
    const graph = makeGraph(['2026-05-01', null, '2026-05-09']);
    assert.equal(latestContentDate(graph, '2099-01-01'), '2026-05-09');
  });

  test('falls back to the build date ONLY when nothing is scored', () => {
    assert.equal(latestContentDate(makeGraph([null, null]), '2026-06-03'), '2026-06-03');
    assert.equal(latestContentDate(makeGraph([]), '2026-06-03'), '2026-06-03');
  });

  test('a real content date always wins over the build-clock fallback', () => {
    // The whole point of the fix: the sitemap must not drift with the clock.
    assert.equal(latestContentDate(makeGraph(['2026-05-20']), '2026-06-03'), '2026-05-20');
  });

  test('sitemapLastmods keeps static legal dates separate from content dates', () => {
    const graph = makeGraph(['2026-06-13']);
    const lastmods = sitemapLastmods(graph, '2099-01-01');

    assert.equal(lastmods.content, '2026-06-13');
    assert.equal(lastmods.privacy, '2026-04-30');
    assert.equal(lastmods.compliance, '2026-06-13');
  });

  test('buildSitemapEntries applies granular lastmods by page family', () => {
    const graph = {
      sectors: new Map([['health', {}]]),
      occupations: new Map([[1, { aiRisk: { date: '2026-06-13' } }]]),
    } as unknown as KnowledgeGraph;
    const entries = buildSitemapEntries(graph, {
      content: '2026-06-13',
      privacy: '2026-04-30',
      about: '2026-06-13',
      standard: '2026-06-13',
      methodology: '2026-06-13',
      models: '2026-06-13',
      data: '2026-06-13',
      compliance: '2026-06-13',
      yearly: '2026-06-13',
    });

    const byPath = (path: string) => entries.find((e) => e.loc === `https://mirai-shigoto.com${path}`)!;
    assert.equal(byPath('/privacy').lastmod, '2026-04-30');
    assert.equal(byPath('/sectors').lastmod, '2026-06-13');
    assert.equal(byPath('/1').lastmod, '2026-06-13');
  });
});
