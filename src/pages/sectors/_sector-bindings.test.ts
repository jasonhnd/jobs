import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph, type KnowledgeGraph } from '@/graph';
import { sectorDetailView } from '@/views/sector';
import { loadGeoFacts } from '@/page-data/geo-facts-loader';
import { buildSectorBindings } from './_sector-bindings.ts';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('buildSectorBindings', () => {
  test('derives identity, meta and section HTML for every sector', () => {
    const geoFacts = loadGeoFacts();
    for (const sectorId of graph.sectors.keys()) {
      const view = sectorDetailView(graph, sectorId);
      const b = buildSectorBindings({
        view, graph, geoFacts, datePublished: '2026-01-01', dateModified: '2026-02-01',
      });
      const sid = String(sectorId);
      assert.equal(b.sid, sid);
      assert.equal(b.canonical, `https://mirai-shigoto.com/sectors/${sid}`);
      assert.equal(b.ogImage, `https://mirai-shigoto.com/api/og?sector=${sid}`);
      assert.equal(b.n, view.occupations.length);
      assert.ok(b.title.includes(b.nameLoc));
      assert.ok(b.h1Main.includes(b.nameLoc));
      assert.ok(b.subText.includes(`${b.n} 職業`));
      assert.ok(b.keywordsStr.startsWith(b.nameLoc));
      assert.ok(b.hFull.includes(String(b.n)));
      assert.ok(b.topHighHtml.length > 0 && b.fullListHtml.length > 0);
      assert.equal(typeof b.patternsHtml, "string");
      assert.doesNotThrow(() => JSON.parse(b.jsonLd));
    }
  });

  test('workforce total equals the sum of occupation workers', () => {
    const [sectorId] = [...graph.sectors.keys()];
    const view = sectorDetailView(graph, sectorId!);
    const b = buildSectorBindings({ view, graph, datePublished: '2026-01-01', dateModified: '2026-01-01' });
    const sum = view.occupations.reduce((s, o) => s + (o.workers || 0), 0);
    assert.equal(b.workforceTotal, sum);
  });

  test('throws when the GEO summary lacks the sector', () => {
    const [sectorId] = [...graph.sectors.keys()];
    const view = sectorDetailView(graph, sectorId!);
    const real = loadGeoFacts();
    const geoFacts = { ...real, sectorsByMeanImpact: [] } as typeof real;
    assert.throws(
      () => buildSectorBindings({ view, graph, geoFacts, datePublished: 'a', dateModified: 'b' }),
      /missing GEO sector summary/,
    );
  });
});
