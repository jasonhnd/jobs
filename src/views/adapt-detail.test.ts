// Tests for adapt-detail.ts — pins the shape of `Rec` that downstream
// renderers (src/pages/ja/[id].astro and the spoke graphs) depend on.
// If a field is dropped or its default changes, this test fails before
// the build does.

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { adaptDetailFile } from './adapt-detail.js';

describe('adaptDetailFile', () => {
  test('happy-path mapping with all fields populated', () => {
    const got = adaptDetailFile({
      id: 42,
      title: { ja: '看護師', aliases_ja: ['ナース'] },
      description: {
        summary_ja: 'desc',
        what_it_is_ja: 'what',
        how_to_become_ja: 'how',
        working_conditions_ja: 'cond',
      },
      ai_risk: {
        score: 3,
        model: 'claude',
        scored_at: '2026-01-01',
        rationale_ja: 'short',
        rationale_long_ja: 'long',
        displaceable_tasks_ja: ['a'],
        resilient_tasks_ja: ['b'],
        horizon_5y_ja: 'forecast',
      },
      stats: {
        salary_man_yen: 500,
        workers: 1000000,
        monthly_hours: 160,
        average_age: 38.5,
        recruit_wage_man_yen: 25,
        recruit_ratio: 1.2,
      },
      sector: { id: 'iryo', ja: '医療' },
      risk_band: 'low',
      workforce_band: 'huge',
      demand_band: 'hot',
      classifications: { l1: 'A' },
      skills_top10: [{ key: 'k', label_ja: 'L', score: 5 }],
      knowledge_top5: [],
      abilities_top5: [],
      tasks_count: 30,
      tasks_lead_ja: 'lead',
      related_orgs: [{ name_ja: 'org', url: 'https://example.com' }],
      related_certs_ja: ['cert'],
      url: 'https://example.com/x',
      data_source_versions: { ipd_numeric: '1.0' },
    });

    assert.equal(got.id, 42);
    assert.equal(got.name_ja, '看護師');
    assert.equal(got.salary, 500);
    assert.equal(got.workers, 1000000);
    assert.equal(got.ai_risk, 3);
    assert.equal(got.ai_rationale_long_ja, 'long');
    assert.deepEqual(got.aliases_ja, ['ナース']);
    assert.equal(got.sector?.id, 'iryo');
    assert.equal(got.url, 'https://example.com/x');
  });

  test('absent title.ja becomes empty string (does not become null)', () => {
    const got = adaptDetailFile({ id: 1 });
    assert.equal(got.name_ja, '');
  });

  test('absent stats / ai_risk default to null per-field', () => {
    const got = adaptDetailFile({ id: 1 });
    assert.equal(got.salary, null);
    assert.equal(got.workers, null);
    assert.equal(got.ai_risk, null);
    assert.equal(got.ai_rationale_ja, null);
  });

  test('absent top-N lists default to empty arrays (not null)', () => {
    const got = adaptDetailFile({ id: 1 });
    assert.deepEqual(got.skills_top10, []);
    assert.deepEqual(got.knowledge_top5, []);
    assert.deepEqual(got.abilities_top5, []);
    assert.deepEqual(got.related_orgs, []);
    assert.deepEqual(got.related_certs_ja, []);
    assert.deepEqual(got.ai_displaceable_tasks_ja, []);
    assert.deepEqual(got.ai_resilient_tasks_ja, []);
  });

  test('url falls back to mhlw jobtag when source omits it', () => {
    const got = adaptDetailFile({ id: 7 });
    assert.equal(got.url, 'https://shigoto.mhlw.go.jp/User/Occupation/Detail/7');
  });

  test('hourly_wage is always null (computed downstream from recruit_wage)', () => {
    const got = adaptDetailFile({
      id: 1,
      stats: { hourly_wage: 9999, recruit_wage_man_yen: 25 },
    });
    assert.equal(got.hourly_wage, null);
    assert.equal(got.recruit_wage, 25);
  });
});
