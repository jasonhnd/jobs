// Tests for scripts/assemble-scores.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { parseScoreLines, assembleBatch, inferProvider, type BatchMeta } from './assemble-scores.js';
import { ScoreRunSchema } from '../src/data/schema/score-run.js';

const META: BatchMeta = {
  model: 'claude-opus-4-8',
  modelProvider: 'anthropic',
  date: '2026-06-01',
  promptVersion: '2.0',
  promptFile: 'data/prompts/x.ja.md',
  runId: 'occ_2026-06-01_v1',
  operator: null,
  inputDataVersion: 'occupations_2026-06',
  inputDataSha256: 'abc',
  promptSha256: 'def',
  anchors: { '0-1': 'min', '10': 'max' },
  caveat: 'rough estimates',
  occupationCountScored: 1,
  occupationCountSkipped: 0,
  scoringMethod: 'single-pass per occupation',
};

// Formula-consistent AIOIS-10 fixture (docs/SCORING_RUNBOOK.md output contract):
//   E = mean(4.8, 4.4) = 4.6 = transformation = ai_risk
//   M = mean(5.0, 6.5, 5.8, 3.0, 4.2) = 4.9; P = mean(3.6, 2.8) = 3.2
//   displacement = 4.6 × (1 − 0.49) × (0.6 + 0.4 × (3.2 + 3.5)/20) ≈ 1.72 → 1.7
const BASE_AIOIS = {
  d1: 4.8, d2: 4.4, d3: 5.0, d4: 6.5, d5: 5.8, d6: 3.0, d7: 4.2, d8: 3.6, d9: 2.8, d10: 3.5,
  transformation: 4.6, displacement: 1.7,
};
const BASE = { id: 1, ai_risk: 4.6, rationale_ja: '理由', confidence: 0.8, aiois: BASE_AIOIS };

/** New object with `key` removed (no mutation of the source). */
const without = (obj: Record<string, unknown>, key: string): Record<string, unknown> => {
  const { [key]: _omit, ...rest } = obj;
  return rest;
};

const aioisLine = (top: Record<string, unknown> = {}, aiois?: Record<string, unknown>): string =>
  JSON.stringify({ ...BASE, ...top, ...(aiois !== undefined ? { aiois } : {}) });

describe('parseScoreLines (legacy mode)', () => {
  test('valid line → parsed (id, ai_risk, confidence)', () => {
    const { scores, errors } = parseScoreLines(
      ['{"id":1,"ai_risk":6.9,"rationale_ja":"理由","confidence":0.8}'],
      'legacy',
    );
    assert.equal(errors.length, 0);
    assert.equal(scores['1']!.ai_risk, 6.9);
    assert.equal(scores['1']!.rationale_ja, '理由');
    assert.equal(scores['1']!.confidence, 0.8);
  });

  test('blank lines skipped; confidence omitted → null', () => {
    const { scores, errors } = parseScoreLines(['', '  ', '{"id":2,"ai_risk":3.0,"rationale_ja":"x"}'], 'legacy');
    assert.equal(errors.length, 0);
    assert.equal(Object.keys(scores).length, 1);
    assert.equal(scores['2']!.confidence, null);
  });

  test('accepts 1-decimal incl integers (7 → ok)', () => {
    assert.equal(parseScoreLines(['{"id":1,"ai_risk":7,"rationale_ja":"x"}'], 'legacy').errors.length, 0);
  });

  test('rejects ai_risk > 10', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":11,"rationale_ja":"x"}'], 'legacy').errors.length > 0);
  });

  test('rejects 2-decimal ai_risk (6.95)', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":6.95,"rationale_ja":"x"}'], 'legacy').errors.length > 0);
  });

  test('rejects missing/empty rationale_ja', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":5.0}'], 'legacy').errors.length > 0);
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":5.0,"rationale_ja":""}'], 'legacy').errors.length > 0);
  });

  test('rejects confidence out of range', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":5.0,"rationale_ja":"x","confidence":1.5}'], 'legacy').errors.length > 0);
  });

  test('rejects bad id (0 / >999)', () => {
    assert.ok(parseScoreLines(['{"id":0,"ai_risk":5.0,"rationale_ja":"x"}'], 'legacy').errors.length > 0);
    assert.ok(parseScoreLines(['{"id":1000,"ai_risk":5.0,"rationale_ja":"x"}'], 'legacy').errors.length > 0);
  });

  test('rejects duplicate id', () => {
    const { errors } = parseScoreLines(
      ['{"id":1,"ai_risk":5.0,"rationale_ja":"x"}', '{"id":1,"ai_risk":6.0,"rationale_ja":"y"}'],
      'legacy',
    );
    assert.ok(errors.length > 0);
  });

  test('rejects an aiois-bearing line (would silently drop aiois → must use aiois mode)', () => {
    const { errors } = parseScoreLines([aioisLine()], 'legacy');
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /aiois/);
  });
});

