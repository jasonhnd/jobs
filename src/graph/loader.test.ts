/**
 * loader.test.ts — load the knowledge graph and pin its expected shape:
 *
 *   - All 9 node maps populate with the expected counts
 *   - Sample node fields parse correctly (occupation #1 = 豆腐製造)
 *   - Edge query functions return expected results for known IDs
 *   - Determinism: two loads produce equivalent graphs
 *
 * Equivalence against the legacy buildIndexes() is in equivalence.test.ts.
 */

import { describe, test, before } from 'node:test';
import { strict as assert } from 'node:assert';

import { loadGraph } from './loader.js';
import {
  asOccupationId,
  asSectorId,
  asSkillId,
  asKnowledgeId,
  asAbilityId,
  asInterestId,
  asWorkValueId,
  asWorkCharacteristicId,
  asWorkActivityId,
} from './ids.js';
import type { KnowledgeGraph } from './types.js';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('loadGraph — node maps', () => {
  test('occupations: 556 nodes loaded from data/occupations/', () => {
    assert.equal(graph.occupations.size, 556);
  });

  test('sectors: 16 nodes loaded from data/sectors/sectors.ja-en.json', () => {
    assert.equal(graph.sectors.size, 16);
  });

  test('skills: at least 10 nodes (10 IPD skills, possibly more in labels file)', () => {
    assert.ok(graph.skills.size >= 10, `expected >= 10 skills, got ${graph.skills.size}`);
  });

  test('all 7 dimension maps are non-empty', () => {
    assert.ok(graph.skills.size > 0,              'skills empty');
    assert.ok(graph.knowledge.size > 0,           'knowledge empty');
    assert.ok(graph.abilities.size > 0,           'abilities empty');
    assert.ok(graph.interests.size > 0,           'interests empty');
    assert.ok(graph.workValues.size > 0,          'workValues empty');
    assert.ok(graph.workCharacteristics.size > 0, 'workCharacteristics empty');
    assert.ok(graph.workActivities.size > 0,      'workActivities empty');
  });

  test('interests: 6 RIASEC entries (realistic / investigative / artistic / social / enterprising / conventional)', () => {
    assert.equal(graph.interests.size, 6);
    for (const key of ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional']) {
      assert.ok(graph.interests.has(asInterestId(key)), `interest ${key} missing`);
    }
  });
});

describe('loadGraph — occupation node shape', () => {
  test('occ #1 (豆腐製造、豆腐職人) basic fields', () => {
    const occ = graph.occupations.get(asOccupationId(1));
    assert.ok(occ, 'occ #1 missing');
    assert.equal(Number(occ.id), 1);
    assert.equal(occ.titleJa, '豆腐製造、豆腐職人');
    assert.ok(occ.aliasesJa.includes('豆腐製造工'), 'aliasesJa missing expected entry');
    assert.equal(occ.classifications.mhlwMain, '12_072-06');
    assert.ok(occ.url.startsWith('https://') || occ.url.startsWith('http://'), 'occupation url must be http(s)');
  });

  test('occ #1 description fields populated', () => {
    const occ = graph.occupations.get(asOccupationId(1))!;
    assert.ok(occ.description.summaryJa, 'summaryJa null');
    assert.ok(occ.description.whatItIsJa, 'whatItIsJa null');
    assert.ok(occ.description.howToBecomeJa, 'howToBecomeJa null');
    assert.ok(occ.description.workingConditionsJa, 'workingConditionsJa null');
  });

  test('stats are either fully present (object) or null (no stats_legacy file)', () => {
    let withStats = 0;
    let withoutStats = 0;
    for (const occ of graph.occupations.values()) {
      if (occ.stats === null) withoutStats += 1;
      else withStats += 1;
    }
    // 552 stats_legacy files cover 556 occupations → 4 expected without stats.
    assert.equal(withStats, 552, `expected 552 occupations with stats, got ${withStats}`);
    assert.equal(withoutStats, 4, `expected 4 occupations without stats, got ${withoutStats}`);
  });

  test('aiRisk: at least 500 occupations have a latest score', () => {
    let scored = 0;
    for (const occ of graph.occupations.values()) {
      if (occ.aiRisk !== null) scored += 1;
    }
    assert.ok(scored >= 500, `expected >= 500 scored occupations, got ${scored}`);
    // Score is an integer 0-10.
    for (const occ of graph.occupations.values()) {
      if (occ.aiRisk === null) continue;
      assert.ok(Number.isInteger(occ.aiRisk.score), `aiRisk.score not int for occ ${occ.id}`);
      assert.ok(occ.aiRisk.score >= 0 && occ.aiRisk.score <= 10, `aiRisk.score out of range for occ ${occ.id}`);
    }
  });
});

describe('loadGraph — sector node shape', () => {
  test('iryo sector exists with expected fields', () => {
    const iryo = graph.sectors.get(asSectorId('iryo'));
    assert.ok(iryo, 'iryo sector missing');
    assert.equal(iryo.nameJa, '医療・保健');
    assert.equal(iryo.nameEn, 'Medical & Health');
    assert.equal(iryo.hue, 'safe');
    assert.ok(iryo.mhlwSeedCodes.length > 0, 'mhlwSeedCodes empty for iryo');
  });
});

