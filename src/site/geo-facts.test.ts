import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGeoSurfaces } from './geo-build.js';
import {
  compareAiImpactDesc,
  computeGeoFacts,
  pickLatestGeoScoreRun,
  summarizeGeoOccupationIds,
  type GeoAttribution,
  type GeoScoreEntry,
  type GeoScoreRunLike,
  type GeoTreemapRow,
} from './geo-facts.js';
import { renderHomeJsonLd, renderLlmsFullTxt, renderLlmsTxt } from './geo-render.js';

const attribution: GeoAttribution = {
  modelId: 'claude-fable-5',
  modelDisplay: 'Claude Fable 5',
  runDate: '2026-06-13',
  standardLabel: 'AIOIS-10',
};

const rows: GeoTreemapRow[] = [
  { id: 1, name_ja: 'A', salary: 410, ai_risk: 1.5, workers: 100, recruit_ratio: 1.1, demand_band: 'normal', sector_id: 's1', sector_ja: 'Sector 1' },
  { id: 2, name_ja: 'B', salary: 520, ai_risk: 4.0, workers: 300, recruit_ratio: 1.8, demand_band: 'normal', sector_id: 's1', sector_ja: 'Sector 1' },
  { id: 3, name_ja: 'C', salary: 610, ai_risk: 7.0, workers: 600, recruit_ratio: 2.4, demand_band: 'hot', sector_id: 's2', sector_ja: 'Sector 2' },
  { id: 4, name_ja: 'D', salary: 700, ai_risk: 9.2, workers: 1000, recruit_ratio: 3.2, demand_band: 'hot', sector_id: 's2', sector_ja: 'Sector 2' },
];

const scores = new Map<number, GeoScoreEntry>([
  [1, { ai_risk: 1.5, aiois: { displacement: 0.5 } }],
  [2, { ai_risk: 4.0, aiois: { displacement: 1.0 } }],
  [3, { ai_risk: 7.0, aiois: { displacement: 3.0 } }],
  [4, { ai_risk: 9.2, aiois: { displacement: 8.0 } }],
]);

describe('computeGeoFacts', () => {
  test('uses workforce then occupation id as deterministic risk tie-breakers', () => {
    const tied: GeoTreemapRow[] = [
      { id: 3, name_ja: 'C', ai_risk: 7, workers: 100, sector_id: null, sector_ja: null },
      { id: 2, name_ja: 'B', ai_risk: 7, workers: 200, sector_id: null, sector_ja: null },
      { id: 1, name_ja: 'A', ai_risk: 7, workers: 200, sector_id: null, sector_ja: null },
    ];

    assert.deepEqual(tied.sort(compareAiImpactDesc).map((row) => row.id), [1, 2, 3]);
  });

  test('computes means, risk bands, workforce share, and top/bottom rows', () => {
    const facts = computeGeoFacts(rows, scores, attribution);

    assert.equal(facts.occupationCount, 4);
    assert.equal(facts.totalWorkforce, 2000);
    assert.equal(facts.meanAiImpact, 5.42);
    assert.equal(facts.medianAiImpact, 5.5);
    assert.equal(facts.meanDisplacementRisk, 3.12);
    assert.deepEqual(
      facts.fiveBandDistribution.map((b) => [b.key, b.count]),
      [['0-2', 1], ['3-4', 1], ['5-6', 0], ['7-8', 1], ['9-10', 1]],
    );
    assert.equal(facts.lowRiskCount, 1);
    assert.equal(facts.midRiskCount, 1);
    assert.equal(facts.highRiskCount, 2);
    assert.equal(facts.highRiskWorkforce, 1600);
    assert.equal(facts.highRiskWorkforceSharePct, 80);
    assert.equal(facts.highestImpactOccupation.nameJa, 'D');
    assert.equal(facts.lowestImpactOccupation.nameJa, 'A');
    assert.equal(facts.largestOccupation.nameJa, 'D');
    assert.equal(facts.occupations.length, 4);
    assert.deepEqual(facts.occupations.map((occupation) => occupation.id), [1, 2, 3, 4]);
    assert.deepEqual(facts.occupations.map((occupation) => occupation.aiImpactRank), [4, 3, 2, 1]);
    assert.equal(facts.occupations[0]!.salaryMan, 410);
    assert.equal(facts.occupations[0]!.recruitRatio, 1.1);
    assert.equal(facts.occupations[0]!.demandBand, 'normal');
    assert.equal(facts.sectorsByMeanImpact[0]!.id, 's2');
  });

  test('summarizes a page occupation subset from GeoFacts using the same rounding', () => {
    const facts = computeGeoFacts(rows, scores, attribution);
    const summary = summarizeGeoOccupationIds(facts, [3, 4, 4, 1]);

    assert.equal(summary.occupationCount, 3);
    assert.equal(summary.totalWorkforce, 1700);
    assert.equal(summary.meanAiImpact, 5.9);
    assert.equal(summary.firstOccupation?.nameJa, 'C');
    assert.equal(summary.highestImpactOccupation?.nameJa, 'D');
    assert.equal(summary.lowestImpactOccupation?.nameJa, 'A');
    assert.equal(summary.largestOccupation?.nameJa, 'D');
  });

  test('fails when the active score batch lacks displacement for a row', () => {
    const incomplete = new Map(scores);
    incomplete.set(1, { ai_risk: 1.5 });
    assert.throws(() => computeGeoFacts(rows, incomplete, attribution), /expected displacement/);
  });
});

