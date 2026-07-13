/**
 * ai-fact-summary.test.ts — pin the citable fact block (Phase 1).
 * The phrasing is part of the SEO copy contract; these tests + the SEO
 * baseline diff guard against silent drift.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildAiFactSummary,
  buildCompareGeoFactSummary,
  buildOccupationGeoFactSummary,
  buildOccupationSetGeoFactSummary,
  buildSectorGeoFactSummary,
  renderAiFactParagraph,
  type AiFactInput,
} from './ai-fact-summary.js';
import type { Aiois10 } from '../graph/types.js';
import type { GeoFacts, GeoOccupationSummary } from '../site/geo-facts.js';

const aiois = (over: Partial<Aiois10>): Aiois10 => ({
  d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6: 0, d7: 0, d8: 0, d9: 0, d10: 0,
  transformation: 0, displacement: 0, ...over,
});

const base: AiFactInput = {
  nameJa: '看護師',
  aiRisk: 4.1,
  rank: 306,
  total: 556,
  meanRisk: 4.24,
  aiois: aiois({ d4: 7.2, d5: 8.1, displacement: 1.0 }),
  salaryMan: 519,
  workers: 692975,
  scoredDate: '2026年5月',
};

const geoOcc = (
  id: number,
  nameJa: string,
  aiImpact: number,
  workers: number,
  sectorJa: string = '医療',
): GeoOccupationSummary => ({
  id,
  nameJa,
  aiImpact,
  aiImpactRank: id,
  displacementRisk: null,
  salaryMan: null,
  workers,
  recruitRatio: null,
  demandBand: null,
  sectorJa,
});

const geoFacts: GeoFacts = {
  attribution: {
    modelId: 'claude-fable-5',
    modelDisplay: 'Claude Fable 5',
    runDate: '2026-06-13',
    standardLabel: 'AIOIS-10',
  },
  occupationCount: 4,
  totalWorkforce: 2000,
  meanAiImpact: 5.42,
  medianAiImpact: 5.5,
  meanDisplacementRisk: 3.12,
  fiveBandDistribution: [],
  lowRiskCount: 1,
  midRiskCount: 1,
  highRiskCount: 2,
  highRiskOccupationSharePct: 50,
  highRiskWorkforce: 1600,
  highRiskWorkforceSharePct: 80,
  largestOccupation: geoOcc(4, 'D', 9.2, 1000, 'IT'),
  highestImpactOccupation: geoOcc(4, 'D', 9.2, 1000, 'IT'),
  lowestImpactOccupation: geoOcc(1, 'A', 1.5, 100, '医療'),
  occupations: [
    geoOcc(1, 'A', 1.5, 100, '医療'),
    geoOcc(2, 'B', 4.0, 300, '医療'),
    geoOcc(3, 'C', 7.0, 600, 'IT'),
    geoOcc(4, 'D', 9.2, 1000, 'IT'),
  ],
  topImpactOccupations: [],
  bottomImpactOccupations: [],
  sectorsByMeanImpact: [
    { id: 'it', nameJa: 'IT', occupationCount: 2, meanAiImpactRaw: 8.1, meanAiImpact: 8.1, totalWorkforce: 1600 },
    { id: 'iryo', nameJa: '医療', occupationCount: 2, meanAiImpactRaw: 2.75, meanAiImpact: 2.75, totalWorkforce: 400 },
  ],
};

describe('buildAiFactSummary', () => {
  test('unscored occupation yields empty string (block self-omits)', () => {
    assert.equal(buildAiFactSummary({ ...base, aiRisk: null }), '');
  });

  test('leads with the score, rank, and vs-mean direction', () => {
    const s = buildAiFactSummary(base);
    assert.ok(s.startsWith('看護師のAI影響度は4.1/10。'), s);
    assert.ok(s.includes('全556職業を影響度の高い順に並べると306位'), s);
    assert.ok(s.includes('全体平均（4.24）を下回る'), s);
  });

  test('above-mean uses 上回る', () => {
    const s = buildAiFactSummary({ ...base, aiRisk: 7.4, meanRisk: 4.24 });
    assert.ok(s.includes('全体平均（4.24）を上回る'), s);
  });

  test('low displacement → moat-protected narrative + cites top moat dim', () => {
    const s = buildAiFactSummary(base); // displacement 1.0, top moat d5
    assert.ok(s.includes('人とのやりとり・情緒など人間の強みが守りとなり'), s);
    assert.ok(s.includes('職そのものが大きく減るリスクは低めです（仕事が減るリスク 1.0/10）'), s);
  });

  test('mid displacement → partial-replacement narrative', () => {
    const s = buildAiFactSummary({ ...base, aiois: aiois({ d4: 6, displacement: 5.2 }) });
    assert.ok(s.includes('AIによる業務の置き換えが部分的に進む一方'), s);
    assert.ok(s.includes('（仕事が減るリスク 5.2/10）'), s);
  });

  test('high displacement → shrink-risk narrative + cites top driver dim', () => {
    const s = buildAiFactSummary({ ...base, aiois: aiois({ d2: 8.5, displacement: 7.8 }) });
    assert.ok(s.includes('定型的な手順のくり返しの比重が高く'), s);
    assert.ok(s.includes('縮小するリスクも相対的に高めです（仕事が減るリスク 7.8/10）'), s);
  });

  test('workers formatted in 万人: integer ≥10万', () => {
    assert.ok(buildAiFactSummary(base).includes('就業者は約69万人'));
  });

  test('workers 1万–10万 → one decimal 万人', () => {
    assert.ok(buildAiFactSummary({ ...base, workers: 48720 }).includes('就業者は約4.9万人'));
  });

  test('workers below 1万 → whole 千人 (rounded to nearest thousand)', () => {
    assert.ok(buildAiFactSummary({ ...base, workers: 8200 }).includes('就業者は約8千人'));
    assert.ok(buildAiFactSummary({ ...base, workers: 2950 }).includes('就業者は約3千人'));
  });

  test('always ends with the source attribution', () => {
    assert.ok(
      buildAiFactSummary(base).endsWith(
        '（出典：厚生労働省 jobtag ＋ AIOIS-10、GPT 5.6 SOL、2026年5月）',
      ),
    );
  });

  test('null salary/workers clauses are omitted, not rendered as —', () => {
    const s = buildAiFactSummary({ ...base, salaryMan: null, workers: null });
    assert.ok(!s.includes('年収中央値'), s);
    assert.ok(!s.includes('就業者'), s);
  });
});

describe('GEO page fact summaries', () => {
  test('sector summary uses precomputed sector facts and rank', () => {
    const s = buildSectorGeoFactSummary({ facts: geoFacts, sectorId: 'it' });
    assert.ok(s.includes('ITセクターは2職業、就業者1,600人、平均AI影響度8.10/10'), s);
    assert.ok(s.includes('セクター平均AI影響度順では1/2位'), s);
    assert.ok(s.endsWith('（出典：厚生労働省 jobtag ＋ AIOIS-10、Claude Fable 5、2026年6月13日）'), s);
  });

  test('occupation summary uses GEO occupation rank and page metrics', () => {
    const facts: GeoFacts = {
      ...geoFacts,
      occupations: [{
        ...geoFacts.occupations[3]!,
        aiImpactRank: 1,
        salaryMan: 720.8,
        displacementRisk: 8,
      }],
    };
    const s = buildOccupationGeoFactSummary({ facts, occupationId: 4 });
    assert.ok(s.includes('DのAI影響度は9.2/10'), s);
    assert.ok(s.includes('AI影響度の高い順では1/4位'), s);
    assert.ok(s.includes('全体平均5.42/10を上回る水準'), s);
    assert.ok(s.includes('仕事が減るリスクは8.0/10'), s);
    assert.ok(s.includes('年収中央値は約720万円'), s);
    assert.ok(s.endsWith('（出典：厚生労働省 jobtag ＋ AIOIS-10、Claude Fable 5、2026年6月13日）'), s);
  });

  test('occupation-set summary aggregates only through geo-facts helper', () => {
    const s = buildOccupationSetGeoFactSummary({
      facts: geoFacts,
      subjectJa: 'AIに強い仕事',
      pageKindJa: 'ランキング',
      occupationIds: [3, 1, 3],
    });
    assert.ok(s.includes('表示する2職業を同じ口径で集計すると、平均AI影響度は4.25/10、就業者合計は700人'), s);
    assert.ok(s.includes('先頭のCはAI影響度7.0/10'), s);
    assert.ok(s.includes('最も低いAは1.5/10'), s);
  });

  test('compare summary cites both sides, the gap, and the two-job aggregate', () => {
    const s = buildCompareGeoFactSummary({
      facts: geoFacts,
      subjectJa: 'A vs D',
      occupationIds: [1, 4],
    });
    assert.ok(s.includes('AはAI影響度1.5/10、Dは9.2/10'), s);
    assert.ok(s.includes('差は7.7ポイント'), s);
    assert.ok(s.includes('2職業の平均AI影響度は5.35/10、就業者合計は1,100人'), s);
  });

  test('compare summary handles equal scores without claiming one side is higher', () => {
    const tieFacts: GeoFacts = {
      ...geoFacts,
      occupationCount: 5,
      occupations: [...geoFacts.occupations, geoOcc(5, 'E', 4.0, 200, 'IT')],
    };
    const s = buildCompareGeoFactSummary({
      facts: tieFacts,
      subjectJa: 'B vs E',
      occupationIds: [2, 5],
    });
    assert.ok(s.includes('差は0.0ポイントで、BとEは同じAI影響度です。'), s);
    assert.ok(!s.includes('よりAI影響度が高い比較です'), s);
  });

  test('renderAiFactParagraph escapes generated text before HTML insertion', () => {
    const html = renderAiFactParagraph('A < B & C');
    assert.equal(html, '<p class="ai-fact">A &lt; B &amp; C</p>');
  });
});
