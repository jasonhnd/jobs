import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph, type KnowledgeGraph } from '@/graph';
import { buildSkillsBundle } from '@/views/skills-hub.js';
import { buildSkillsSlugBindings } from './_skills-bindings.ts';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('buildSkillsSlugBindings', () => {
  test('builds canonical, meta and section HTML for every skill', () => {
    for (const [slug, result] of buildSkillsBundle().results) {
      const b = buildSkillsSlugBindings(result, graph);
      assert.equal(b.canonical, `https://mirai-shigoto.com/pro/skills/${slug}`);
      assert.equal(b.ogImage, `https://mirai-shigoto.com/api/og?skill=${slug}`);
      assert.ok(b.title.includes(result.meta.title_ja));
      assert.ok(b.seoDesc.includes(result.meta.short_ja));
      assert.ok(b.statsHtml.startsWith('<dl class="stats">'));
      assert.ok(b.useCasesHtml.startsWith('<ul class="use-cases">'));
      assert.ok(b.trainHtml.startsWith('<ul class="how-to-train">'));
      assert.ok(b.rankItems.length > 0);
      assert.doesNotThrow(() => JSON.parse(b.jsonLd));
    }
  });

  test('omits stats block when there are no stats', () => {
    const [, result] = [...buildSkillsBundle().results][0]!;
    assert.equal(buildSkillsSlugBindings({ ...result, stats: [] }, graph).statsHtml, '');
  });
});
