/**
 * profile5.gatherAxis: tests the per-axis weighted-average rollup.
 *
 * Highest-risk untested logic in profile5.ts. A wrong SOURCE_MAX or a
 * zero-stuffing bug (using 0 instead of skipping missing values) would
 * silently inflate or deflate every radar chart axis for every occupation.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { gatherAxis, type AxisInput } from './profile5.js';
import type { Occupation } from '../schema/occupation.js';

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
  const inputs: AxisInput[] = [
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
  const inputs: AxisInput[] = [
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
  const inputs: AxisInput[] = [
    { block: 'work_activities', field: 'thinking_creatively' },
    { block: 'abilities',       field: 'originality' },
    { block: 'skills',          field: 'active_learning' },
  ];
  // Only 1 of 3 inputs present → still computes from that 1 → 4.0/5*100 = 80
  assert.equal(gatherAxis(occ, inputs), 80);
});

test('gatherAxis: ALL inputs missing returns null', () => {
  const occ = makeOcc({});
  const inputs: AxisInput[] = [
    { block: 'work_activities', field: 'thinking_creatively' },
    { block: 'abilities',       field: 'originality' },
  ];
  assert.equal(gatherAxis(occ, inputs), null);
});

test('gatherAxis: max IPD value (5.0) → 100 exactly', () => {
  const occ = makeOcc({ skills: { active_learning: 5.0 } });
  const inputs: AxisInput[] = [
    { block: 'skills', field: 'active_learning' },
  ];
  assert.equal(gatherAxis(occ, inputs), 100);
});

test('gatherAxis: 0 IPD value → 0 (not null — distinguishes "scored zero" from "missing")', () => {
  const occ = makeOcc({ skills: { active_learning: 0 } });
  const inputs: AxisInput[] = [
    { block: 'skills', field: 'active_learning' },
  ];
  assert.equal(gatherAxis(occ, inputs), 0);
});
