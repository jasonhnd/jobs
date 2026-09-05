import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  comparableAioisRuns,
  latestAioisPair,
  latestOccupationRun,
  listOccupationRuns,
} from './occupation-runs.js';
import { runSlug } from './score-attribution.js';

describe('listOccupationRuns', () => {
  test('lists occupations batches from data/scores in date order', () => {
    const runs = listOccupationRuns();
    assert.ok(runs.length >= 2);
    for (let i = 1; i < runs.length; i += 1) {
      assert.ok(runs[i - 1]!.runDate <= runs[i]!.runDate);
    }
    for (const run of runs) {
      assert.equal(run.slug, runSlug({ model: run.model, runDate: run.runDate }));
      assert.ok(run.coveredCount > 0);
    }
    const latest = latestOccupationRun(runs);
    assert.equal(latest.runDate, runs[runs.length - 1]!.runDate);
    const aiois = comparableAioisRuns(runs);
    assert.ok(aiois.length >= 2);
    const pair = latestAioisPair(runs);
    assert.equal(pair.candidate.model, aiois[aiois.length - 1]!.model);
    assert.equal(pair.baseline.model, aiois[aiois.length - 2]!.model);
  });
});