describe('parseScoreLines (aiois mode)', () => {
  test('valid full AIOIS-10 line → parsed with aiois preserved', () => {
    const { scores, errors } = parseScoreLines([aioisLine()], 'aiois');
    assert.equal(errors.length, 0);
    const e = scores['1']!;
    assert.equal(e.ai_risk, 4.6);
    assert.equal(e.confidence, 0.8);
    assert.ok(e.aiois);
    assert.equal(e.aiois!.d7, 4.2);
    assert.equal(e.aiois!.transformation, 4.6);
    assert.equal(e.aiois!.displacement, 1.7);
  });

  test('aiois missing → error', () => {
    const { errors } = parseScoreLines([JSON.stringify(without(BASE, 'aiois'))], 'aiois');
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /aiois/);
  });

  test('aiois field missing (d7) → error', () => {
    const { errors } = parseScoreLines([aioisLine({}, without(BASE_AIOIS, 'd7'))], 'aiois');
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /d7/);
  });

  test('2-decimal aiois score (d3=5.55) → error', () => {
    const { errors } = parseScoreLines([aioisLine({}, { ...BASE_AIOIS, d3: 5.55 })], 'aiois');
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /d3/);
  });

  test('out-of-range aiois score (d2=11) → error', () => {
    assert.ok(parseScoreLines([aioisLine({}, { ...BASE_AIOIS, d2: 11 })], 'aiois').errors.length > 0);
  });

  test('numeric-string aiois score (d1="4.8") → error', () => {
    assert.ok(parseScoreLines([aioisLine({}, { ...BASE_AIOIS, d1: '4.8' })], 'aiois').errors.length > 0);
  });

  test('ai_risk !== aiois.transformation → error', () => {
    const { errors } = parseScoreLines([aioisLine({ ai_risk: 4.5 })], 'aiois');
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /transformation/);
  });

  test('transformation far from mean(d1,d2) → error', () => {
    const { errors } = parseScoreLines(
      [aioisLine({ ai_risk: 5.0 }, { ...BASE_AIOIS, transformation: 5.0 })],
      'aiois',
    );
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /mean\(d1,d2\)/);
  });

  test('transformation at exact .X5 boundary: both roundings accepted', () => {
    // mean(1.5, 5.4) = 3.45 → 3.4 (half-even) and 3.5 (half-up) both within ±0.05.
    // M = mean(5×5.0) = 5.0; P = mean(2.0, 4.0) = 3.0; d10 = 3.0
    // displacement = 3.45 × 0.5 × (0.6 + 0.4 × 6/20) = 1.242 → 1.2
    const dims = { d1: 1.5, d2: 5.4, d3: 5.0, d4: 5.0, d5: 5.0, d6: 5.0, d7: 5.0, d8: 2.0, d9: 4.0, d10: 3.0 };
    for (const t of [3.4, 3.5]) {
      const { errors } = parseScoreLines(
        [aioisLine({ id: 1, ai_risk: t }, { ...dims, transformation: t, displacement: 1.2 })],
        'aiois',
      );
      assert.equal(errors.length, 0, `t=${t}: ${errors[0] ?? ''}`);
    }
  });

  test('displacement far from formula value → error', () => {
    const { errors } = parseScoreLines([aioisLine({}, { ...BASE_AIOIS, displacement: 2.5 })], 'aiois');
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /displacement/);
  });

  test('extra aiois field (d11) → error', () => {
    assert.ok(parseScoreLines([aioisLine({}, { ...BASE_AIOIS, d11: 1.0 })], 'aiois').errors.length > 0);
  });

  test('extra top-level field → error', () => {
    assert.ok(parseScoreLines([aioisLine({ note: 'x' })], 'aiois').errors.length > 0);
  });

  test('confidence missing → error (required in aiois mode)', () => {
    const { errors } = parseScoreLines([JSON.stringify(without(BASE, 'confidence'))], 'aiois');
    assert.ok(errors.length > 0);
    assert.match(errors[0]!, /confidence/);
  });
});

