import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph, type KnowledgeGraph } from '@/graph';
import { buildInterests } from '@/views/interests.js';
import { buildInterestsSlugBindings } from './_interests-bindings.ts';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('buildInterestsSlugBindings', () => {
  test('builds canonical, meta and section HTML for every interest', () => {
    for (const [slug, result] of buildInterests().results) {
      const b = buildInterestsSlugBindings(result, graph);
      assert.equal(b.canonical, `https://mirai-shigoto.com/pro/interests/${slug}`);
      assert.equal(b.ogImage, `https://mirai-shigoto.com/api/og?interest=${slug}`);
      assert.ok(b.title.includes(result.meta.title_ja));
      assert.ok(b.seoDesc.includes(result.meta.letter));
      assert.ok(b.statsHtml.startsWith('<dl class="stats">'));
      assert.ok(b.charsHtml.startsWith('<ul class="characteristics">'));
      assert.ok(b.fieldsHtml.startsWith('<ul class="fields">'));
      assert.ok(b.rankItems.length > 0);
      assert.doesNotThrow(() => JSON.parse(b.jsonLd));
    }
  });

  test('omits stats block when there are no stats', () => {
    const [, result] = [...buildInterests().results][0]!;
    const b = buildInterestsSlugBindings({ ...result, stats: [] }, graph);
    assert.equal(b.statsHtml, '');
  });
});
