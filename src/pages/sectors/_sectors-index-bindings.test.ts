import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { asOccupationId, asSectorId, type KnowledgeGraph, type OccupationNode, type SectorNode } from '@/graph';
import { OCCUPATION_COUNT } from '@/site/config';
import { CONTENT_DATE } from '@/lib/_content-date';
import {
  buildSectorsIndexBindings,
  fmtInt as sectorsIndexFmtInt,
  riskClass as sectorsIndexRiskClass,
} from './_sectors-index-bindings.js';
import { fmtInt } from '@/lib/num';
import { riskClass } from '@/lib/risk';

describe('sectors index helpers', () => {
  test('re-exports canonical fmtInt', () => {
    assert.equal(sectorsIndexFmtInt(12_345.9), '12,345');
    assert.equal(sectorsIndexFmtInt(null), '—');
    assert.equal(sectorsIndexFmtInt(undefined), fmtInt(undefined));
  });

  test('re-exports canonical riskClass boundary behavior', () => {
    for (const score of [3.5, 3.95, 4.0, 6.5, 6.95, 7.0]) {
      assert.equal(sectorsIndexRiskClass(score), riskClass(score));
    }
  });
});

describe('buildSectorsIndexBindings', () => {
  function graph(populated: boolean): KnowledgeGraph {
    const z = asSectorId('iryo');
    const a = asSectorId('it');
    const sectors = new Map([
      [z, { id: z, nameJa: 'Sector & <z>', hue: 'warm', descriptionJa: 'Description' } as SectorNode],
      [a, { id: a, nameJa: 'Empty sector', hue: 'safe', descriptionJa: null } as SectorNode],
    ]);
    const occupations = new Map([
      [asOccupationId(1), { id: asOccupationId(1), titleJa: 'Alpha', aiRisk: { score: 2 }, stats: { workers: 100 } } as unknown as OccupationNode],
      [asOccupationId(2), { id: asOccupationId(2), titleJa: 'Beta', aiRisk: { score: 4 }, stats: { workers: 200 } } as unknown as OccupationNode],
    ]);
    return {
      sectors: populated ? sectors : new Map(),
      occupations: populated ? occupations : new Map(),
      occupationsBySector: (id) => populated && id === z ? [asOccupationId(1), asOccupationId(2)] : [],
    } as Pick<KnowledgeGraph, 'sectors' | 'occupations' | 'occupationsBySector'> as KnowledgeGraph;
  }

  test('preserves sector order and aggregation while distinguishing public and fixture counts', () => {
    const bindings = buildSectorsIndexBindings(graph(true));
    assert.equal(bindings.canonical, 'https://mirai-shigoto.com/sectors');
    assert.equal(bindings.totalOcc, OCCUPATION_COUNT.SCORED);
    assert.ok(bindings.pageTitle.includes(`${OCCUPATION_COUNT.SCORED} 職業`));
    assert.ok(bindings.keywords.includes(`${OCCUPATION_COUNT.SCORED} 職業`));
    assert.ok(bindings.seoDesc.startsWith('日本の2職業'));
    assert.deepEqual(bindings.sectors.map(sector => sector.id), ['iryo', 'it']);
    assert.equal(bindings.sectors[0]!.occupationCount, 2);
    assert.equal(bindings.sectors[0]!.meanAiRisk, 3);
    assert.equal(bindings.sectors[0]!.totalWorkforce, 300);
    assert.deepEqual(bindings.sectors[0]!.sampleEntries, [{ id: 2, titleJa: 'Beta' }, { id: 1, titleJa: 'Alpha' }]);
    assert.equal(bindings.sectors[1]!.occupationCount, 0);
    assert.equal(bindings.sectors[1]!.meanAiRisk, null);
    assert.ok(bindings.ogTitle.length > 0 && bindings.skipLabel.length > 0);
    const [web, breadcrumb, list] = JSON.parse(bindings.jsonLd)['@graph'];
    assert.equal(web.url, bindings.canonical);
    assert.equal(web.name, bindings.h1);
    assert.equal(web.description, bindings.seoDesc);
    assert.equal(web.dateModified, CONTENT_DATE);
    assert.equal(web.breadcrumb['@id'], breadcrumb['@id']);
    assert.deepEqual(breadcrumb.itemListElement, [
      { '@type': 'ListItem', position: 1, name: bindings.crumbRoot, item: 'https://mirai-shigoto.com/' },
      { '@type': 'ListItem', position: 2, name: bindings.crumbSelf, item: bindings.canonical },
    ]);
    assert.equal(list['@type'], 'ItemList');
    assert.equal(list.name, bindings.hList);
    assert.equal(list.numberOfItems, 2);
    assert.deepEqual(list.itemListElement, [
      { '@type': 'ListItem', position: 1, url: 'https://mirai-shigoto.com/sectors/iryo', name: 'Sector & <z>' },
      { '@type': 'ListItem', position: 2, url: 'https://mirai-shigoto.com/sectors/it', name: 'Empty sector' },
    ]);
  });

  test('empty graph returns valid empty ItemList and stable page identity', () => {
    const bindings = buildSectorsIndexBindings(graph(false));
    assert.deepEqual(bindings.sectors, []);
    assert.equal(bindings.totalOcc, OCCUPATION_COUNT.SCORED);
    assert.ok(bindings.seoDesc.startsWith('日本の0職業'));
    const list = JSON.parse(bindings.jsonLd)['@graph'][2];
    assert.equal(list.numberOfItems, 0);
    assert.deepEqual(list.itemListElement, []);
  });
});
