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
 * Phase E follow-up (2026-05-16): the algorithm (AXIS_INPUTS + gatherAxis)
 * moved into the graph layer (`src/graph/profile5.ts`) so views/pages can
 * read profile5 via OccupationNode.profile5 without an fs round-trip. This
 * module still emits `public/data.profile5.json` for browser consumers, but
 * now reuses the graph algorithm — there's only one implementation to drift.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { nowIso } from '../../lib/now.js';
import { AXIS_INPUTS, gatherAxis } from '../../graph/profile5.js';

export interface Profile5BuildResult {
  files: string[];
  occupations: number;
  axes: string[];
  nullAxes: Record<string, number>;
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
