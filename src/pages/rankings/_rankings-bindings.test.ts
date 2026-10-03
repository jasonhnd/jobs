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
      assert.equal(b.canonical, `https://mirai-shigoto.com/rankings/${slug}`);
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
