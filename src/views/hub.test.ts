/**
 * hub.test.ts — integration smoke test for src/views/hub.
 *
 * `loadGraphAdaptedDetails(graph)` builds the DetailFileMin[]
 * array that hub pages (genre / abilities / knowledge / values /
 * etc.) consume. It mirrors what src/data/projections/detail.ts
 * used to emit but reads from the graph instead.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { loadGraphAdaptedDetails } from './hub.js';
import type { KnowledgeGraph } from '@/graph';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('loadGraphAdaptedDetails', () => {
  test('returns one entry per occupation in the graph', () => {
    const details = loadGraphAdaptedDetails(graph);
    assert.equal(details.length, graph.occupations.size);
  });

  test('every entry has a numeric id', () => {
    const details = loadGraphAdaptedDetails(graph);
    for (const d of details) {
      assert.ok(typeof d.id === 'number', `bad id: ${d.id}`);
    }
  });

  test('ids are unique', () => {
    const details = loadGraphAdaptedDetails(graph);
    const ids = details.map((d) => d.id);
    assert.equal(ids.length, new Set(ids).size, 'duplicate ids');
  });

  test('every entry has a title with .ja', () => {
    const details = loadGraphAdaptedDetails(graph);
    for (const d of details) {
      assert.ok(d.title !== undefined && typeof d.title.ja === 'string');
    }
  });
});
