import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  activeOccupationRuns,
  comparableAioisRuns,
  latestAioisPair,
  latestOccupationRun,
  latestRunPerVendor,
  listOccupationRuns,
} from './occupation-runs.js';
import { runSlug, VENDOR_WHITELIST } from './score-attribution.js';

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
    assert.equal(latest.runDate, activeOccupationRuns(runs).at(-1)!.runDate);
    const aiois = comparableAioisRuns(activeOccupationRuns(runs));
    assert.ok(aiois.length >= 2);
    const pair = latestAioisPair(runs);
    assert.equal(pair.candidate.model, aiois[aiois.length - 1]!.model);
    assert.equal(pair.baseline.model, aiois[aiois.length - 2]!.model);
  });

  test('latestRunPerVendor is one comparable run per whitelist vendor, newest date', () => {
    const runs = listOccupationRuns();
    const panel = latestRunPerVendor(runs);
    assert.deepEqual(panel.map((run) => run.provider), [...VENDOR_WHITELIST]);
    assert.equal(new Set(panel.map((run) => run.provider)).size, panel.length);
    for (const run of panel) {
      const vendorRuns = comparableAioisRuns(activeOccupationRuns(runs)).filter((entry) => entry.provider === run.provider);
      const newest = vendorRuns.reduce((best, entry) => (
        entry.runDate > best.runDate
        || (entry.runDate === best.runDate && entry.model.localeCompare(best.model) > 0)
          ? entry
          : best
      ));
      assert.equal(run.slug, newest.slug);
    }
  });

  test('latest helpers skip a backfill run; comparableAioisRuns keeps it (mms-9)', () => {
    const runs = listOccupationRuns();
    const newestXai = [...runs].reverse().find((run) => run.provider === 'xai' && run.hasAiois);
    assert.ok(newestXai);
    const synthetic = {
      ...newestXai,
      model: 'grok-4.5',
      modelDisplay: 'Grok 4.5',
      runDate: '2099-12-31',
      slug: 'grok-4.5@2099-12-31',
      backfill: true,
    };
    const withBackfill = [...runs, synthetic];
    assert.deepEqual(latestOccupationRun(withBackfill), latestOccupationRun(runs));
    assert.deepEqual(latestAioisPair(withBackfill), latestAioisPair(runs));
    assert.deepEqual(latestRunPerVendor(withBackfill), latestRunPerVendor(runs));
    assert.equal(
      comparableAioisRuns(withBackfill).some((run) => run.model === 'grok-4.5' && run.backfill),
      true,
    );
  });
});
