import assert from 'node:assert/strict';
import { describe, expect, test } from 'bun:test';
import manifest from '../../docs/pro-split/route-manifest.json';
import { occupationRoute, rankingRoute, editionHref, editionHtmlLinks } from './route-policy';
import { occupationPath, occupationCanonicalUrl, occupationUrl, rankingUrl, rankingCanonicalUrl } from '../lib/urls';

describe('stage 2 occupations / stage 1B edition routing', () => {
  test('occupation 404 has independent page and stable ordinary canonical URLs', () => {
    expect(occupationPath(404)).toBe('/occupations/404');
    expect(occupationPath(404, 'pro')).toBe('/pro/404');
    assert.deepEqual(occupationRoute(404, 'pro'), { pagePath: '/pro/404', canonicalPath: '/pro/404', noindex: false, sitemap: true, ordinarySwitchPath: '/occupations/404' });
    expect(occupationUrl(428, 'pro')).toBe('https://mirai-shigoto.com/pro/428');
    expect(occupationCanonicalUrl(428, 'pro')).toBe('https://mirai-shigoto.com/pro/428');
    for (const invalid of [0, -1, 0.3, NaN, Infinity]) expect(() => occupationRoute(invalid, 'pro')).toThrow();
  });
  test('all 39 copies use final canonical policy, including 31 migrations', () => {
    expect(manifest.rankings.length).toBe(39);
    for (const row of manifest.rankings) {
      assert.deepEqual(rankingRoute(row.slug, 'pro'), { pagePath: row.proPath, canonicalPath: row.proCanonical, noindex: row.noindex, sitemap: row.proSitemap, ordinarySwitchPath: row.ordinaryPath ?? '/', ordinaryProCta: row.ordinaryPath !== null });
      expect(rankingUrl(row.slug, 'pro')).toBe(`https://mirai-shigoto.com${row.proPath}`);
      expect(rankingCanonicalUrl(row.slug, 'pro')).toBe(`https://mirai-shigoto.com${row.proCanonical}`);
      expect(rankingRoute(row.slug, 'ordinary').ordinaryProCta).toBe(row.ordinaryPath !== null);
      expect(rankingRoute(row.slug, 'ordinary').pagePath).toBe(row.ordinaryPath ?? row.proPath);
      expect(rankingRoute(row.slug, 'pro').ordinarySwitchPath).toBe(row.ordinaryPath ?? '/');
    }
    expect(manifest.rankings.filter(r => r.noindex).length).toBe(4);
    expect(() => rankingRoute('not-a-ranking', 'pro')).toThrow();
  });
  test('edition links preserve suffixes and shared/external/unknown route boundaries', () => {
    expect(editionHref('/occupations/404#chp-score', 'pro')).toBe('/pro/404#chp-score');
    expect(editionHref('/428?me=33#sec-transfer', 'pro')).toBe('/pro/428?me=33#sec-transfer');
    expect(editionHref('/rankings/entry-salary', 'pro')).toBe('/pro/rankings/entry-salary');
    expect(editionHref('/rankings', 'pro')).toBe('/pro/rankings');
    for (const href of ['/map', '/me?id=428', '/privacy', '/data.detail/404.json', '/404', '/rankings/unknown', '/rankings-extra', '//example.com/428', 'https://example.com/428']) {
      expect(editionHref(href, 'pro')).toBe(href);
    }
    expect(editionHref('/428', 'ordinary')).toBe('/428');
    expect(editionHtmlLinks('<a href="/428#chp-score">仕事</a><a href="/about">出典</a>', 'pro')).toBe('<a href="/pro/428#chp-score">仕事</a><a href="/about">出典</a>');
  });
});

test('link adaptation preserves return navigation and all inline script/style bytes', () => {
  const opaque = '<script>var x = \'href="/skills"\';</script><style>.x{content:\'href="/skills"\'}</style><nav class="edition-nav"><a href="/rankings/ai-risk-high">通常版へ</a></nav>';
  expect(editionHtmlLinks(opaque + '<a href="/skills">スキル</a>', 'pro')).toBe(opaque + '<a href="/pro/skills">スキル</a>');
});

