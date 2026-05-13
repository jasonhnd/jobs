/**
 * skill.test.ts — smoke test for the skill-ranking loader factory.
 */

import { before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadGraph } from '@/graph';
import {
  makeSkillRankingLoaderFromGraph,
  makeTreemapSummaryFromGraph,
} from './skill.js';
import type { KnowledgeGraph } from '@/graph';

let graph: KnowledgeGraph;

before(async () => {
  graph = await loadGraph();
});

describe('makeSkillRankingLoaderFromGraph', () => {
  test('returns a function (ipd-key → ranking shape)', () => {
    assert.equal(typeof makeSkillRankingLoaderFromGraph(graph), 'function');
  });
});

describe('makeTreemapSummaryFromGraph', () => {
  test('returns a factory function', () => {
    assert.equal(typeof makeTreemapSummaryFromGraph(graph), 'function');
  });

  test('factory returns a Map keyed by occupation id', () => {
    const summary = makeTreemapSummaryFromGraph(graph)();
    assert.ok(summary instanceof Map);
    assert.ok(summary.size > 0);
  });
});
