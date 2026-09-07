/**
 * occupation-page-data.test.ts — pin the related-occupation
 * picking algorithm extracted from [id].astro's getStaticPaths.
 *
 * `buildOccupationPageData` is integration-shaped (loads the full
 * graph) — tested via the full build + SEO-baseline gate at
 * verification time, not here.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canonicalOccupationRank } from '../pages/_id-bindings.js';
import { buildOccupationFaqTuples } from '../pages/_id-renderers.js';
import {
  computeGeoFacts,
  type GeoScoreEntry,
  type GeoScoreRunLike,
  type GeoTreemapRow,
} from '../site/geo-facts.js';
import { pickRelatedOccupations } from './occupation-page-data.js';
import type { Rec } from '@/views/occupation-detail';

function fakeRec(id: number, aiRisk: number | null): Rec {
  return {
    id,
    name_ja: `occ-${id}`,
    desc_ja: null,
    what_it_is_ja: null,
    how_to_become_ja: null,
    working_conditions_ja: null,
    salary: null,
    workers: null,
    hours: null,
    age: null,
    recruit_wage: null,
    recruit_ratio: null,
    hourly_wage: null,
    ai_risk: aiRisk,
    ai_rationale_ja: null,
    url: '',
    aliases_ja: [],
    classifications: {},
    sector: null,
    risk_band: null,
    workforce_band: null,
    demand_band: null,
    ai_model: null,
    ai_scored_at: null,
    skills_top10: [],
    knowledge_top5: [],
    abilities_top5: [],
    tasks_count: null,
    tasks_lead_ja: null,
    related_orgs: [],
    related_certs_ja: [],
    data_source_versions: {},
    ai_rationale_long_ja: null,
    ai_displaceable_tasks_ja: [],
    ai_resilient_tasks_ja: [],
    ai_horizon_5y_ja: null,
    aiois: null,
    consensus_transformation: aiRisk,
    latest_transformation: aiRisk,
    latest_delta: 0,
    used_expired_votes: false,
    consensus_vote_count: null,
    profile5: {
      creative: null,
      social: null,
      judgment: null,
      physical: null,
      routine: null,
    },
    transferCandidates: {
      source_id: id,
      candidates: [],
      fallback: 'no_skills',
    },
  };
}

describe('pickRelatedOccupations', () => {
  test('focus excluded from results', () => {
    const all = [fakeRec(1, 5), fakeRec(2, 5), fakeRec(3, 5)];
    const out = pickRelatedOccupations(all[0], all, 2);
    assert.equal(out.length, 2);
    assert.ok(!out.some((r) => r.id === 1));
  });

  test('default count = 5', () => {
    const all = Array.from({ length: 20 }, (_, i) => fakeRec(i + 1, 5));
    const out = pickRelatedOccupations(all[0], all);
    assert.equal(out.length, 5);
  });

  test('close AI-risk quota: first 3 slots come from |risk-focus.risk| ≤ 1', () => {
    const focus = fakeRec(10, 5);
    const close = [fakeRec(11, 5), fakeRec(12, 4), fakeRec(13, 6)]; // close
    const far = [fakeRec(14, 1), fakeRec(15, 9)]; // far risk
    const all = [focus, ...close, ...far];
    const out = pickRelatedOccupations(focus, all, 5);
    const closeIds = new Set([11, 12, 13]);
    const firstThree = out.slice(0, 3).map((r) => r.id);
    for (const id of firstThree) {
      assert.ok(closeIds.has(id), `expected first 3 to be close-risk; got ${firstThree}`);
    }
  });

  test('close-risk sorted by risk-distance, then id-distance, then id', () => {
    const focus = fakeRec(100, 5);
    const all = [
      focus,
      fakeRec(200, 5), // dist 0 risk, dist 100 id
      fakeRec(101, 6), // dist 1 risk, dist 1 id
      fakeRec(102, 5), // dist 0 risk, dist 2 id
    ];
    const out = pickRelatedOccupations(focus, all, 3);
    // Expected order: dist 0 risk wins → 200 vs 102: 102 has smaller id-dist (2 < 100).
    // So 102 first, then 200, then 101.
    assert.equal(out[0].id, 102);
    assert.equal(out[1].id, 200);
    assert.equal(out[2].id, 101);
  });

  test('null focus.ai_risk skips the close-risk quota; falls through to id-distance', () => {
    const focus = fakeRec(5, null);
    const all = [
      focus,
      fakeRec(3, 5),
      fakeRec(7, 5),
      fakeRec(100, 5),
    ];
    const out = pickRelatedOccupations(focus, all, 3);
    // All filled by id-distance: |3-5|=2, |7-5|=2, |100-5|=95. Tie broken by id: 3 < 7.
    assert.deepEqual(
      out.map((r) => r.id),
      [3, 7, 100],
    );
  });

  test('not enough close-risk → quota underfilled, rest from id-distance', () => {
    const focus = fakeRec(10, 5);
    const all = [
      focus,
      fakeRec(11, 5), // close (only one)
      fakeRec(12, 9), // far
      fakeRec(13, 1), // far
      fakeRec(14, 0), // far
    ];
    const out = pickRelatedOccupations(focus, all, 5);
    // 11 first (close-risk quota), then 12/13/14 by id-distance from 10.
    assert.equal(out[0].id, 11);
    assert.deepEqual(
      out.slice(1).map((r) => r.id),
      [12, 13, 14],
    );
  });

  test('close-risk neighbour with null ai_risk excluded from quota', () => {
    const focus = fakeRec(10, 5);
    const all = [focus, fakeRec(11, null), fakeRec(12, 5)];
    const out = pickRelatedOccupations(focus, all, 2);
    // 12 (close-risk match) first; 11 fills from id-distance.
    assert.deepEqual(
      out.map((r) => r.id),
      [12, 11],
    );
  });
});

test('occupation hero and FAQ share the canonical tied-score rank', () => {
  const rows: GeoTreemapRow[] = [
    { id: 3, name_ja: 'occ-3', ai_risk: 7, workers: 100, sector_id: null, sector_ja: null },
    { id: 2, name_ja: 'occ-2', ai_risk: 7, workers: 200, sector_id: null, sector_ja: null },
    { id: 1, name_ja: 'occ-1', ai_risk: 7, workers: 200, sector_id: null, sector_ja: null },
  ];
  const scores = new Map<number, GeoScoreEntry>(
    rows.map((row) => [row.id, { ai_risk: 7, aiois: { displacement: 2 } }]),
  );
  const scoreRun: GeoScoreRunLike = {
    scope: 'occupations',
    scorer: { model: 'test-model' },
    run: { run_date: '2026-01-01' },
    scores: Object.fromEntries([...scores].map(([id, entry]) => [String(id), entry])),
  };
  const geoFacts = computeGeoFacts(rows, [scoreRun]);

  for (const [id, expectedRank] of [[1, 1], [2, 2], [3, 3]] as const) {
    const rec = fakeRec(id, 7);
    const heroRank = canonicalOccupationRank(geoFacts, id);
    const faqText = buildOccupationFaqTuples(rec, geoFacts).flat().join(' ');

    assert.equal(heroRank, expectedRank, `hero rank for ${id}`);
    assert.match(faqText, new RegExp(`全3職業中${expectedRank}位`), `FAQ rank for ${id}`);
  }
});
