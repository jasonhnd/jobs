import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes } from '../src/data/lib/indexes.js';
import {
  DESIGN_ABS_DELTA_GE_1,
  DESIGN_BAND_CHANGES,
  DESIGN_MEAN_CONSENSUS,
  DESIGN_MEAN_LATEST,
  assertMatchesDesign,
  computeSwitchDrift,
  renderSwitchDriftMarkdown,
} from './consensus-switch-drift.ts';

describe('consensus switch drift', () => {
  test('live occupation history matches the locked switch-day figures', async () => {
    const { indexes, errors } = await buildIndexes();
    assert.deepEqual(errors, []);
    const summary = computeSwitchDrift(indexes);
    assert.equal(summary.occupationCount, 556);
    assert.equal(summary.meanLatest, DESIGN_MEAN_LATEST);
    assert.equal(summary.meanConsensus, DESIGN_MEAN_CONSENSUS);
    assert.equal(summary.absDeltaGe10, DESIGN_ABS_DELTA_GE_1);
    assert.equal(summary.bandChanges, DESIGN_BAND_CHANGES);
    assertMatchesDesign(summary);
    const occ111 = summary.movers.find((row) => row.id === 111);
    assert.ok(occ111);
    assert.equal(occ111.latest, 6.8);
    assert.equal(occ111.consensus, 4.25);
    const markdown = renderSwitchDriftMarkdown(summary);
    assert.match(markdown, /5\.23/);
    assert.match(markdown, /4\.68/);
    assert.match(markdown, /観光バスガイド/);
  });
});
