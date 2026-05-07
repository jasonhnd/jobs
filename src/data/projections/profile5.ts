/**
 * data.profile5.json projection — per docs/DATA_ARCHITECTURE.md §6.11 (v1.1.0+).
 *
 * Status: Implemented (v1.1.0 phase 2)
 * Consumer: mobile ④/⑤ 詳細 radar chart, ⑥ 比較 5-axis comparison
 * Shape:    { id → { creative, social, judgment, physical, routine } }, all 0-100
 *
 * The 5 axes are derived from existing IPD numeric profile fields. NOT new
 * data — it's a rollup that the mobile design wants pre-computed instead of
 * re-derived in browser JS for every render.
 *
 * When a contributing field is null or its parent block is null, it's dropped
 * from the average (no zero-stuffing). If ALL contributors for an axis are
 * missing for an occupation, that axis is null (frontend shows dash).
 *
 * Migrated from scripts/projections/profile5.py.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import type { Occupation } from '../schema/occupation.js';
import { fmean } from '../lib/fsum.js';
import { pythonRound } from '../lib/python-round.js';

// Numeric block keys on Occupation that contribute to profile5.
type NumericBlock =
  | 'work_activities'
  | 'abilities'
  | 'skills'
  | 'work_characteristics';

interface AxisInput {
  block: NumericBlock;
  field: string;
}

// Axis definitions — keep order aligned with profile5.py.
const AXIS_INPUTS: Record<string, AxisInput[]> = {
  creative: [
    { block: 'work_activities', field: 'thinking_creatively' },
    { block: 'abilities', field: 'originality' },
    { block: 'abilities', field: 'fluency_of_ideas' },
    { block: 'skills', field: 'active_learning' },
  ],
  social: [
    { block: 'skills', field: 'social_perceptiveness' },
    { block: 'skills', field: 'coordination' },
    { block: 'skills', field: 'persuasion' },
    { block: 'skills', field: 'negotiation' },
    { block: 'skills', field: 'instructing' },
    { block: 'skills', field: 'service_orientation' },
    { block: 'work_characteristics', field: 'contact_with_others' },
    { block: 'work_characteristics', field: 'face_to_face_discussions' },
    { block: 'work_characteristics', field: 'teamwork' },
  ],
  judgment: [
    { block: 'skills', field: 'critical_thinking' },
    { block: 'skills', field: 'complex_problem_solving' },
    { block: 'skills', field: 'judgment_decision_making' },
    { block: 'skills', field: 'systems_evaluation' },
    { block: 'work_characteristics', field: 'freedom_to_make_decisions' },
    { block: 'work_characteristics', field: 'responsibility_for_outcomes' },
    { block: 'work_characteristics', field: 'consequence_of_error' },
  ],
  physical: [
    { block: 'abilities', field: 'static_strength' },
    { block: 'abilities', field: 'stamina' },
    { block: 'abilities', field: 'gross_body_equilibrium' },
    { block: 'abilities', field: 'arm_hand_steadiness' },
    { block: 'abilities', field: 'manual_dexterity' },
    { block: 'work_characteristics', field: 'standing' },
    { block: 'work_characteristics', field: 'walking_running' },
    { block: 'work_characteristics', field: 'handling_objects_tools' },
    { block: 'work_characteristics', field: 'physical_proximity' },
  ],
  routine: [
    { block: 'work_characteristics', field: 'repetitive_tasks' },
    { block: 'work_characteristics', field: 'repetition_of_activities' },
    { block: 'work_characteristics', field: 'exactness_accuracy' },
    { block: 'work_characteristics', field: 'pace_determined_by_machine' },
    { block: 'work_characteristics', field: 'regular_schedule' },
  ],
};

const SOURCE_MAX = 5.0;

export interface Profile5BuildResult {
  files: string[];
  occupations: number;
  axes: string[];
  nullAxes: Record<string, number>;
}

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

/** Average all present input fields for one axis. Returns null if all missing. */
function gatherAxis(occ: Occupation, inputs: AxisInput[]): number | null {
  const values: number[] = [];
  for (const { block, field } of inputs) {
    const blockData = occ[block];
    if (blockData == null) continue;
    const v = blockData[field];
    if (v == null) continue;
    values.push(v);
  }
  if (values.length === 0) return null;
  const rawAvg = fmean(values);
  return pythonRound((rawAvg / SOURCE_MAX) * 100, 1);
}

export async function buildProfile5(
  indexes: Indexes,
  distRoot: string,
): Promise<Profile5BuildResult> {
  const profiles: Record<string, Record<string, number | null>> = {};
  const nullAxes: Record<string, number> = {};
  for (const axis of Object.keys(AXIS_INPUTS)) nullAxes[axis] = 0;

  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);
  for (const occId of sortedIds) {
    const occ = indexes.occById.get(occId)!;
    const record: Record<string, number | null> = {};
    for (const [axis, inputs] of Object.entries(AXIS_INPUTS)) {
      const val = gatherAxis(occ, inputs);
      record[axis] = val;
      if (val === null) nullAxes[axis]! += 1;
    }
    profiles[String(occId)] = record;
  }

  const axisDefinitions: Record<string, string[]> = {};
  for (const [axis, inputs] of Object.entries(AXIS_INPUTS)) {
    axisDefinitions[axis] = inputs.map(({ block, field }) => `${block}.${field}`);
  }

  const payload = {
    schema_version: '1.0',
    generated_at: nowIso(),
    axis_definitions: axisDefinitions,
    axis_count: Object.keys(AXIS_INPUTS).length,
    occupation_count: Object.keys(profiles).length,
    null_axes_per_dimension: nullAxes,
    profiles,
  };

  const outPath = join(distRoot, 'data.profile5.json');
  await writeFile(
    outPath,
    JSON.stringify(payload) + '\n',
    'utf-8',
  );

  return {
    files: [outPath],
    occupations: Object.keys(profiles).length,
    axes: Object.keys(AXIS_INPUTS),
    nullAxes,
  };
}
