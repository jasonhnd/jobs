import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadJsonFile } from '../loaders.js';
import { Aiois10Schema, ScoreEntrySchema, ScoreRunSchema } from './score-run.js';

const baseAiois = {
  d1: 4.8,
  d2: 4.4,
  d3: 5.0,
  d4: 6.5,
  d5: 5.8,
  d6: 3.0,
  d7: 4.2,
  d8: 3.6,
  d9: 2.8,
  d10: 3.5,
  transformation: 4.6,
  displacement: 1.7,
};

describe('Aiois10Schema', () => {
  test('accepts one-decimal transformation within the ±0.05 index tolerance', () => {
    // Arrange: mean(1.2, 3.5) = 2.35, stored as one decimal.
    const roundedUp = { ...baseAiois, d1: 1.2, d2: 3.5, transformation: 2.4 };
    const roundedDown = { ...baseAiois, d1: 1.2, d2: 3.5, transformation: 2.3 };

    // Act / Assert
    assert.equal(Aiois10Schema.safeParse(roundedUp).success, true);
    assert.equal(Aiois10Schema.safeParse(roundedDown).success, true);
  });

  test('rejects transformation that drifts beyond the index tolerance', () => {
    // Arrange
    const invalid = { ...baseAiois, d1: 1.2, d2: 3.5, transformation: 2.5 };

    // Act
    const parsed = Aiois10Schema.safeParse(invalid);

    // Assert
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.deepEqual(parsed.error.issues[0]?.path, ['transformation']);
    }
  });
});

const validEntry = {
  ai_risk: 4.6,
  rationale_ja: '情報処理は変化するが、現場判断が残る。',
  confidence: 0.8,
  aiois: baseAiois,
};

function scoreRunWith(entry: unknown) {
  return {
    schema_version: '2.1',
    scope: 'occupations',
    scorer: {
      model: 'fixture-model',
      model_provider: 'fixture-provider',
      model_temperature: null,
      scoring_method: 'fixture',
    },
    run: {
      run_date: '2026-07-17',
      run_id: 'score-invariant-fixture',
      duration_minutes: null,
      operator: null,
    },
    input: {
      input_data_version: 'fixture',
      input_data_sha256: null,
      occupation_count_scored: 1,
      occupation_count_skipped: 0,
    },
    prompt: {
      prompt_version: 'fixture',
      prompt_file: 'fixture.md',
      prompt_sha256: null,
      rubric_source: 'fixture',
    },
    anchors: {},
    caveat: 'fixture',
    scores: { '42': entry },
  };
}

describe('ScoreEntrySchema AIOIS headline invariant', () => {
  test('accepts equal ai_risk and AIOIS Transformation values', () => {
    assert.equal(ScoreEntrySchema.safeParse(validEntry).success, true);
    assert.equal(ScoreRunSchema.safeParse(scoreRunWith(validEntry)).success, true);
  });

  test('preserves legacy entries with no AIOIS profile', () => {
    const legacy = { ...validEntry, ai_risk: 6.2, aiois: null };
    assert.equal(ScoreEntrySchema.safeParse(legacy).success, true);
    assert.equal(ScoreRunSchema.safeParse(scoreRunWith(legacy)).success, true);
  });

  test('rejects a mismatched headline at the occupation-key path', () => {
    const parsed = ScoreRunSchema.safeParse(scoreRunWith({ ...validEntry, ai_risk: 4.5 }));
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.deepEqual(parsed.error.issues[0]?.path, ['scores', '42', 'ai_risk']);
      assert.match(parsed.error.issues[0]?.message ?? '', /aiois\.transformation \(4\.6\)/);
    }
  });

  test('loader diagnostics identify both the source file and occupation key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'score-run-invariant-'));
    const file = join(dir, 'occupations_fixture_2026-07-17.json');
    try {
      writeFileSync(file, JSON.stringify(scoreRunWith({ ...validEntry, ai_risk: 4.5 })));
      const result = await loadJsonFile(file, ScoreRunSchema);
      assert.equal(result.data, null);
      assert.equal(result.error?.file, file);
      assert.match(result.error?.message ?? '', /scores\.42\.ai_risk/);
      assert.match(result.error?.message ?? '', /aiois\.transformation/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
