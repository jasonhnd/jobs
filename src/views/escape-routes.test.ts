import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { suggestEscapeRoutes, type EscapeRouteSource } from './escape-routes.js';
import type { Occupation } from './ranking/config.js';

function makeOccupation(overrides: Partial<Occupation>): Occupation {
  return {
    id: 1,
    title_ja: 'fixture',
    ai_risk: 4,
    risk_band: 'low',
    workers: 0,
    salary: null,
    monthly_hours: null,
    average_age: null,
    recruit_wage: null,
    recruit_ratio: null,
    demand_band: null,
    sector_id: 'other',
    sector_ja: 'その他',
    education_pct: null,
    employment_type: null,
    certs: [],
    hourly_wage: null,
    ...overrides,
  };
}

describe('suggestEscapeRoutes', () => {
  test('scores, filters, caps, and derives reasons for safe candidates', () => {
    const source: EscapeRouteSource = { id: 1, ai_risk: 8, sector_id: 'it' };
    const routes = suggestEscapeRoutes(
      source,
      [
        makeOccupation({ id: 1, title_ja: 'self', ai_risk: 2, sector_id: 'it' }),
        makeOccupation({ id: 2, title_ja: 'same sector', ai_risk: 4, sector_id: 'it', sector_ja: 'IT', workers: 100_000 }),
        makeOccupation({ id: 3, title_ja: 'low risk', ai_risk: 3, sector_id: 'care', sector_ja: '介護', workers: 200_000 }),
        makeOccupation({ id: 4, title_ja: 'related', ai_risk: 4, sector_id: 'craft', sector_ja: '技能', workers: 0 }),
        makeOccupation({ id: 5, title_ja: 'too risky', ai_risk: 5, sector_id: 'care' }),
        makeOccupation({ id: 6, title_ja: 'unknown risk', ai_risk: null, sector_id: 'care' }),
      ],
      3,
    );

    assert.deepEqual(
      routes.map((r) => [r.id, r.reason]),
      [
        [2, '同セクター'],
        [3, 'AI 影響度が低い職業'],
        [4, '関連分野'],
      ],
    );
  });

  test('uses 10 as the source risk fallback when the source risk is null', () => {
    const routes = suggestEscapeRoutes(
      { id: 10, ai_risk: null, sector_id: 'it' },
      [
        makeOccupation({ id: 20, title_ja: 'risk four', ai_risk: 4, sector_id: 'other', workers: 0 }),
        makeOccupation({ id: 30, title_ja: 'risk two', ai_risk: 2, sector_id: 'other', workers: 0 }),
      ],
    );

    assert.deepEqual(routes.map((r) => r.id), [20, 30]);
  });
});
