/**
 * 5-axis profile derivation — graph-layer domain calculation.
 *
 * Phase E follow-up (2026-05-16): extracted from
 * `src/data/projections/profile5.ts` so the graph layer owns the
 * algorithm. Both consumers now go through here:
 *
 *   1. `src/graph/loader.ts::buildOccupationNode` — computes profile5
 *      eagerly at graph construction time and attaches the result to
 *      `OccupationNode.profile5`, so views/page-data can read it
 *      without any fs round-trip.
 *
 *   2. `src/data/projections/profile5.ts::buildProfile5` — still emits
 *      `public/data.profile5.json` for browser consumers, but imports
 *      this module's `AXIS_INPUTS` + `gatherAxis` instead of duplicating
 *      them. Removes the "twin algorithm" drift risk between graph
 *      and projection.
 *
 * Pure: no I/O, no time, no Math.random. Same banker-rounded output
 * regardless of input order (fmean uses Neumaier compensated sum).
 *
 * Why graph-layer (not view-layer): the 5 axes are computed from
 * `occupation.{skills,abilities,work_activities,work_characteristics}`
 * — fields that exist ONLY on the raw IPD source occupation, not on
 * the graph's downstream nodes. Pushing this into views/ would force
 * views to receive raw IPD-shaped data, defeating the graph contract.
 *
 * Why eager (not lazy): per-occupation cost is ~35 field reads +
 * 5 fmean + 5 banker-round, ≈ μs. At 556 occupations that's a few ms
 * total — vanishing inside loadGraph's overall ~35s build. Lazy
 * computation would require either a graph-level cache (adds mutable
 * state) or recompute-on-read (worse perf). Eager wins on simplicity.
 */
import type { Occupation } from '../data/schema/occupation.js';
import { fmean } from '../data/lib/fsum.js';
import { bankerRound } from '../data/lib/banker-round.js';

// Numeric block keys on Occupation that contribute to profile5.
export type Profile5NumericBlock =
  | 'work_activities'
  | 'abilities'
  | 'skills'
  | 'work_characteristics';

export interface Profile5AxisInput {
  block: Profile5NumericBlock;
  field: string;
}

/**
 * Per-occupation 5-axis profile.
 *
 * Each axis value is in [0, 100] (banker-rounded to 1 decimal place), or
 * `null` when every contributing IPD field is missing for the occupation.
 * The 5 keys are fixed by design — frontend radar chart axes — and the
 * key order matches `Object.keys(AXIS_INPUTS)` ('creative', 'social',
 * 'judgment', 'physical', 'routine').
 */
export interface Profile5Record {
  readonly creative: number | null;
  readonly social: number | null;
  readonly judgment: number | null;
  readonly physical: number | null;
  readonly routine: number | null;
}

/**
 * Axis definitions — fixed by design (mirrors the historical
 * scripts/projections/profile5.py mapping that the Python pipeline used).
 * Each axis averages 4-9 IPD fields drawn from up to 4 numeric blocks.
 */
export const AXIS_INPUTS: Record<keyof Profile5Record, Profile5AxisInput[]> = {
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

/**
 * Average all present input fields for one axis, normalized to 0–100,
 * banker-rounded to 1 decimal place. Returns `null` when every
 * contributing field is missing (no zero-stuffing).
 *
 * Exported separately so the projection (`buildProfile5`) and tests
 * can reuse the exact same algorithm — graph and projection MUST
 * produce byte-identical results.
 */
export function gatherAxis(occ: Occupation, inputs: readonly Profile5AxisInput[]): number | null {
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
  return bankerRound((rawAvg / SOURCE_MAX) * 100, 1);
}

/**
 * Compute the full 5-axis profile for one occupation. Returns the
 * per-axis record; any axis whose contributors are all missing is
 * `null` (the frontend renders a dash in that case). Always returns
 * the same 5 keys in the same order so the radar chart's axis layout
 * is stable.
 */
export function computeProfile5ForOcc(occ: Occupation): Profile5Record {
  return {
    creative: gatherAxis(occ, AXIS_INPUTS.creative),
    social:   gatherAxis(occ, AXIS_INPUTS.social),
    judgment: gatherAxis(occ, AXIS_INPUTS.judgment),
    physical: gatherAxis(occ, AXIS_INPUTS.physical),
    routine:  gatherAxis(occ, AXIS_INPUTS.routine),
  };
}
