/**
 * occupation-page-data.test.ts — pin the related-occupation
 * picking algorithm extracted from [id].astro's getStaticPaths.
 *
 * Also covers graph-backed dataset assembly and spoke views, with
 * temporary score-history projections and in-memory graph variants.
 */

import { afterEach, before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asInterestId, asOccupationId, loadGraph, type KnowledgeGraph } from '@/graph';
import { canonicalOccupationRank } from '../pages/_id-bindings.js';
import { buildOccupationFaqTuples } from '../pages/_id-renderers.js';
import {
  computeGeoFacts,
  type GeoScoreEntry,
  type GeoScoreRunLike,
  type GeoTreemapRow,
} from '../site/geo-facts.js';
import {
  buildOccupationPageData,
  buildOccupationSpokeViews,
  pickRelatedOccupations,
  type OccupationPageDataset,
} from './occupation-page-data.js';
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
    stale_vote: false,
    consensus_vendor_count: null,
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

  test('close-risk ties at equal id-distance choose the smaller id', () => {
    const focus = fakeRec(10, 5);
    assert.deepEqual(pickRelatedOccupations(focus, [fakeRec(11, 5), focus, fakeRec(9, 5)], 2)
      .map((rec) => rec.id), [9, 11]);
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
    scorer: { model: 'test-model', model_provider: 'test' },
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

describe('occupation page loaders', () => {
  let graph: KnowledgeGraph;
  let dataset: OccupationPageDataset;
  const dirs: string[] = [];
  before(async () => {
    graph = await loadGraph();
    dataset = await buildOccupationPageData();
  });
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  test('adapts every graph occupation, sorts ids, and builds the name lookup', () => {
    const ids = [...graph.occupations.keys()].sort((a, b) => a - b);
    assert.ok(ids.length > 0);
    assert.deepEqual(dataset.allRecs.map((rec) => rec.id), ids);
    assert.equal(Object.keys(dataset.nameLookup).length, ids.length);
    for (const rec of dataset.allRecs) {
      assert.equal(dataset.nameLookup[rec.id], rec.name_ja);
      assert.ok(rec.profile5);
      assert.equal(rec.transferCandidates.source_id, rec.id);
    }
    assert.equal(dataset.allRecs.find((rec) => rec.id === 111)?.ai_risk,
      graph.occupations.get(asOccupationId(111))?.aiRisk?.score);
  });

  test('serializes ranking hits and caps cross-sector same-risk neighbors at five', () => {
    const byId = new Map(dataset.allRecs.map((rec) => [rec.id, rec]));
    assert.ok(dataset.rankingHitsArr.length > 0);
    for (const [id, hits] of dataset.rankingHitsArr) {
      assert.ok(byId.has(id));
      assert.ok(hits.length > 0);
      for (const hit of hits) {
        assert.deepEqual(Object.keys(hit).sort(), ['rank', 'slug']);
        assert.ok(hit.slug.length > 0);
        assert.ok(Number.isInteger(hit.rank) && hit.rank >= 1);
      }
    }
    assert.ok(dataset.sameRiskArr.some(([, neighbors]) => neighbors.length === 5));
    for (const [id, neighbors] of dataset.sameRiskArr) {
      const focus = byId.get(id)!;
      assert.ok(focus);
      assert.ok(neighbors.length <= 5);
      assert.equal(new Set(neighbors.map((neighbor) => neighbor.id)).size, neighbors.length);
      for (const neighbor of neighbors) {
        assert.notEqual(neighbor.id, id);
        assert.ok(byId.has(neighbor.id));
        assert.notEqual(neighbor.sector_id, focus.sector?.id);
        assert.ok(Math.abs(neighbor.ai_risk! - focus.ai_risk!) <= 1);
      }
    }
    assert.deepEqual(JSON.parse(JSON.stringify(dataset.rankingHitsArr)), dataset.rankingHitsArr);
    assert.deepEqual(JSON.parse(JSON.stringify(dataset.sameRiskArr)), dataset.sameRiskArr);
  });

  test('default score history matches the generated public projection', () => {
    const history = JSON.parse(readFileSync(join(process.cwd(), 'public/data.score_history.json'), 'utf-8'));
    assert.deepEqual(Object.fromEntries(dataset.scoreHistoryArr), history);
    assert.ok(dataset.scoreHistoryArr.every(([id]) => Number.isInteger(id)));
  });

  test('injects only the score-history path and preserves modern and legacy entries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'occupation-history-'));
    dirs.push(dir);
    const dims = { d1: 6, d2: 6, d3: 4, d4: 4, d5: 4, d6: 4, d7: 4, d8: 4, d9: 4, d10: 4 };
    const modern = { model: 'fixture', date: '2026-01-02', transformation: 6, displacement: 2, dims };
    const legacy = { model: 'legacy', date: '2026-01-01', transformation: 5, displacement: null, dims: null };
    writeFileSync(join(dir, 'data.score_history.json'), JSON.stringify({ '111': [modern, legacy], '7': [legacy] }));
    const injected = await buildOccupationPageData(dir);
    assert.deepEqual(injected.scoreHistoryArr, [[7, [legacy]], [111, [modern, legacy]]]);
    assert.deepEqual(injected.allRecs, dataset.allRecs);
    assert.deepEqual(injected.nameLookup, dataset.nameLookup);
    assert.deepEqual(injected.rankingHitsArr, dataset.rankingHitsArr);
    assert.deepEqual(injected.sameRiskArr, dataset.sameRiskArr);
    assert.notDeepEqual(injected.scoreHistoryArr, dataset.scoreHistoryArr);
  });

  test('fails rather than silently dropping a missing injected score-history projection', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'occupation-history-missing-'));
    dirs.push(dir);
    await assert.rejects(buildOccupationPageData(dir), /projection-loaders.score-history.*read failed/);
  });

  test('reconstructs serialized maps and selects the focus occupation neighbors and rankings', async () => {
    const rec = dataset.allRecs.find((row) => row.id === 111)!;
    const neighbor = { id: 7, name_ja: 'Fixture <neighbor>', ai_risk: 5,
      sector_id: 'fixture', sector_ja: 'Fixture', workers: 100 };
    const views = await buildOccupationSpokeViews(rec,
      [[111, [{ slug: 'high-risk', rank: 2 }]], [7, [{ slug: 'salary', rank: 1 }]]],
      [[111, [neighbor]], [7, [{ ...neighbor, id: 999 }]]], graph);
    assert.match(views.sameRiskHtml, /class="same-risk-neighbors"/);
    assert.match(views.sameRiskHtml, /href="\/7"/);
    assert.match(views.sameRiskHtml, /Fixture &lt;neighbor&gt;/);
    assert.doesNotMatch(views.sameRiskHtml, /href="\/999"/);
    assert.match(views.relatedHubsHtml, /class="related-hubs"/);
    assert.match(views.relatedHubsHtml, /href="\/rankings\/high-risk"/);
    assert.doesNotMatch(views.relatedHubsHtml, /href="\/rankings\/salary"/);
  });

  test('derives the top two RIASEC interest links from graph edges', async () => {
    const rec = dataset.allRecs.find((row) => row.id === 111)!;
    const interestsGraph: KnowledgeGraph = { ...graph, interestsOf: (id) => [
      { from: id, to: asInterestId('social'), weight: 8 },
      { from: id, to: asInterestId('realistic'), weight: 7 },
      { from: id, to: asInterestId('artistic'), weight: 6 },
    ] };
    const views = await buildOccupationSpokeViews(rec, [], [], interestsGraph);
    assert.equal(views.sameRiskHtml, '');
    assert.match(views.relatedHubsHtml, /href="\/interests\/social"/);
    assert.match(views.relatedHubsHtml, /href="\/interests\/realistic"/);
    assert.doesNotMatch(views.relatedHubsHtml, /href="\/interests\/artistic"/);
  });

  test('omits interest links for missing edges and returns empty spoke views for an unknown record', async () => {
    const rec = dataset.allRecs.find((row) => row.id === 111)!;
    const noInterests: KnowledgeGraph = { ...graph, interestsOf: () => [] };
    const views = await buildOccupationSpokeViews(rec, [], [], noInterests);
    assert.equal(views.sameRiskHtml, '');
    assert.doesNotMatch(views.relatedHubsHtml, /href="\/interests\//);
    const unknown = await buildOccupationSpokeViews(fakeRec(999999, null), [], [], graph);
    assert.deepEqual(unknown, { sameRiskHtml: '', relatedHubsHtml: '' });
  });
});
