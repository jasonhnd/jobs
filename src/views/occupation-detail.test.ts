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
import { asOccupationId } from '@/graph/ids';
import { VENDOR_WHITELIST } from '@/site/score-attribution';

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

  test('occ 111 exposes unrounded consensus plus latest-observation delta', () => {
    const detail = buildOccupationDetailFile(graph, asOccupationId(111));
    assert.equal(typeof detail.consensus_transformation, 'number');
    assert.equal(detail.ai_risk?.score, detail.consensus_transformation);
    assert.equal(typeof detail.latest_transformation, 'number');
    assert.ok(detail.latest_delta != null);
    assert.ok(
      Math.abs(detail.latest_delta - (detail.latest_transformation! - detail.consensus_transformation!)) < 1e-9,
    );
    assert.notEqual(detail.latest_transformation, detail.consensus_transformation);
  });

  test('occ 111 reports three vendors and is not stale on current data', () => {
    const detail = buildOccupationDetailFile(graph, asOccupationId(111));
    assert.equal(detail.consensus_vendor_count, VENDOR_WHITELIST.length);
    assert.equal(detail.stale_vote, false);
  });

  test('stale_vote is true when one vendor is more than 6 months behind the panel anchor', () => {
    const occId = asOccupationId(111);
    const original = graph.scoreHistoryByOcc.get(occId) ?? [];
    const dims = original.find((e) => e.dims != null)?.dims;
    assert.ok(dims);
    const synthetic = [
      { model: 'claude-opus-5', provider: 'anthropic', date: '2026-01-01', backfill: false, transformation: 5, rationaleJa: 'a', displacement: 2, dims, confidence: 0.8 },
      { model: 'gpt-5.6-sol', provider: 'openai', date: '2026-09-07', backfill: false, transformation: 5, rationaleJa: 'b', displacement: 2, dims, confidence: 0.8 },
      { model: 'grok-4.6', provider: 'xai', date: '2026-09-07', backfill: false, transformation: 5, rationaleJa: 'c', displacement: 2, dims, confidence: 0.8 },
    ];
    const patched = {
      ...graph,
      scoreHistoryByOcc: new Map(graph.scoreHistoryByOcc).set(occId, synthetic),
    };
    const stale = buildOccupationDetailFile(patched, occId);
    assert.equal(stale.stale_vote, true);
    assert.equal(stale.consensus_vendor_count, VENDOR_WHITELIST.length);

    const fresh = [
      { model: 'claude-opus-5', provider: 'anthropic', date: '2026-07-26', backfill: false, transformation: 5, rationaleJa: 'a', displacement: 2, dims, confidence: 0.8 },
      { model: 'gpt-5.6-sol', provider: 'openai', date: '2026-07-12', backfill: false, transformation: 5, rationaleJa: 'b', displacement: 2, dims, confidence: 0.8 },
      { model: 'grok-4.6', provider: 'xai', date: '2026-09-07', backfill: false, transformation: 5, rationaleJa: 'c', displacement: 2, dims, confidence: 0.8 },
    ];
    const patchedFresh = {
      ...graph,
      scoreHistoryByOcc: new Map(graph.scoreHistoryByOcc).set(occId, fresh),
    };
    const notStale = buildOccupationDetailFile(patchedFresh, occId);
    assert.equal(notStale.stale_vote, false);
  });
});
