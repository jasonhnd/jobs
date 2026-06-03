/**
 * profile5.gatherAxis: tests the per-axis weighted-average rollup.
 *
 * Phase E follow-up (2026-05-16): moved here from
 * src/data/projections/profile5.test.ts when the algorithm itself
 * relocated to the graph layer. `src/data/projections/profile5.ts`
 * now imports gatherAxis from here too — there's only one
 * implementation to test.
 *
 * Highest-risk untested logic in profile5.ts. A wrong SOURCE_MAX or a
 * zero-stuffing bug (using 0 instead of skipping missing values) would
 * silently inflate or deflate every radar chart axis for every occupation.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { gatherAxis, computeProfile5ForOcc, type Profile5AxisInput } from './profile5.js';
import type { Occupation } from '../data/schema/occupation.js';

// Build a minimal Occupation that only has the fields gatherAxis reads.
// The schema requires many fields; we use `as Occupation` to bypass.
function makeOcc(partial: Record<string, Record<string, number | null>>): Occupation {
  return partial as unknown as Occupation;
}

test('gatherAxis: all 4 inputs present → arithmetic mean / 5 * 100, rounded to 1dp', () => {
  const occ = makeOcc({
    skills: { active_learning: 4.0 },
    work_activities: { thinking_creatively: 3.0 },
    abilities: { originality: 2.5, fluency_of_ideas: 1.5 },
  });
  const inputs: Profile5AxisInput[] = [
    { block: 'work_activities', field: 'thinking_creatively' },
    { block: 'abilities',       field: 'originality' },
    { block: 'abilities',       field: 'fluency_of_ideas' },
    { block: 'skills',          field: 'active_learning' },
  ];
  // mean = (3.0 + 2.5 + 1.5 + 4.0) / 4 = 2.75 → /5 = 0.55 → *100 = 55.0
  assert.equal(gatherAxis(occ, inputs), 55);
});

test('gatherAxis: missing fields are skipped (NOT zero-stuffed)', () => {
  const occ = makeOcc({
    skills: { active_learning: 4.0 },
    work_activities: { thinking_creatively: 3.0 },
    abilities: { originality: null, fluency_of_ideas: null }, // both null → skip
  });
  const inputs: Profile5AxisInput[] = [
    { block: 'work_activities', field: 'thinking_creatively' },
    { block: 'abilities',       field: 'originality' },
    { block: 'abilities',       field: 'fluency_of_ideas' },
    { block: 'skills',          field: 'active_learning' },
  ];
  // mean of present = (3.0 + 4.0) / 2 = 3.5 → /5 = 0.7 → *100 = 70.0
  // Bug if zero-stuffing: would be (3.0 + 0 + 0 + 4.0)/4 = 1.75 → 35.0
  assert.equal(gatherAxis(occ, inputs), 70);
});

test('gatherAxis: missing block returns null axis (entire block null)', () => {
  const occ = makeOcc({
    skills: { active_learning: 4.0 },
    // work_activities, abilities omitted entirely
  });
  const inputs: Profile5AxisInput[] = [
    { block: 'work_activities', field: 'thinking_creatively' },
    { block: 'abilities',       field: 'originality' },
    { block: 'skills',          field: 'active_learning' },
  ];
  // Only 1 of 3 inputs present → still computes from that 1 → 4.0/5*100 = 80
  assert.equal(gatherAxis(occ, inputs), 80);
});

test('gatherAxis: ALL inputs missing returns null', () => {
  const occ = makeOcc({});
  const inputs: Profile5AxisInput[] = [
    { block: 'work_activities', field: 'thinking_creatively' },
    { block: 'abilities',       field: 'originality' },
  ];
  assert.equal(gatherAxis(occ, inputs), null);
});

test('gatherAxis: max IPD value (5.0) → 100 exactly', () => {
  const occ = makeOcc({ skills: { active_learning: 5.0 } });
  const inputs: Profile5AxisInput[] = [
    { block: 'skills', field: 'active_learning' },
  ];
  assert.equal(gatherAxis(occ, inputs), 100);
});

test('gatherAxis: IPD value above SOURCE_MAX clamps to 100 (radar [0,100] contract)', () => {
  // The schema permits IPD scores up to 7.0; SOURCE_MAX is 5.0, so a 6.85
  // average would compute to 137 and spike the radar polygon outside its
  // 100-grid. The axis is capped at 100, not rescaled.
  const inputs: Profile5AxisInput[] = [
    { block: 'skills', field: 'active_learning' },
  ];
  assert.equal(gatherAxis(makeOcc({ skills: { active_learning: 6.85 } }), inputs), 100);
  assert.equal(gatherAxis(makeOcc({ skills: { active_learning: 7.0 } }), inputs), 100);
});

test('gatherAxis: 0 IPD value → 0 (not null — distinguishes "scored zero" from "missing")', () => {
  const occ = makeOcc({ skills: { active_learning: 0 } });
  const inputs: Profile5AxisInput[] = [
    { block: 'skills', field: 'active_learning' },
  ];
  assert.equal(gatherAxis(occ, inputs), 0);
});

test('computeProfile5ForOcc: returns 5-axis record with consistent key order', () => {
  // All inputs missing → all axes null, but keys still present in fixed order.
  const occ = makeOcc({});
  const result = computeProfile5ForOcc(occ);
  assert.deepEqual(
    Object.keys(result),
    ['creative', 'social', 'judgment', 'physical', 'routine'],
    'profile5 record must always have the 5 keys in this fixed order',
  );
  assert.deepEqual(result, {
    creative: null,
    social: null,
    judgment: null,
    physical: null,
    routine: null,
  });
});

test('computeProfile5ForOcc: realistic occupation populates multiple axes', () => {
  const occ = makeOcc({
    skills: {
      active_learning: 4.0,
      social_perceptiveness: 3.5,
      critical_thinking: 4.5,
    },
    abilities: {
      originality: 3.0,
    },
    work_activities: {
      thinking_creatively: 4.0,
    },
    work_characteristics: {
      contact_with_others: 4.5,
      regular_schedule: 3.0,
    },
  });
  const result = computeProfile5ForOcc(occ);
  // creative present (active_learning + originality + thinking_creatively)
  assert.ok(result.creative !== null);
  assert.ok(result.creative > 0);
  // social present (social_perceptiveness + contact_with_others)
  assert.ok(result.social !== null);
  // judgment present (critical_thinking)
  assert.ok(result.judgment !== null);
  // physical: nothing matching → null
  assert.equal(result.physical, null);
  // routine: regular_schedule → present
  assert.ok(result.routine !== null);
});
