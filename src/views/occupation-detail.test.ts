/**
 * occupation-detail.test.ts — integration smoke test.
 *
 * `buildOccupationDetailFile(graph, occId)` is the per-page entry
 * called from [id].astro's getStaticPaths. It outputs the same
 * DetailFile shape that src/data/projections/detail.ts emits,
 * sourced from the graph.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { buildOccupationDetailFile } from './occupation-detail.js';
import type { KnowledgeGraph, OccupationId } from '@/graph';

let graph: KnowledgeGraph;
let firstOccId: OccupationId;

before(async () => {
  graph = await loadGraph();
  firstOccId = [...graph.occupations.keys()][0];
});

describe('buildOccupationDetailFile', () => {
  test('returns a DetailFile for a known occupation id', () => {
    const detail = buildOccupationDetailFile(graph, firstOccId);
    assert.equal(detail.id, firstOccId);
    assert.ok(detail.title !== undefined);
    assert.ok(typeof detail.title.ja === 'string');
  });

  test('throws on an unknown occupation id', () => {
    assert.throws(
      () => buildOccupationDetailFile(graph, 99999999 as unknown as OccupationId),
      /not in graph/i,
    );
  });

  test('ai_risk.score is null or a 0-10 number', () => {
    const detail = buildOccupationDetailFile(graph, firstOccId);
    const score = detail.ai_risk?.score ?? null;
    if (score !== null) {
      assert.ok(typeof score === 'number' && score >= 0 && score <= 10);
    }
  });

  test('output is reproducible (same input → same output bytes)', () => {
    const a = buildOccupationDetailFile(graph, firstOccId);
    const b = buildOccupationDetailFile(graph, firstOccId);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});
