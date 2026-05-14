/**
 * data.holland.json projection — per docs/DATA_ARCHITECTURE.md §6.7.
 *
 * Status: Implemented (data emitted; consumer page TBD — see Design.md)
 * Consumer: future Holland Code interest matching page
 * Shape: columnar 6-dim vector (R/I/A/S/E/C)
 *
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { nowIso } from '../../lib/now.js';

const HOLLAND_KEYS: Array<readonly [string, string]> = [
  ['realistic', 'R'],
  ['investigative', 'I'],
  ['artistic', 'A'],
  ['social', 'S'],
  ['enterprising', 'E'],
  ['conventional', 'C'],
];

export interface HollandBuildResult {
  files: string[];
  rows: number;
}

export async function buildHolland(
  indexes: Indexes,
  distRoot: string,
): Promise<HollandBuildResult> {
  const rows: unknown[] = [];
  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);
  for (const occId of sortedIds) {
    const occ = indexes.occById.get(occId)!;
    if (occ.interests == null) continue;
    const row: unknown[] = [occId, occ.title_ja];
    for (const [key] of HOLLAND_KEYS) {
      // Python's dict.get(key) returns None when key missing.
      // JS Object property access returns undefined; coerce to null for JSON.
      const v = occ.interests[key];
      row.push(v == null ? null : v);
    }
    rows.push(row);
  }

  const payload = {
    schema_version: '1.0',
    generated_at: nowIso(),
    row_count: rows.length,
    cols: ['id', 'name_ja', ...HOLLAND_KEYS.map(([, letter]) => letter)],
    rows,
  };

  const outPath = join(distRoot, 'data.holland.json');
  await writeFile(
    outPath,
    JSON.stringify(payload) + '\n',
    'utf-8',
  );
  return { files: [outPath], rows: rows.length };
}
