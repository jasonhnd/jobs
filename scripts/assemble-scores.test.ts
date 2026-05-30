// Tests for scripts/assemble-scores.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { parseScoreLines, assembleBatch, type BatchMeta } from './assemble-scores.js';
import { ScoreRunSchema } from '../src/data/schema/score-run.js';

const META: BatchMeta = {
  model: 'claude-opus-4-8',
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
};

describe('parseScoreLines', () => {
  test('valid line → parsed (id, ai_risk, confidence)', () => {
    const { scores, errors } = parseScoreLines(['{"id":1,"ai_risk":6.9,"rationale_ja":"理由","confidence":0.8}']);
    assert.equal(errors.length, 0);
    assert.equal(scores['1']!.ai_risk, 6.9);
    assert.equal(scores['1']!.rationale_ja, '理由');
    assert.equal(scores['1']!.confidence, 0.8);
  });

  test('blank lines skipped; confidence omitted → null', () => {
    const { scores, errors } = parseScoreLines(['', '  ', '{"id":2,"ai_risk":3.0,"rationale_ja":"x"}']);
    assert.equal(errors.length, 0);
    assert.equal(Object.keys(scores).length, 1);
    assert.equal(scores['2']!.confidence, null);
  });

  test('accepts 1-decimal incl integers (7 → ok)', () => {
    assert.equal(parseScoreLines(['{"id":1,"ai_risk":7,"rationale_ja":"x"}']).errors.length, 0);
  });

  test('rejects ai_risk > 10', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":11,"rationale_ja":"x"}']).errors.length > 0);
  });

  test('rejects 2-decimal ai_risk (6.95)', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":6.95,"rationale_ja":"x"}']).errors.length > 0);
  });

  test('rejects missing/empty rationale_ja', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":5.0}']).errors.length > 0);
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":5.0,"rationale_ja":""}']).errors.length > 0);
  });

  test('rejects confidence out of range', () => {
    assert.ok(parseScoreLines(['{"id":1,"ai_risk":5.0,"rationale_ja":"x","confidence":1.5}']).errors.length > 0);
  });

  test('rejects bad id (0 / >999)', () => {
    assert.ok(parseScoreLines(['{"id":0,"ai_risk":5.0,"rationale_ja":"x"}']).errors.length > 0);
    assert.ok(parseScoreLines(['{"id":1000,"ai_risk":5.0,"rationale_ja":"x"}']).errors.length > 0);
  });

  test('rejects duplicate id', () => {
    const { errors } = parseScoreLines([
      '{"id":1,"ai_risk":5.0,"rationale_ja":"x"}',
      '{"id":1,"ai_risk":6.0,"rationale_ja":"y"}',
    ]);
    assert.ok(errors.length > 0);
  });
});

describe('assembleBatch', () => {
  test('valid scores → object passes ScoreRunSchema (schema_version 2.1)', () => {
    const { scores } = parseScoreLines(['{"id":1,"ai_risk":6.9,"rationale_ja":"理由","confidence":0.8}']);
    const parsed = ScoreRunSchema.safeParse(assembleBatch(scores, META));
    assert.ok(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues));
    if (parsed.success) {
      assert.equal(parsed.data.schema_version, '2.1');
      assert.equal(parsed.data.scope, 'occupations');
      assert.equal(parsed.data.scores['1']!.ai_risk, 6.9);
      assert.equal(parsed.data.scores['1']!.rationale_ja, '理由');
    }
  });
});
