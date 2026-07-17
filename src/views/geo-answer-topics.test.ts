import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  GEO_ANSWER_TOPIC_CONFIGS,
  buildGeoAnswerTopic,
  buildGeoAnswerTopics,
  renderGeoAnswerIndexJsonLd,
} from './geo-answer-topics.js';
import type { GeoFacts, GeoOccupationSummary } from '../site/geo-facts.js';

const occ = (
  id: number,
  nameJa: string,
  aiImpact: number,
  salaryMan: number | null,
  recruitRatio: number | null,
): GeoOccupationSummary => ({
  id,
  nameJa,
  aiImpact,
  aiImpactRank: id,
  displacementRisk: 2,
  salaryMan,
  workers: id * 100,
  recruitRatio,
  demandBand: recruitRatio !== null && recruitRatio >= 2 ? 'hot' : 'normal',
  sectorJa: 'テスト',
});

const facts: GeoFacts = {
  attribution: {
    modelId: 'claude-fable-5',
    modelDisplay: 'Claude Fable 5',
    runDate: '2026-06-13',
    standardLabel: 'AIOIS-10',
  },
  predecessor: null,
  predecessorComparedCount: 0,
  occupationCount: 5,
  totalWorkforce: 1500,
  meanAiImpactRaw: 4.2,
  meanAiImpact: 4.2,
  medianAiImpact: 4,
  meanDisplacementRiskRaw: 2,
  meanDisplacementRisk: 2,
  meanAiImpactDeltaFromPredecessor: null,
  fiveBandDistribution: [],
  highImpactThreshold: 5,
  highImpactCount: 2,
  highImpactAnnualWagesTrillion: 0,
  lowRiskCount: 2,
  midRiskCount: 2,
  highRiskCount: 1,
  highRiskOccupationSharePct: 20,
  highRiskWorkforce: 500,
  highRiskWorkforceSharePct: 33.3,
  largestOccupation: occ(5, 'E', 8, 500, 2),
  highestImpactOccupation: occ(5, 'E', 8, 500, 2),
  lowestImpactOccupation: occ(1, 'A', 1, 300, 1),
  occupations: [
    occ(1, 'A', 1, 300, 1),
    occ(2, 'B', 3, 700, 4),
    occ(3, 'C', 4, 650, 3),
    occ(4, 'D', 6, 900, null),
    occ(5, 'E', 8, 500, 2),
  ],
  topImpactOccupations: [],
  bottomImpactOccupations: [],
  sectorsByMeanImpact: [],
};

describe('geo answer topics', () => {
  test('exports the three GEO-C answer topic configs', () => {
    assert.deepEqual(
      GEO_ANSWER_TOPIC_CONFIGS.map((config) => config.slug),
      ['ai-de-nakunaru-shigoto', 'nenshu-ai-anzen', 'nobiru-shigoto-top'],
    );
  });

  test('AI disappearance topic sorts by AI impact descending', () => {
    const topic = buildGeoAnswerTopic(facts, 'ai-de-nakunaru-shigoto')!;
    assert.deepEqual(topic.items.map((item) => item.nameJa), ['E', 'D', 'C', 'B', 'A']);
    const parsed = JSON.parse(topic.jsonLd) as {
      '@graph': Array<{
        '@type': string;
        numberOfItems?: number;
        url?: string;
        speakable?: { cssSelector?: string[] };
      }>;
    };
    const itemList = parsed['@graph'].find((node) => node['@type'] === 'ItemList');
    assert.equal(itemList?.numberOfItems, 5);
    const article = parsed['@graph'].find((node) => node['@type'] === 'Article');
    assert.equal(article?.url, 'https://mirai-shigoto.com/answers/ai-de-nakunaru-shigoto');
    const webPage = parsed['@graph'].find((node) => node['@type'] === 'WebPage');
    assert.deepEqual(webPage?.speakable?.cssSelector, ['.ai-fact', '.answer-lead']);
  });

  test('salary x AI safety topic filters to AI impact <= 5 and sorts by salary', () => {
    const topic = buildGeoAnswerTopic(facts, 'nenshu-ai-anzen')!;
    assert.deepEqual(topic.items.map((item) => item.nameJa), ['B', 'C', 'A']);
  });

  test('growth topic sorts by recruit ratio and omits missing ratios', () => {
    const topic = buildGeoAnswerTopic(facts, 'nobiru-shigoto-top')!;
    assert.deepEqual(topic.items.map((item) => item.nameJa), ['B', 'C', 'E', 'A']);
  });

  test('index JSON-LD points to all topic URLs', () => {
    const topics = buildGeoAnswerTopics(facts);
    assert.equal(topics.length, 3);
    const json = renderGeoAnswerIndexJsonLd(facts);
    assert.match(json, /https:\/\/mirai-shigoto\.com\/answers\/ai-de-nakunaru-shigoto/);
    assert.match(json, /https:\/\/mirai-shigoto\.com\/answers\/nenshu-ai-anzen/);
    assert.match(json, /https:\/\/mirai-shigoto\.com\/answers\/nobiru-shigoto-top/);
  });
});
