/**
 * spoke-spoke-graph.test.ts — pin the cross-sector same-risk neighbor
 * builder + its renderer. Tests cover the symmetrization rule that
 * keeps the graph mutually connected for SEO topic clustering.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildSameRiskNeighbors,
  renderSameRiskSection,
  SAME_RISK_CSS,
  type SpokeMin,
  type SpokeNeighbor,
} from './spoke-spoke-graph.js';

function makeSpoke(overrides: Partial<SpokeMin> = {}): SpokeMin {
  return {
    id: 1,
    name_ja: 'occ',
    ai_risk: 5,
    sector_id: 'iryo',
    sector_ja: '医療',
    workers: 1000,
    ...overrides,
  } as SpokeMin;
}

describe('buildSameRiskNeighbors — core selection', () => {
  test('returns a map from occupation id to neighbor list', () => {
    const spokes = [
      makeSpoke({ id: 1, ai_risk: 5, sector_id: 'iryo' }),
      makeSpoke({ id: 2, ai_risk: 4, sector_id: 'it' }),
      makeSpoke({ id: 3, ai_risk: 6, sector_id: 'service' }),
    ];
    const result = buildSameRiskNeighbors(spokes);
    assert.ok(result instanceof Map);
  });

  test('excludes same-sector occupations (cross-sector axis)', () => {
    // 2 occupations in iryo with same risk → should NOT see each other.
    const spokes = [
      makeSpoke({ id: 1, ai_risk: 5, sector_id: 'iryo' }),
      makeSpoke({ id: 2, ai_risk: 5, sector_id: 'iryo' }),
      makeSpoke({ id: 3, ai_risk: 5, sector_id: 'it' }),
    ];
    const result = buildSameRiskNeighbors(spokes);
    const occ1Neighbors = result.get(1) ?? [];
    const occ1Ids = occ1Neighbors.map((n) => n.id);
    assert.ok(!occ1Ids.includes(2), '1 should not list 2 (same sector)');
    assert.ok(occ1Ids.includes(3), '1 should list 3 (different sector, same risk)');
  });

  test('matches ±1 risk window (not just exact)', () => {
    const spokes = [
      makeSpoke({ id: 1, ai_risk: 5, sector_id: 'iryo' }),
      makeSpoke({ id: 2, ai_risk: 4, sector_id: 'it' }), // -1
      makeSpoke({ id: 3, ai_risk: 6, sector_id: 'service' }), // +1
      makeSpoke({ id: 4, ai_risk: 7, sector_id: 'hanbai' }), // +2 → out
    ];
    const result = buildSameRiskNeighbors(spokes);
    const occ1Ids = (result.get(1) ?? []).map((n) => n.id);
    assert.ok(occ1Ids.includes(2));
    assert.ok(occ1Ids.includes(3));
    assert.ok(!occ1Ids.includes(4));
  });

  test('symmetry: if A lists B then B lists A', () => {
    // Mix of workforce sizes so top-N alone would be asymmetric;
    // the union step should fix it.
    const spokes = [
      makeSpoke({ id: 1, ai_risk: 5, sector_id: 'iryo', workers: 1_000_000 }),
      makeSpoke({ id: 2, ai_risk: 5, sector_id: 'it', workers: 500_000 }),
      makeSpoke({ id: 3, ai_risk: 5, sector_id: 'service', workers: 100 }),
    ];
    const result = buildSameRiskNeighbors(spokes);
    for (const [aId, neighbors] of result) {
      for (const n of neighbors) {
        const bId = n.id;
        const reverse = (result.get(bId) ?? []).map((x) => x.id);
        assert.ok(
          reverse.includes(aId),
          `symmetry violated: ${aId} → ${bId} but not ${bId} → ${aId}`,
        );
      }
    }
  });

  test('skips occupations with null ai_risk (cannot place in ±1 window)', () => {
    const spokes = [
      makeSpoke({ id: 1, ai_risk: 5, sector_id: 'iryo' }),
      makeSpoke({ id: 2, ai_risk: null, sector_id: 'it' }),
    ];
    const result = buildSameRiskNeighbors(spokes);
    const occ1Ids = (result.get(1) ?? []).map((n) => n.id);
    assert.ok(!occ1Ids.includes(2));
  });
});

describe('renderSameRiskSection — HTML output', () => {
  test('empty neighbors → empty string', () => {
    const html = renderSameRiskSection([], 5);
    assert.equal(html, '');
  });

  test('non-empty neighbors → contains a <section> tag', () => {
    const neighbors: SpokeNeighbor[] = [
      { id: 2, name_ja: '看護師', ai_risk: 5, sector_id: 'iryo', sector_ja: '医療', workers: 600_000 },
    ];
    const html = renderSameRiskSection(neighbors, 5);
    assert.match(html, /<section/);
  });

  test('escapes HTML in neighbor names (XSS protection)', () => {
    const neighbors: SpokeNeighbor[] = [
      { id: 1, name_ja: '<script>x</script>', ai_risk: 5, sector_id: 'x', sector_ja: 'y', workers: 1 },
    ];
    const html = renderSameRiskSection(neighbors, 5);
    assert.ok(!html.includes('<script>x</script>'), 'unescaped XSS payload');
    assert.match(html, /&lt;script&gt;/);
  });
});

describe('SAME_RISK_CSS — CSS export', () => {
  test('is a non-empty string', () => {
    assert.equal(typeof SAME_RISK_CSS, 'string');
    assert.ok(SAME_RISK_CSS.length > 0);
  });

  test('contains at least one class selector', () => {
    assert.match(SAME_RISK_CSS, /\.[a-z]/);
  });
});
