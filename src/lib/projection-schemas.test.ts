/**
 * projection-schemas.test.ts — pin the runtime contract of the 6
 * projection schemas. Schemas are intentionally LIBERAL (passthrough
 * + nullish on most fields) so the ETL can add fields without
 * forcing a lockstep schema bump; tests assert the *required* fields
 * + *type contracts* the consumers depend on.
 *
 * Tests use `safeParse` so a failure surfaces as `success: false`
 * with `error.issues` available for assertion — no try/catch
 * boilerplate.
 *
 * Each schema gets:
 *   - 1 happy-path test (minimal valid input)
 *   - 1-2 rejection tests (missing-required / wrong-type)
 *   - 1 passthrough test (extra fields tolerated)
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  DetailFileSchema,
  SectorsProjectionSchema,
  SectorsSourceFileSchema,
  SkillRankingFileSchema,
  HollandFileSchema,
  ScoreHistoryProjectionSchema,
  TreemapRecordSummarySchema,
  TreemapFileSummarySchema,
} from './projection-schemas.js';

describe('DetailFileSchema — per-occupation /data.detail/<id>.json', () => {
  test('minimum valid: just `id` is required', () => {
    const r = DetailFileSchema.safeParse({ id: 156 });
    assert.equal(r.success, true);
  });

  test('all optional fields can be missing', () => {
    const r = DetailFileSchema.safeParse({ id: 156 });
    assert.equal(r.success, true);
  });

  test('id must be an integer (rejects 3.14)', () => {
    const r = DetailFileSchema.safeParse({ id: 3.14 });
    assert.equal(r.success, false);
  });

  test('id must be a number (rejects "156" string)', () => {
    const r = DetailFileSchema.safeParse({ id: '156' });
    assert.equal(r.success, false);
  });

  test('passthrough tolerates unknown fields', () => {
    const r = DetailFileSchema.safeParse({
      id: 156,
      unknown_future_field: { anything: 'goes' },
    });
    assert.equal(r.success, true);
  });

  test('nested ai_risk shape: score nullable, accepts null', () => {
    const r = DetailFileSchema.safeParse({
      id: 156,
      ai_risk: { score: null, rationale_ja: null },
    });
    assert.equal(r.success, true);
  });

  test('stats fields all nullish — empty stats object passes', () => {
    const r = DetailFileSchema.safeParse({ id: 156, stats: {} });
    assert.equal(r.success, true);
  });

  test('full realistic example parses cleanly', () => {
    const r = DetailFileSchema.safeParse({
      id: 156,
      title: { ja: '看護師' },
      ai_risk: { score: 4, rationale_ja: '身体ケア+判断' },
      risk_band: 'mid',
      description: { summary_ja: '医療現場で…' },
      stats: { salary_man_yen: 519, workers: 692_975 },
      sector: { id: 'iryo', ja: '医療' },
    });
    assert.equal(r.success, true);
  });
});

describe('SectorsProjectionSchema — public/data.sectors.json', () => {
  test('minimum valid: sectors is an empty array', () => {
    const r = SectorsProjectionSchema.safeParse({ sectors: [] });
    assert.equal(r.success, true);
  });

  test('happy path with one full sector record', () => {
    const r = SectorsProjectionSchema.safeParse({
      sectors: [
        {
          id: 'iryo',
          ja: '医療',
          hue: 'mid',
          occupation_count: 30,
          mean_ai_risk: 4.5,
          total_workforce: 1_500_000,
          sample_titles_ja: ['看護師', '医師'],
        },
      ],
    });
    assert.equal(r.success, true);
  });

  test('missing sectors array → fail', () => {
    const r = SectorsProjectionSchema.safeParse({});
    assert.equal(r.success, false);
  });

  test('sector hue must be enum: safe | mid | warm', () => {
    const r = SectorsProjectionSchema.safeParse({
      sectors: [
        {
          id: 'iryo',
          ja: '医療',
          hue: 'INVALID_HUE',
          occupation_count: 30,
          mean_ai_risk: 4.5,
          total_workforce: 1_500_000,
        },
      ],
    });
    assert.equal(r.success, false);
  });

  test('sample_titles_ja is optional (can be omitted)', () => {
    const r = SectorsProjectionSchema.safeParse({
      sectors: [
        {
          id: 'iryo',
          ja: '医療',
          hue: 'mid',
          occupation_count: 30,
          mean_ai_risk: 4.5,
          total_workforce: 1_500_000,
        },
      ],
    });
    assert.equal(r.success, true);
  });
});

describe('SectorsSourceFileSchema — source data/sectors/*.json', () => {
  test('valid SectorDef parses cleanly', () => {
    const r = SectorsSourceFileSchema.safeParse({
      sectors: [
        {
          id: 'iryo',
          ja: '医療',
          en: 'Healthcare',
          hue: 'mid',
          description_ja: 'optional desc',
          mhlw_seed_codes: ['001', '002'],
        },
      ],
    });
    assert.equal(r.success, true);
  });

  test('description_ja defaults to empty string when missing', () => {
    const r = SectorsSourceFileSchema.safeParse({
      sectors: [
        { id: 'iryo', ja: '医療', en: 'Healthcare', hue: 'mid' },
      ],
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.sectors[0]!.description_ja, '');
      assert.deepEqual(r.data.sectors[0]!.mhlw_seed_codes, []);
    }
  });

  test('hue is plain string (unlike SectorsProjectionSchema which enums it)', () => {
    // SOURCE side accepts free-form hue strings (downstream projection
    // narrows to enum). Pinning this so a future refactor doesn't
    // accidentally enum-lock the source side.
    const r = SectorsSourceFileSchema.safeParse({
      sectors: [
        { id: 'iryo', ja: '医療', en: 'Healthcare', hue: 'any-string' },
      ],
    });
    assert.equal(r.success, true);
  });
});

describe('SkillRankingFileSchema — public/data.skills/<ipdKey>.json', () => {
  test('happy path', () => {
    const r = SkillRankingFileSchema.safeParse({
      skill_key: 'critical_thinking',
      label_ja: '批判的思考',
      occupations: [{ id: 156, name_ja: '看護師', score: 4.5 }],
    });
    assert.equal(r.success, true);
  });

  test('empty occupations array allowed', () => {
    const r = SkillRankingFileSchema.safeParse({
      skill_key: 'rare_skill',
      label_ja: 'まれなスキル',
      occupations: [],
    });
    assert.equal(r.success, true);
  });

  test('missing skill_key → fail', () => {
    const r = SkillRankingFileSchema.safeParse({
      label_ja: '批判的思考',
      occupations: [],
    });
    assert.equal(r.success, false);
  });

  test('occupation id must be integer', () => {
    const r = SkillRankingFileSchema.safeParse({
      skill_key: 'x',
      label_ja: 'x',
      occupations: [{ id: 3.14, name_ja: 'x', score: 1 }],
    });
    assert.equal(r.success, false);
  });
});

describe('HollandFileSchema — public/data.holland.json', () => {
  test('valid matrix', () => {
    const r = HollandFileSchema.safeParse({
      cols: ['R', 'I', 'A', 'S', 'E', 'C'],
      rows: [[1, 2, 3, 4, 5, 6]],
    });
    assert.equal(r.success, true);
  });

  test('rows can contain numbers, strings, or null (union)', () => {
    const r = HollandFileSchema.safeParse({
      cols: ['name', 'R'],
      rows: [['看護師', 5], ['医師', null]],
    });
    assert.equal(r.success, true);
  });

  test('missing cols → fail', () => {
    const r = HollandFileSchema.safeParse({ rows: [] });
    assert.equal(r.success, false);
  });

  test('row elements must be number / string / null (rejects boolean)', () => {
    const r = HollandFileSchema.safeParse({
      cols: ['a'],
      rows: [[true]],
    });
    assert.equal(r.success, false);
  });
});

describe('ScoreHistoryProjectionSchema — public/data.score_history.json', () => {
  test('valid legacy and AIOIS history entries parse', () => {
    const r = ScoreHistoryProjectionSchema.safeParse({
      '1': [
        {
          model: 'claude-opus-4-7',
          date: '2026-04-25',
          transformation: 5.5,
          displacement: null,
          dims: null,
        },
        {
          model: 'claude-fable-5',
          date: '2026-06-13',
          transformation: 6.2,
          displacement: 3.1,
          dims: { d1: 5.2, d2: 7.2, d3: 1, d4: 2, d5: 3, d6: 4, d7: 5, d8: 6, d9: 7, d10: 4 },
        },
      ],
    });
    assert.equal(r.success, true);
  });

  test('rejects rationale_ja and other extra fields', () => {
    const r = ScoreHistoryProjectionSchema.safeParse({
      '1': [
        {
          model: 'claude-opus-4-7',
          date: '2026-04-25',
          transformation: 5.5,
          displacement: null,
          dims: null,
          rationale_ja: 'must not ship',
        },
      ],
    });
    assert.equal(r.success, false);
  });

  test('requires all ten AIOIS dimension fields', () => {
    const r = ScoreHistoryProjectionSchema.safeParse({
      '1': [
        {
          model: 'claude-fable-5',
          date: '2026-06-13',
          transformation: 6.2,
          displacement: 3.1,
          dims: { d1: 5.2, d2: 7.2, d3: 1, d4: 2, d5: 3, d6: 4, d7: 5, d8: 6, d9: 7 },
        },
      ],
    });
    assert.equal(r.success, false);
  });
});

describe('TreemapRecordSummarySchema + TreemapFileSummarySchema', () => {
  test('valid record summary parses', () => {
    const r = TreemapRecordSummarySchema.safeParse({
      id: 156,
      ai_risk: 4,
      risk_band: 'mid',
      workers: 692_975,
      salary: 519,
      sector_id: 'iryo',
      sector_ja: '医療',
    });
    assert.equal(r.success, true);
  });

  test('id required + integer', () => {
    const r = TreemapRecordSummarySchema.safeParse({
      ai_risk: 4,
      risk_band: 'mid',
      workers: 1,
      salary: 1,
    });
    assert.equal(r.success, false);
  });

  test('ai_risk / workers / salary explicitly nullable (not just optional)', () => {
    const r = TreemapRecordSummarySchema.safeParse({
      id: 999,
      ai_risk: null,
      risk_band: null,
      workers: null,
      salary: null,
    });
    assert.equal(r.success, true);
  });

  test('TreemapFileSummarySchema accepts an array of records', () => {
    const r = TreemapFileSummarySchema.safeParse([
      { id: 1, ai_risk: null, risk_band: null, workers: null, salary: null },
      { id: 2, ai_risk: 3, risk_band: 'low', workers: 100, salary: 400 },
    ]);
    assert.equal(r.success, true);
  });

  test('TreemapFileSummarySchema rejects non-array root', () => {
    const r = TreemapFileSummarySchema.safeParse({ id: 1, ai_risk: 1, risk_band: 'low', workers: 1, salary: 1 });
    assert.equal(r.success, false);
  });
});
