/**
 * sitemap.test.ts — pin the pure XML serializer + key invariants
 * of the URL enumeration.
 *
 * `buildSitemapEntries(graph, today)` requires a full graph
 * fixture, which doesn't exist as a stand-alone artifact at the
 * unit-test level. The full enumeration is covered by the SEO
 * baseline gate (byte-compare of dist-astro/sitemap.xml across
 * all 821 URLs). This test file focuses on the pure-function
 * `renderSitemapXml(entries)` serializer + entry-shape invariants.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  renderSitemapXml,
  type SitemapEntry,
} from './sitemap.js';

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
