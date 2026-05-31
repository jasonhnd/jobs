/**
 * sector.test.ts — integration tests for the sector views.
 *
 * Loads the production knowledge graph (via `loadGraph()`) and
 * asserts invariants of the two exported views:
 *   - sectorIndexView(graph)
 *   - sectorDetailView(graph, sectorId)
 *
 * Integration-shaped rather than unit-shaped because a minimal
 * KnowledgeGraph fixture (Maps + Sets + indexed lookups across
 * occupations / sectors / abilities / etc.) would be substantially
 * more code than the views themselves. The graph load takes ~150ms
 * and is shared across tests via `before()`.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import { sectorIndexView, sectorDetailView } from './sector.js';
import type { KnowledgeGraph, SectorId } from '@/graph';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('sectorIndexView', () => {
  test('returns at least 16 sectors (current production count)', () => {
    const view = sectorIndexView(graph);
    assert.ok(view.sectors.length >= 16, `expected ≥16 sectors, got ${view.sectors.length}`);
  });

  test('every sector entry has id + ja name + occupationCount', () => {
    const view = sectorIndexView(graph);
    for (const e of view.sectors) {
      assert.ok(typeof e.id === 'string' || typeof e.id === 'number', `bad id: ${e.id}`);
      assert.ok(typeof e.ja === 'string' && e.ja.length > 0, `bad ja: ${e.ja}`);
      assert.ok(typeof e.occupationCount === 'number' && e.occupationCount >= 0);
    }
  });

  test('occupation counts sum to roughly 556 (one occupation per sector ideal)', () => {
    const view = sectorIndexView(graph);
    const total = view.sectors.reduce((s, e) => s + e.occupationCount, 0);
    // Allow small overlap if any occupation appears in multiple sectors,
    // and slack for the data-set's 556 published occupations.
    assert.ok(total >= 500 && total <= 600, `total occupation coverage = ${total}, expected 500-600`);
  });

  test('sector ids are unique', () => {
    const view = sectorIndexView(graph);
    const ids = view.sectors.map((e) => e.id);
    assert.equal(ids.length, new Set(ids).size, 'duplicate sector ids');
  });
});

describe('sectorDetailView', () => {
  // Use the first sector from the graph as the test target.
  let firstSectorId: SectorId;

  before(() => {
    const view = sectorIndexView(graph);
    firstSectorId = view.sectors[0].id;
  });

  test('returns a populated sector for a valid id', () => {
    const view = sectorDetailView(graph, firstSectorId);
    assert.ok(view.sector !== null);
    assert.ok(view.sector.id === firstSectorId);
    assert.ok(typeof view.sector.nameJa === 'string' && view.sector.nameJa.length > 0);
  });

  test('occupations array is non-empty + every row has typed fields', () => {
    const view = sectorDetailView(graph, firstSectorId);
    assert.ok(view.occupations.length > 0, 'sector has zero occupations');
    for (const occ of view.occupations) {
      assert.ok(typeof occ.id === 'number' || typeof occ.id === 'string');
      // titleJa can be null in legacy data but should be string when present.
      assert.ok(occ.titleJa === null || typeof occ.titleJa === 'string');
      // aiRisk null OR number 0-10.
      assert.ok(
        occ.aiRisk === null ||
          (typeof occ.aiRisk === 'number' && occ.aiRisk >= 0 && occ.aiRisk <= 10),
        `bad aiRisk: ${occ.aiRisk}`,
      );
    }
  });

  test('allOccupations covers the full site (≥500 rows for cross-sector baselines)', () => {
    const view = sectorDetailView(graph, firstSectorId);
    assert.ok(view.allOccupations.length >= 500, `allOccupations=${view.allOccupations.length}, expected ≥500`);
  });

  test('relatedSectors excludes the focus sector itself', () => {
    const view = sectorDetailView(graph, firstSectorId);
    for (const r of view.relatedSectors) {
      assert.notEqual(r.id, firstSectorId, 'related sectors should not include self');
    }
  });

  test('riskBand on each occupation is one of {low, mid, high, null}', () => {
    const view = sectorDetailView(graph, firstSectorId);
    const valid = new Set(['low', 'mid', 'high', null]);
    for (const occ of view.occupations) {
      assert.ok(valid.has(occ.riskBand), `bad riskBand: ${occ.riskBand}`);
    }
  });
});
