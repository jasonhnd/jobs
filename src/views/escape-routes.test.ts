import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderEscapeRouteSection, suggestEscapeRoutes, type EscapeRouteSource } from './escape-routes.js';
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

  test('caps worker weighting, defaults missing fields, and keeps inputs unchanged', () => {
    const jobs = [
      makeOccupation({ id: 2, workers: 500_000, title_ja: null, sector_ja: undefined }),
      makeOccupation({ id: 3, workers: 1_000_000 }),
      makeOccupation({ id: 4, workers: null }),
    ];
    const before = structuredClone(jobs);
    const source = { id: 1, ai_risk: 8, sector_id: 'other' };
    const routes = suggestEscapeRoutes(source, jobs);
    assert.deepEqual(routes.map((r) => r.id), [2, 3, 4]);
    assert.deepEqual(routes[0], {
      id: 2, nameJa: '#2', aiRisk: 4, sectorJa: '', reason: '同セクター',
    });
    assert.ok(routes.every((r) => !('score' in r)));
    assert.deepEqual(jobs, before);
    assert.deepEqual(suggestEscapeRoutes(source, jobs, 1), routes.slice(0, 1));
    assert.deepEqual(suggestEscapeRoutes(source, jobs, 0), []);
  });

  test('defaults to six candidates and returns none when all jobs are ineligible', () => {
    const source = { id: 1, ai_risk: 9, sector_id: 'it' };
    const jobs = Array.from({ length: 8 }, (_, i) => makeOccupation({ id: i + 2 }));
    assert.deepEqual(suggestEscapeRoutes(source, jobs).map((r) => r.id), [2, 3, 4, 5, 6, 7]);
    assert.deepEqual(suggestEscapeRoutes(source, [
      makeOccupation({ id: 1 }),
      makeOccupation({ id: 2, ai_risk: null }),
      makeOccupation({ id: 3, ai_risk: 4.1 }), // 4.01 prints 4.0 and is eligible (#864)
    ]), []);
  });
});

describe('renderEscapeRouteSection', () => {
  test('omits the entire section for empty candidates', () => {
    assert.equal(renderEscapeRouteSection('source', []), '');
  });

  test('renders ordered cards, canonical URLs, rounded risks, and optional sectors safely', () => {
    const raw = `<tag>&"'`;
    const escaped = '&lt;tag&gt;&amp;&quot;&#39;';
    const html = renderEscapeRouteSection(raw, [
      { id: 404, nameJa: raw, aiRisk: 3.14159, sectorJa: raw, reason: raw },
      { id: 156, nameJa: 'second', aiRisk: 4, sectorJa: '', reason: 'reason' },
    ]);
    assert.ok(html.startsWith('<section class="escape-routes" aria-labelledby="escape-h2">'));
    assert.match(html, /<h2 id="escape-h2">/);
    assert.match(html, /<ul class="escape-cards">/);
    assert.equal((html.match(/<li class="escape-card">/g) ?? []).length, 2);
    assert.ok(html.indexOf('href="/occupations/404"') < html.indexOf('href="/156"'));
    assert.ok(html.includes(`<span class="ec-name">${escaped}</span>`));
    assert.ok(html.includes(`<span class="ec-sector">${escaped}</span>`));
    assert.ok(html.includes(`<span class="ec-reason">${escaped}</span>`));
    assert.ok(html.includes(`「${escaped}」`));
    assert.equal((html.match(/class="ec-sector"/g) ?? []).length, 1);
    assert.match(html, /class="risk-pill low">AI 3\.1\/10 変化 小さい<\/span>/);
    // 4.0 is mid on the site rule (#864); the pill was hard-coded low.
    assert.match(html, /class="risk-pill mid">AI 4\/10 変化 中くらい<\/span>/);
    assert.ok(!html.includes(raw));
    assert.ok(html.endsWith('</ul></section>'));
  });
});
