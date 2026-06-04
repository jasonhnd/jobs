/**
 * ai-fact-summary.test.ts — pin the citable fact block (Phase 1).
 * The phrasing is part of the SEO copy contract; these tests + the SEO
 * baseline diff guard against silent drift.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildAiFactSummary, type AiFactInput } from './ai-fact-summary.js';
import type { Aiois10 } from '../graph/types.js';

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

  test('workers below 1万 → 千人 fallback', () => {
    assert.ok(buildAiFactSummary({ ...base, workers: 2950 }).includes('就業者は約3千人'));
  });

  test('always ends with the source attribution', () => {
    assert.ok(
      buildAiFactSummary(base).endsWith(
        '（出典：厚生労働省 jobtag ＋ AIOIS-10、Claude Opus 4.8、2026年5月）',
      ),
    );
  });

  test('null salary/workers clauses are omitted, not rendered as —', () => {
    const s = buildAiFactSummary({ ...base, salaryMan: null, workers: null });
    assert.ok(!s.includes('年収中央値'), s);
    assert.ok(!s.includes('就業者'), s);
  });
});