describe('pickLatestGeoScoreRun', () => {
  const run = (date: string, model: string, aiois: boolean): GeoScoreRunLike => ({
    scope: 'occupations',
    scorer: { model },
    run: { run_date: date },
    scores: { '1': { ai_risk: 1, aiois: aiois ? { displacement: 0.5 } : null } },
  });

  test('picks latest run_date and prefers AIOIS on same date', () => {
    const picked = pickLatestGeoScoreRun([
      run('2026-06-01', 'old', true),
      run('2026-06-13', 'legacy-same-date', false),
      run('2026-06-13', 'aiois-same-date', true),
    ]);
    assert.equal(picked.scorer.model, 'aiois-same-date');
  });

  test('keeps later input-order batch when same-date entries both carry AIOIS', () => {
    const picked = pickLatestGeoScoreRun([
      run('2026-06-13', 'aiois-first', true),
      run('2026-06-13', 'aiois-second', true),
    ]);
    assert.equal(picked.scorer.model, 'aiois-second');
  });
});

describe('geo renderers', () => {
  test('llms surfaces and JSON-LD render active attribution and no placeholders', () => {
    const facts = computeGeoFacts(rows, scores, attribution);
    const llms = renderLlmsTxt(facts);
    const llmsFull = renderLlmsFullTxt(facts);
    const jsonld = renderHomeJsonLd(facts);

    assert.match(llms, /Claude Fable 5/);
    assert.match(llms, /2026-06-13/);
    assert.doesNotMatch(llms, /__SCORE_/);
    for (const [name, rendered] of [['llms.txt', llms], ['llms-full.txt', llmsFull]] as const) {
      assert.match(rendered, /detail IDs are zero-padded to four digits/, name);
      assert.match(rendered, /https:\/\/mirai-shigoto\.com\/data\.detail\/0001\.json/, name);
      assert.doesNotMatch(rendered, /data\.detail\/(?:<id>|\{id\})\.json/i, name);
    }

    const parsed = JSON.parse(jsonld) as { '@graph': Array<{ '@type': string; dateModified?: string }> };
    assert.equal(parsed['@graph'].find((n) => n['@type'] === 'WebSite')!.dateModified, '2026-06-13');
    assert.doesNotMatch(jsonld, /__SCORE_/);
  });
});

describe('buildGeoSurfaces', () => {
  test('simulated re-score writes GEO surfaces with the active run attribution', async () => {
    const distRoot = await mkdtemp(join(tmpdir(), 'geo-surfaces-dist-'));
    const repoRoot = await mkdtemp(join(tmpdir(), 'geo-surfaces-repo-'));
    try {
      await mkdir(join(repoRoot, 'src', 'pages'), { recursive: true });
      await writeFile(join(distRoot, 'data.treemap.json'), JSON.stringify(rows), 'utf-8');

      const fakeRun: GeoScoreRunLike = {
        scope: 'occupations',
        scorer: { model: 'claude-next-6' },
        run: { run_date: '2026-07-01' },
        scores: Object.fromEntries(scores.entries()),
      };
      await buildGeoSurfaces(
        { runsByModel: new Map([['claude-next-6', [fakeRun]]]) } as unknown as Parameters<typeof buildGeoSurfaces>[0],
        distRoot,
        repoRoot,
      );

      const llms = await readFile(join(distRoot, 'llms.txt'), 'utf-8');
      const jsonld = await readFile(join(repoRoot, 'src', 'pages', '_index-json-ld.json'), 'utf-8');
      assert.match(llms, /Claude Next 6/);
      assert.match(llms, /2026-07-01/);
      assert.doesNotMatch(llms, /Claude Fable 5/);
      assert.match(jsonld, /claude-next-6:2026-07-01/);
    } finally {
      await rm(distRoot, { recursive: true, force: true });
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
