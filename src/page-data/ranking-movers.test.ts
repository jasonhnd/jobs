import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import type { ScoreRun } from '../data/schema/score-run.js';
import {
  buildRankingMoversFromPair,
  buildRankingMoversFromRuns,
  selectLatestComparableAioisPair,
  toComparableAioisBatch,
} from './ranking-movers.js';

function run(
  model: string,
  date: string,
  scores: Record<string, { t: number; d: number; aiois?: boolean }>,
): ScoreRun {
  const entries: ScoreRun['scores'] = {};
  for (const [id, score] of Object.entries(scores)) {
    entries[id] = {
      ai_risk: score.t,
      rationale_ja: `rationale-${id}`,
      confidence: 0.8,
      aiois: score.aiois === false ? null : {
        d1: score.t,
        d2: score.t,
        d3: 5,
        d4: 5,
        d5: 5,
        d6: 5,
        d7: 5,
        d8: 5,
        d9: 5,
        d10: 5,
        transformation: score.t,
        displacement: score.d,
      },
    };
  }
  return {
    schema_version: '2.1',
    scope: 'occupations',
    scorer: {
      model,
      model_provider: 'fixture',
      model_temperature: null,
      scoring_method: 'fixture',
    },
    run: {
      run_date: date,
      run_id: `${model}-${date}`,
      duration_minutes: null,
      operator: 'test',
    },
    input: {
      input_data_version: 'fixture',
      input_data_sha256: null,
      occupation_count_scored: Object.keys(scores).length,
      occupation_count_skipped: 0,
    },
    prompt: {
      prompt_version: 'fixture',
      prompt_file: 'fixture',
      prompt_sha256: null,
      rubric_source: 'fixture',
    },
    anchors: {},
    caveat: 'fixture',
    scores: entries,
  };
}

const titles = new Map<number, string>([
  [1, 'Alpha'],
  [2, 'Beta'],
  [3, 'Gamma'],
  [4, 'Delta'],
]);

describe('ranking movers helper', () => {
  test('selects the latest two comparable AIOIS-10 occupation batches', () => {
    const legacy = run('legacy', '2026-04-25', {
      1: { t: 5, d: 0, aiois: false },
    });
    const baseline = run('baseline', '2026-05-30', {
      1: { t: 5, d: 2 },
    });
    const candidate = run('candidate', '2026-06-13', {
      1: { t: 6, d: 3 },
    });

    assert.equal(toComparableAioisBatch(legacy), null);
    const pair = selectLatestComparableAioisPair([legacy, candidate, baseline]);
    assert.equal(pair.baseline.model, 'baseline');
    assert.equal(pair.candidate.model, 'candidate');
  });

  test('orders movers by dT/dD and preserves displayed values', () => {
    const baseline = toComparableAioisBatch(run('baseline', '2026-05-30', {
      1: { t: 5.0, d: 2.0 },
      2: { t: 4.0, d: 5.0 },
      3: { t: 8.0, d: 6.0 },
      4: { t: 1.0, d: 1.0 },
    }))!;
    const candidate = toComparableAioisBatch(run('candidate', '2026-06-13', {
      1: { t: 6.2, d: 1.5 },
      2: { t: 3.6, d: 7.0 },
      3: { t: 7.0, d: 4.0 },
      4: { t: 1.5, d: 1.1 },
    }))!;

    const familyById = new Map([[2, 'office']]);
    const movers = buildRankingMoversFromPair(baseline, candidate, titles, {
      topN: 2,
      familyById,
    });

    assert.deepEqual(movers.transformation.up.map((row) => row.id), [1, 4]);
    assert.deepEqual(movers.transformation.down.map((row) => row.id), [3, 2]);
    assert.deepEqual(movers.displacement.up.map((row) => row.id), [2, 4]);
    assert.deepEqual(movers.displacement.down.map((row) => row.id), [3, 1]);

    assert.deepEqual(movers.displacement.up[0], {
      id: 2,
      name: 'Beta',
      base: 5.0,
      current: 7.0,
      delta: 2.0,
      familyCode: 'office',
    });
    assert.equal(movers.meta.comparedCount, 4);
  });

  test('confirms candidate batch is the active pickLatestScore batch', () => {
    const baseline = run('baseline', '2026-05-30', {
      1: { t: 5, d: 2 },
      2: { t: 4, d: 5 },
    });
    const candidate = run('candidate', '2026-06-13', {
      1: { t: 6, d: 3 },
      2: { t: 3, d: 4 },
    });

    assert.doesNotThrow(() => buildRankingMoversFromRuns([baseline, candidate], titles));
  });
});