test('JSON-LD link adaptation preserves occupation entity identity and shared endpoints', async () => {
  const { editionJsonLd } = await import('./route-policy');
  const nodes = JSON.parse(editionJsonLd(JSON.stringify({'@graph': [
    {'@type':'Occupation', '@id':'https://mirai-shigoto.com/428#occupation', url:'https://mirai-shigoto.com/428'},
    {'@type':'WebPage', '@id':'https://mirai-shigoto.com/pro/428#webpage', url:'https://mirai-shigoto.com/pro/428', mainEntity:{'@id':'https://mirai-shigoto.com/428#occupation'}},
    {'@type':'ItemList', itemListElement:[{url:'https://mirai-shigoto.com/occupations/404'},{url:'https://mirai-shigoto.com/428'}]},
    {'@type':'Dataset','@id':'https://mirai-shigoto.com/#dataset',distribution:{contentUrl:'https://mirai-shigoto.com/data.treemap.json'}}
  ]}), 'pro'))['@graph'];
  expect(nodes[0].url).toBe('https://mirai-shigoto.com/428');
  expect(nodes[1].mainEntity['@id']).toBe('https://mirai-shigoto.com/428#occupation');
  expect(nodes[2].itemListElement[0].url).toBe('https://mirai-shigoto.com/pro/404');
  expect(nodes[2].itemListElement[1].url).toBe('https://mirai-shigoto.com/pro/428');
  expect(nodes[3]['@id']).toBe('https://mirai-shigoto.com/#dataset');
});

test('Pro JSON-LD adaptation preserves consolidated ranking page identities and index breadcrumbs', async () => {
  const { editionJsonLd } = await import('./route-policy');
  for (const row of manifest.rankings.filter(r => r.ordinaryPath !== null)) {
    const canonical = `https://mirai-shigoto.com${row.ordinaryPath}`;
    const nodes = JSON.parse(editionJsonLd(JSON.stringify({'@graph':[
      {'@type':'WebPage','@id':canonical+'#webpage',url:canonical},
      {'@type':'BreadcrumbList',itemListElement:[{item:'https://mirai-shigoto.com/pro/rankings'},{item:canonical}]},
      {'@type':'ItemList',itemListElement:[{url:'https://mirai-shigoto.com/428'}]},
    ]}), 'pro'))['@graph'];
    assert.equal(nodes[0].url, canonical);
    assert.equal(nodes[0]['@id'], canonical+'#webpage');
    assert.equal(nodes[1].itemListElement[0].item, 'https://mirai-shigoto.com/pro/rankings');
    assert.equal(nodes[1].itemListElement[1].item, canonical);
    assert.equal(nodes[2].itemListElement[0].url, 'https://mirai-shigoto.com/pro/428');
  }
});

test('stage 2 occupation indexing coexists with stage 3 independent ranking indexes', async () => {
  const { buildSitemapEntries } = await import('../views/sitemap');
  const graph = { sectors: new Map(), occupations: new Map([[404, {}], [428, {}]]) } as unknown as import('../graph').KnowledgeGraph;
  const paths = buildSitemapEntries(graph, '2026-10-01').map(row => new URL(row.loc).pathname);
  for (const id of [404, 428]) {
    for (const edition of ['ordinary', 'pro'] as const) {
      const route = occupationRoute(id, edition);
      expect(route.canonicalPath).toBe(route.pagePath);
      expect(route.sitemap).toBe(true);
      expect(paths.filter(path => path === route.pagePath).length).toBe(1);
    }
  }
  expect(paths).toContain('/pro/skills');
  expect(paths).not.toContain('/skills');
  expect(paths.filter(path => path === '/pro/rankings').length).toBe(1);
  for (const row of manifest.rankings) {
    expect(paths.includes(row.proCanonical)).toBe(!row.noindex);
    expect(editionHref(row.oldPath + '?me=428#content', 'ordinary')).toBe((row.ordinaryPath ?? row.proPath) + '?me=428#content');
  }
});
