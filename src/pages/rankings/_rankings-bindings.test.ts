import { rankingRoute } from '@/site/route-policy';
import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph, type KnowledgeGraph } from '@/graph';
import { buildRankings, loadOccupationsFromGraph } from '@/views/ranking.js';
import { buildRankingsSlugBindings } from './_rankings-bindings.ts';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('buildRankingsSlugBindings', () => {
  test('builds canonical and section HTML for every ranking', () => {
    const bundle = buildRankings(() => loadOccupationsFromGraph(graph));
    assert.ok(bundle.results.size > 0);
    for (const [slug, result] of bundle.results) {
      const b = buildRankingsSlugBindings(result, graph);
      assert.equal(b.canonical, `https://mirai-shigoto.com${rankingRoute(slug).canonicalPath}`);
      assert.equal(b.ogImage, `https://mirai-shigoto.com/api/og?ranking=${slug}`);
      assert.ok(b.rankItems.length > 0);
      assert.ok(b.relatedHtml.length > 0);
      assert.doesNotThrow(() => JSON.parse(b.jsonLd));
    }
  });

  test('omits stats block when there are no stat blocks', () => {
    const bundle = buildRankings(() => loadOccupationsFromGraph(graph));
    const [, result] = [...bundle.results][0]!;
    assert.equal(buildRankingsSlugBindings({ ...result, statBlocks: [] }, graph).statsHtml, '');
  });
});

test('all Pro ranking WebPage and Article metadata matches the edition title and description', () => {
  const bundle = buildRankings(() => loadOccupationsFromGraph(graph));
  for (const result of bundle.results.values()) {
    const pro = buildRankingsSlugBindings(result, graph, undefined, 'pro');
    const ordinary = buildRankingsSlugBindings(result, graph);
    const nodes = (payload: string) => JSON.parse(payload)['@graph'] as Array<Record<string, unknown>>;
    const webpage = nodes(pro.jsonLd).find(n => n['@type'] === 'WebPage');
    const article = nodes(pro.jsonLd).find(n => n['@type'] === 'Article');
    assert.equal(webpage?.name, `Pro | ${result.title}`);
    assert.equal(webpage?.description, `Pro · ${result.seoDesc}`);
    assert.equal(article?.headline, `Pro | ${result.title}`);
    assert.equal(article?.description, `Pro · ${result.seoDesc}`);
    assert.equal(nodes(ordinary.jsonLd).find(n => n['@type'] === 'WebPage')?.name, result.title);
    assert.equal(nodes(ordinary.jsonLd).find(n => n['@type'] === 'WebPage')?.description, result.seoDesc);
  }
});
