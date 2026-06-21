import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGeoSurfaces } from './geo-build.js';
import {
  computeGeoFacts,
  pickLatestGeoScoreRun,
  type GeoAttribution,
  type GeoScoreEntry,
  type GeoScoreRunLike,
  type GeoTreemapRow,
} from './geo-facts.js';
import { renderHomeJsonLd, renderLlmsTxt } from './geo-render.js';

const attribution: GeoAttribution = {
  modelId: 'claude-fable-5',
  modelDisplay: 'Claude Fable 5',
  runDate: '2026-06-13',
  standardLabel: 'AIOIS-10',
};

const rows: GeoTreemapRow[] = [
  { id: 1, name_ja: 'A', ai_risk: 1.5, workers: 100, sector_id: 's1', sector_ja: 'Sector 1' },
  { id: 2, name_ja: 'B', ai_risk: 4.0, workers: 300, sector_id: 's1', sector_ja: 'Sector 1' },
  { id: 3, name_ja: 'C', ai_risk: 7.0, workers: 600, sector_id: 's2', sector_ja: 'Sector 2' },
  { id: 4, name_ja: 'D', ai_risk: 9.2, workers: 1000, sector_id: 's2', sector_ja: 'Sector 2' },
];

const scores = new Map<number, GeoScoreEntry>([
  [1, { ai_risk: 1.5, aiois: { displacement: 0.5 } }],
  [2, { ai_risk: 4.0, aiois: { displacement: 1.0 } }],
  [3, { ai_risk: 7.0, aiois: { displacement: 3.0 } }],
  [4, { ai_risk: 9.2, aiois: { displacement: 8.0 } }],
]);

describe('computeGeoFacts', () => {
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
    assert.equal(facts.sectorsByMeanImpact[0]!.id, 's2');
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
});

describe('geo renderers', () => {
  test('llms and JSON-LD render active attribution and no placeholders', () => {
    const facts = computeGeoFacts(rows, scores, attribution);
    const llms = renderLlmsTxt(facts);
    const jsonld = renderHomeJsonLd(facts);

    assert.match(llms, /Claude Fable 5/);
    assert.match(llms, /2026-06-13/);
    assert.doesNotMatch(llms, /__SCORE_/);

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