describe('inferProvider', () => {
  test('gpt models → openai, claude → anthropic, gemini → google, default anthropic', () => {
    assert.equal(inferProvider('gpt-5.6-sol'), 'openai');
    assert.equal(inferProvider('claude-fable-5'), 'anthropic');
    assert.equal(inferProvider('gemini-2.5-pro'), 'google');
    assert.equal(inferProvider('something-else'), 'anthropic');
  });
});

describe('assembleBatch', () => {
  test('model_provider comes from meta, not hardcoded anthropic', () => {
    const { scores } = parseScoreLines(['{"id":1,"ai_risk":6.9,"rationale_ja":"理由","confidence":0.8}'], 'legacy');
    const parsed = ScoreRunSchema.safeParse(assembleBatch(scores, { ...META, model: 'gpt-5.6-sol', modelProvider: 'openai' }));
    assert.ok(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues));
    if (parsed.success) {
      assert.equal(parsed.data.scorer.model, 'gpt-5.6-sol');
      assert.equal(parsed.data.scorer.model_provider, 'openai');
    }
  });

  test('legacy scores → object passes ScoreRunSchema (schema_version 2.1)', () => {
    const { scores } = parseScoreLines(['{"id":1,"ai_risk":6.9,"rationale_ja":"理由","confidence":0.8}'], 'legacy');
    const parsed = ScoreRunSchema.safeParse(assembleBatch(scores, META));
    assert.ok(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues));
    if (parsed.success) {
      assert.equal(parsed.data.schema_version, '2.1');
      assert.equal(parsed.data.scope, 'occupations');
      assert.equal(parsed.data.scores['1']!.ai_risk, 6.9);
      assert.equal(parsed.data.scores['1']!.rationale_ja, '理由');
      assert.equal(parsed.data.scorer.scoring_method, 'single-pass per occupation');
    }
  });

  test('aiois scores → ScoreRunSchema passes and full aiois survives assembly', () => {
    const { scores, errors } = parseScoreLines([aioisLine()], 'aiois');
    assert.equal(errors.length, 0);
    const parsed = ScoreRunSchema.safeParse(
      assembleBatch(scores, { ...META, scoringMethod: 'AIOIS-10 v1.0: in-session single-pass' }),
    );
    assert.ok(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues));
    if (parsed.success) {
      const a = parsed.data.scores['1']!.aiois;
      assert.ok(a, 'aiois must survive assembly');
      assert.equal(a!.d1, 4.8);
      assert.equal(a!.d10, 3.5);
      assert.equal(a!.transformation, 4.6);
      assert.equal(a!.displacement, 1.7);
      assert.equal(parsed.data.scorer.scoring_method, 'AIOIS-10 v1.0: in-session single-pass');
    }
  });
});
