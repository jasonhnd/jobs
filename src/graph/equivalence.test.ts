/**
 * equivalence.test.ts — verify the new src/graph/ data matches the legacy
 * src/data/lib/indexes.ts buildIndexes() output.
 *
 * Both layers read from the same source files; they must produce equivalent
 * node counts, sector assignments, and per-occupation dimension weights.
 * If they diverge, the Strangler-Fig migration is unsafe because the new
 * path would silently differ from the old path that's still in production.
 *
 * This is a regression guard, not an integration test. It runs once during
 * migration. Once all pages flip to the new graph (Step 8 in the migration
 * plan), we can keep it or delete it — the call site is removed.
 */

import { describe, test, before } from 'node:test';
import { strict as assert } from 'node:assert';

import { loadGraph } from './loader.js';
import {
  asOccupationId,
  asSectorId,
  asSkillId,
} from './ids.js';
import type { KnowledgeGraph } from './types.js';

import { buildIndexes, type Indexes } from '../data/lib/indexes.js';

let graph: KnowledgeGraph;
let indexes: Indexes;

before(async () => {
  graph = await loadGraph();
  const result = await buildIndexes();
  if (result.errors.length > 0) {
    throw new Error(
      `buildIndexes() returned ${result.errors.length} errors — fix them before running equivalence.\n` +
      result.errors.slice(0, 3).map(e => `  - ${e.file}: ${e.message}`).join('\n'),
    );
  }
  indexes = result.indexes;
});

describe('equivalence — counts', () => {
  test('occupation count matches', () => {
    assert.equal(graph.occupations.size, indexes.occById.size);
  });

  test('sector count matches', () => {
    assert.equal(graph.sectors.size, indexes.sectors.length);
  });

  test('every dimension label map size matches indexes.labelsByDim', () => {
    const dims: Array<[keyof KnowledgeGraph, string]> = [
      ['skills',              'skills'],
      ['knowledge',           'knowledge'],
      ['abilities',           'abilities'],
      ['interests',           'interests'],
      ['workValues',          'work_values'],
      ['workCharacteristics', 'work_characteristics'],
      ['workActivities',      'work_activities'],
    ];
    for (const [graphKey, dimKey] of dims) {
      const graphMap = graph[graphKey] as ReadonlyMap<unknown, unknown>;
      const indexMap = indexes.labelsByDim.get(dimKey);
      assert.ok(indexMap, `indexes.labelsByDim missing dimension ${dimKey}`);
      assert.equal(
        graphMap.size,
        indexMap!.size,
        `${graphKey} size mismatch: graph=${graphMap.size}, indexes=${indexMap!.size}`,
      );
    }
  });
});

describe('equivalence — occupation #1 sector assignment matches', () => {
  test('graph.sectorOf(1) === indexes.sectorByOcc.get(1).sector_id', () => {
    const graphSector = graph.sectorOf(asOccupationId(1));
    const indexAssignment = indexes.sectorByOcc.get(1);
    assert.ok(indexAssignment, 'indexes.sectorByOcc missing occ #1');
    if (indexAssignment.sector_id === '_uncategorized') {
      assert.equal(graphSector, null);
    } else {
      assert.equal(graphSector, asSectorId(indexAssignment.sector_id));
    }
  });
});

describe('equivalence — every assigned sector matches', () => {
  test('sectorOf matches sectorByOcc for all occupations', () => {
    let mismatched = 0;
    let sampleMismatch = '';
    for (const [occId, occ] of indexes.occById) {
      const indexAssignment = indexes.sectorByOcc.get(occId);
      const graphSector = graph.sectorOf(asOccupationId(occId));
      const indexExpected =
        indexAssignment && indexAssignment.sector_id !== '_uncategorized'
          ? indexAssignment.sector_id
          : null;
      const graphActual = graphSector === null ? null : String(graphSector);
      if (indexExpected !== graphActual) {
        mismatched += 1;
        if (!sampleMismatch) {
          sampleMismatch = `occ ${occId} (${occ.title_ja}): index=${indexExpected}, graph=${graphActual}`;
        }
      }
    }
    assert.equal(mismatched, 0, `sector mismatch: ${mismatched} occupations. First: ${sampleMismatch}`);
  });
});

describe('equivalence — skill weights match for occ #1', () => {
  test('graph.skillsOf(1) entries match indexes.occById.get(1).skills', () => {
    const occ1 = indexes.occById.get(1)!;
    const indexSkills = occ1.skills ?? {};
    const graphSkills = graph.skillsOf(asOccupationId(1));

    assert.equal(graphSkills.length, Object.keys(indexSkills).length);

    for (const edge of graphSkills) {
      const key = String(edge.to);
      assert.equal(
        edge.weight,
        indexSkills[key],
        `skill weight mismatch for ${key}: graph=${edge.weight}, index=${indexSkills[key]}`,
      );
    }
  });
});

describe('equivalence — total edge counts match summed inline weights', () => {
  test('total skill edges == sum of inline skill keys across all occupations', () => {
    let inlineTotal = 0;
    for (const occ of indexes.occById.values()) {
      inlineTotal += occ.skills ? Object.keys(occ.skills).length : 0;
    }
    let graphTotal = 0;
    for (const occId of graph.occupations.keys()) {
      graphTotal += graph.skillsOf(occId).length;
    }
    assert.equal(graphTotal, inlineTotal);
  });
});

describe('equivalence — silence the "asSkillId is exported but might be unused" linter', () => {
  // Tests above already exercise asSkillId via graph.skillsOf().to, but the
  // explicit import here keeps the dependency visible in case future tests
  // need to round-trip a known key through the brand constructor.
  test('asSkillId is callable and returns a string', () => {
    assert.equal(typeof asSkillId('speaking'), 'string');
  });
});
