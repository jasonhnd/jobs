/**
 * interest.test.ts — smoke test for the RIASEC interest views.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import {
  makeHollandLoaderFromGraph,
  makeInterestsTreemapFromGraph,
} from './interest.js';
import type { KnowledgeGraph } from '@/graph';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('makeHollandLoaderFromGraph', () => {
  test('returns a function', () => {
    assert.equal(typeof makeHollandLoaderFromGraph(graph), 'function');
  });

  test('loader returns a non-empty array', () => {
    const rows = makeHollandLoaderFromGraph(graph)();
    assert.ok(Array.isArray(rows));
    assert.ok(rows.length > 0);
  });
});

describe('makeInterestsTreemapFromGraph', () => {
  test('returns a factory function', () => {
    assert.equal(typeof makeInterestsTreemapFromGraph(graph), 'function');
  });

  test('factory returns a Map keyed by occupation id', () => {
    const treemap = makeInterestsTreemapFromGraph(graph)();
    assert.ok(treemap instanceof Map);
    assert.ok(treemap.size > 0);
  });
});