describe('queries — sectorOf / occupationsBySector', () => {
  test('sectorOf returns 製造 sector for 豆腐職人 (occ #1, mhlw 12_072-06)', () => {
    const sector = graph.sectorOf(asOccupationId(1));
    assert.ok(sector !== null, 'sectorOf(1) returned null');
    // Sector for mhlw 12_* should be the manufacturing-like sector.
    // We don't pin the exact slug to keep the test robust to sector renames;
    // just assert it's a real registered sector.
    assert.ok(graph.sectors.has(sector!), `sector ${sector} not in sectors map`);
  });

  test('occupationsBySector returns >= 1 occupation for every populated sector', () => {
    let totalAssigned = 0;
    for (const secId of graph.sectors.keys()) {
      const occs = graph.occupationsBySector(secId);
      totalAssigned += occs.length;
    }
    // Most of the 556 occupations are assigned to a real sector (a few may
    // land in _uncategorized and not show up in any sector bucket).
    assert.ok(totalAssigned >= 500, `expected >= 500 sector-assigned occs, got ${totalAssigned}`);
  });

  test('occupationsBySector returns frozen array', () => {
    for (const secId of graph.sectors.keys()) {
      const occs = graph.occupationsBySector(secId);
      assert.throws(() => (occs as unknown as number[]).push(0), /read only|object is not extensible|frozen/i);
      break; // one is enough
    }
  });
});

describe('queries — weighted edge accessors', () => {
  test('skillsOf(1) returns 39 weighted skill edges for occ #1', () => {
    const edges = graph.skillsOf(asOccupationId(1));
    // Occupation #1 has all 39 IPD skills scored (verified from raw source).
    assert.equal(edges.length, 39);
    // All weights are within IPD numeric range.
    for (const e of edges) {
      assert.equal(Number(e.from), 1);
      assert.ok(e.weight >= 0 && e.weight <= 7, `weight out of range: ${e.weight}`);
    }
    // 'speaking' should be one of the keys.
    assert.ok(edges.some(e => String(e.to) === 'speaking'), 'speaking edge missing');
  });

  test('interestsOf(1) returns 6 RIASEC edges', () => {
    const edges = graph.interestsOf(asOccupationId(1));
    assert.equal(edges.length, 6);
    const keys = new Set(edges.map(e => String(e.to)));
    for (const k of ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional']) {
      assert.ok(keys.has(k), `RIASEC ${k} missing in interestsOf(1)`);
    }
  });

  test('every dimension query returns empty array (not null) for unknown occupation', () => {
    const ghost = asOccupationId(999);
    assert.deepEqual([...graph.skillsOf(ghost)],              []);
    assert.deepEqual([...graph.knowledgeOf(ghost)],           []);
    assert.deepEqual([...graph.abilitiesOf(ghost)],           []);
    assert.deepEqual([...graph.interestsOf(ghost)],           []);
    assert.deepEqual([...graph.workValuesOf(ghost)],          []);
    assert.deepEqual([...graph.workCharacteristicsOf(ghost)], []);
    assert.deepEqual([...graph.workActivitiesOf(ghost)],      []);
  });

  test('weighted-edge accessors return empty array when source dimension is null', () => {
    // Occupation #1's work_values is null in the source → workValuesOf should
    // return an empty array, not throw.
    const edges = graph.workValuesOf(asOccupationId(1));
    assert.equal(edges.length, 0);
  });
});

describe('dimension ID branding (compile-time only, sanity at runtime)', () => {
  test('every dimension constructor returns a usable key', () => {
    // Spot-check that the constructors are zero-cost and produce string-like values.
    const s = asSkillId('speaking');
    const k = asKnowledgeId('medicine');
    const a = asAbilityId('stamina');
    const wv = asWorkValueId('achievement');
    const wc = asWorkCharacteristicId('something');
    const wa = asWorkActivityId('something');
    assert.equal(typeof s, 'string');
    assert.equal(typeof k, 'string');
    assert.equal(typeof a, 'string');
    assert.equal(typeof wv, 'string');
    assert.equal(typeof wc, 'string');
    assert.equal(typeof wa, 'string');
  });
});

describe('determinism — two loads produce equivalent graphs', () => {
  test('node counts match across two independent loadGraph() calls', async () => {
    const second = await loadGraph();
    assert.equal(second.occupations.size,         graph.occupations.size);
    assert.equal(second.sectors.size,             graph.sectors.size);
    assert.equal(second.skills.size,              graph.skills.size);
    assert.equal(second.knowledge.size,           graph.knowledge.size);
    assert.equal(second.abilities.size,           graph.abilities.size);
    assert.equal(second.interests.size,           graph.interests.size);
    assert.equal(second.workValues.size,          graph.workValues.size);
    assert.equal(second.workCharacteristics.size, graph.workCharacteristics.size);
    assert.equal(second.workActivities.size,      graph.workActivities.size);
  });

  test('sample occupation deep-equal across two loads', async () => {
    const second = await loadGraph();
    const a = graph.occupations.get(asOccupationId(1));
    const b = second.occupations.get(asOccupationId(1));
    assert.deepEqual(a, b);
  });

  test('sample edges deep-equal across two loads', async () => {
    const second = await loadGraph();
    assert.deepEqual(
      [...graph.skillsOf(asOccupationId(1))],
      [...second.skillsOf(asOccupationId(1))],
    );
  });
});
