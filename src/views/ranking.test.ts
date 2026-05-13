/**
 * ranking.test.ts — integration smoke test for src/views/ranking.
 *
 * `loadOccupationsFromGraph(graph)` builds the Occupation[] array
 * that buildRankings() consumes. Tests assert shape invariants
 * over the production graph.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { loadOccupationsFromGraph } from './ranking.js';
import type { KnowledgeGraph } from '@/graph';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('loadOccupationsFromGraph', () => {
  test('returns one row per occupation in the graph', () => {
    const occs = loadOccupationsFromGraph(graph);
    assert.equal(occs.length, graph.occupations.size);
  });

  test('every row has typed id + title_ja', () => {
    const occs = loadOccupationsFromGraph(graph);
    for (const o of occs) {
      assert.ok(typeof o.id === 'number');
      assert.ok(typeof o.title_ja === 'string');
    }
  });

  test('every row has a riskBand of {low, mid, high} or null', () => {
    const occs = loadOccupationsFromGraph(graph);
    const valid = new Set(['low', 'mid', 'high', null]);
    for (const o of occs) {
      assert.ok(valid.has(o.risk_band), `bad risk_band: ${o.risk_band}`);
    }
  });

  test('ai_risk numeric values stay in 0..10 range', () => {
    const occs = loadOccupationsFromGraph(graph);
    for (const o of occs) {
      if (o.ai_risk === null) continue;
      assert.ok(
        typeof o.ai_risk === 'number' && o.ai_risk >= 0 && o.ai_risk <= 10,
        `bad ai_risk: ${o.ai_risk}`,
      );
    }
  });
});
