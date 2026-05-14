/**
 * compare.test.ts — smoke test for the compare-pair loader factory.
 *
 * `makeCompareLoaderFromGraph(graph)` returns a loader function
 * compatible with src/views/compare-hub.buildComparePair(),
 * sourced from the graph.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { makeCompareLoaderFromGraph } from './compare.js';
import type { KnowledgeGraph } from '@/graph';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('makeCompareLoaderFromGraph', () => {
  test('returns a function (id-keyed DetailFile lookup)', () => {
    const loader = makeCompareLoaderFromGraph(graph);
    assert.equal(typeof loader, 'function');
  });

  test('loader returns a DetailFile for a valid occupation id', () => {
    const firstId = [...graph.occupations.keys()][0] as unknown as number;
    const detail = makeCompareLoaderFromGraph(graph)(firstId);
    assert.ok(detail !== undefined && detail !== null);
    assert.equal(detail.id, firstId);
    assert.ok(detail.title !== undefined);
  });
});
