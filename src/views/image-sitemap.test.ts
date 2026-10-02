import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildImageSitemapEntries, renderImageSitemapXml } from './image-sitemap.js';
import type { KnowledgeGraph, OccupationNode } from '@/graph';

// These views read only the occupation map, so the fixtures omit unrelated graph queries.
function makeGraph(rows: Array<[string, Pick<OccupationNode, 'titleJa' | 'aiRisk'>]>): KnowledgeGraph {
  return { occupations: new Map(rows) } as unknown as KnowledgeGraph;
}

function row(titleJa: string, score: number | null): Pick<OccupationNode, 'titleJa' | 'aiRisk'> {
  return {
    titleJa,
    aiRisk: score === null ? null : { score } as NonNullable<OccupationNode['aiRisk']>,
  };
}

describe('buildImageSitemapEntries', () => {
  test('filters unscored and untitled rows, retains zero, and sorts ids numerically without mutation', () => {
    const graph = makeGraph([
      ['00404', row('collision', 3.14159)],
      ['0010', row('ten', 4)],
      ['0002', row('zero', 0)],
      ['0003', row('unscored', null)],
      ['0004', row('', 2)],
    ]);
    const before = [...graph.occupations];
    assert.deepEqual(buildImageSitemapEntries(graph), [
      { id: 2, title: 'zero', score: 0 },
      { id: 10, title: 'ten', score: 4 },
      { id: 404, title: 'collision', score: 3.14159 },
    ]);
    assert.deepEqual([...graph.occupations], before);
  });

  test('empty and wholly ineligible graphs produce no entries', () => {
    assert.deepEqual(buildImageSitemapEntries(makeGraph([])), []);
    assert.deepEqual(buildImageSitemapEntries(makeGraph([
      ['1', row('unscored', null)], ['2', row('', 3)],
    ])), []);
  });
});

describe('renderImageSitemapXml', () => {
  test('uses the collision-free occupation 404 page while keeping the OG dispatch id', () => {
    const xml = renderImageSitemapXml([{ id: 404, title: '内科医', score: 5 }]);

    assert.ok(xml.includes('<loc>https://mirai-shigoto.com/occupations/404</loc>'));
    assert.ok(xml.includes('<image:loc>https://mirai-shigoto.com/api/og?id=404</image:loc>'));
    assert.ok(!xml.includes('<loc>https://mirai-shigoto.com/404</loc>'));
  });

  test('escapes all XML metacharacters and formats scores to one decimal in entry order', () => {
    const xml = renderImageSitemapXml([
      { id: 2, title: `<tag>&"'`, score: 3.14159 },
      { id: 10, title: 'zero', score: 0 },
    ]);
    assert.ok(xml.includes('<image:title>&lt;tag&gt;&amp;&quot;&apos; — AI影響 3.1/10</image:title>'));
    assert.ok(xml.includes('<image:title>zero — AI影響 0/10</image:title>'));
    assert.equal((xml.match(/<url>/g) ?? []).length, 2);
    assert.equal((xml.match(/<image:image>/g) ?? []).length, 2);
    assert.ok(xml.indexOf('/2</loc>') < xml.indexOf('/10</loc>'));
    assert.ok(!xml.includes('<tag>'));
    assert.ok(!xml.includes('3.14159'));
  });

  test('empty entries retain the XML declaration, namespaces, and trailing newline', () => {
    assert.equal(renderImageSitemapXml([]), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

</urlset>
`);
  });
});
