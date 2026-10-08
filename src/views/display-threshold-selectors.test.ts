/**
 * display-threshold-selectors.test.ts — hub, Q&A, answer and escape-route
 * selectors judge AI-impact thresholds on the DISPLAYED value (#864).
 *
 * A three-vendor mean of 4.0333… prints 4.0, so it passes "≤ 4"; 6.9666…
 * prints 7.0, so it passes "≥ 7". Sort keys may keep the raw mean.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { highAi, lowAi } from './qa-items/predicates.js';
import { getGeoAnswerTopicConfig } from './geo-answer-topics.js';
import { suggestEscapeRoutes } from './escape-routes.js';
import { CAREER_PERSONAS } from './careers-meta.js';
import type { DetailFileMin } from './genre-hub.js';
import type { GeoOccupationSummary } from '../site/geo-facts.js';
import type { Occupation } from './ranking/config.js';

const detail = (score: number | null, extra: Partial<DetailFileMin> = {}): DetailFileMin =>
  ({ id: 1, ai_risk: score === null ? null : { score }, stats: { workers: 1000 }, ...extra }) as DetailFileMin;

describe('Q&A predicates (#864)', () => {
  test('lowAi takes every mean that prints 4.0 or less', () => {
    assert.notEqual(lowAi(detail(4.033333333333333)), null); // prints 4.0
    assert.equal(lowAi(detail(4.066666666666666)), null); // prints 4.1
    assert.equal(lowAi(detail(null)), null);
  });
  test('highAi takes every mean that prints 7.0 or more', () => {
    assert.notEqual(highAi(detail(6.966666666666667)), null); // prints 7.0
    assert.equal(highAi(detail(6.933333333333334)), null); // prints 6.9
  });
});

describe('/answers/nenshu-ai-anzen (#864)', () => {
  test('「AI影響度4.0未満」 keeps a mean that prints 3.9 and drops 4.0', () => {
    const config = getGeoAnswerTopicConfig('nenshu-ai-anzen')!;
    const occ = (aiImpact: number): GeoOccupationSummary => ({
      id: 1, nameJa: '弁護士', aiImpact, aiImpactRank: 1, displacementRisk: null,
      salaryMan: 765.3, workers: 1000, recruitRatio: null, demandBand: null, sectorJa: '士業',
    });
    assert.equal(config.selector(occ(3.933333333333333)), true); // prints 3.9
    assert.equal(config.selector(occ(3.966666666666666)), false); // prints 4.0
    assert.equal(config.selector(occ(5.033333333333333)), false); // prints 5.0, old cut
  });
});

describe('escape routes (#864)', () => {
  const job = (id: number, ai_risk: number): Occupation => ({
    id, title_ja: `job-${id}`, ai_risk, risk_band: null, workers: 1000, salary: null,
    monthly_hours: null, average_age: null, recruit_wage: null, recruit_ratio: null,
    demand_band: null, sector_id: 'x', sector_ja: 'X', education_pct: null,
    employment_type: null, certs: [], hourly_wage: null,
  });
  test('「AI 影響度 4 以下」 and 「AI 影響度が低い職業」 follow the printed value', () => {
    const routes = suggestEscapeRoutes({ id: 99, ai_risk: 8, sector_id: 'other' }, [
      job(1, 4.033333333333333), // prints 4.0 → in
      job(2, 4.066666666666666), // prints 4.1 → out
      job(3, 3.033333333333333), // prints 3.0 → 低い
    ]);
    assert.deepEqual(routes.map((r) => r.id).sort(), [1, 3]);
    assert.equal(routes.find((r) => r.id === 3)!.reason, 'AI 影響度が低い職業');
    assert.equal(routes.find((r) => r.id === 1)!.reason, '関連分野');
  });
});

describe('career personas (#864)', () => {
  test('an "AI ≤ 4" persona keeps a mean that prints 4.0', () => {
    // 40s persona: age 40-55, AI ≤ 4
    const persona = CAREER_PERSONAS.find((p) => p.slug === '40s')!;
    const d = (score: number) => detail(score, { stats: { average_age: 45, workers: 50_000, salary_man_yen: 500 } } as Partial<DetailFileMin>);
    assert.notEqual(persona.recommend(d(4.033333333333333)), null);
    assert.equal(persona.recommend(d(4.066666666666666)), null);
  });
});

describe('no selector keeps a raw-mean AI threshold (#864)', () => {
  const FILES = [
    'careers-meta.ts',
    'genre-configs/entry-paths.ts',
    'genre-configs/education.ts',
    'genre-configs/life-balance.ts',
    'qa-items/predicates.ts',
    'qa-items/career.ts',
    'qa-items/ai-anxiety.ts',
    'qa-items/ai-anxiety-extra.ts',
    'qa-items/aptitude-extra.ts',
    'qa-items/life.ts',
  ];
  test('every `ai` comparison goes through displayScore', () => {
    for (const file of FILES) {
      const source = readFileSync(join(import.meta.dirname, file), 'utf8');
      assert.doesNotMatch(source, /(?<![\w.]|displayScore\()ai\s*[<>]=?\s*\d/, file);
    }
  });
});
