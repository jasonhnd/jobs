/**
 * data.labels/ja.json projection — per docs/DATA_ARCHITECTURE.md §6.10.
 *
 * Status: Planned
 * Consumer: all frontend code rendering labels
 * Shape: flat dict per language: {dim: {key: label_str}}
 * Size target: < 30 KB (gzipped)
 *
 * Source: data/labels/<dim>.ja-en.json × 7
 *
 * EN labels were dropped in v1.4.0 when the English UI was removed.
 * The source dictionaries remain bilingual; only the JA projection is emitted.
 *
 * Migrated from scripts/projections/labels.py.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';

export interface LabelsBuildResult {
  files: string[];
  dimensions: number;
}

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

export async function buildLabels(
  indexes: Indexes,
  distRoot: string,
): Promise<LabelsBuildResult> {
  const outDir = join(distRoot, 'data.labels');
  await mkdir(outDir, { recursive: true });

  const jaPayload: Record<string, unknown> = {
    schema_version: '1.0',
    lang: 'ja',
    generated_at: nowIso(),
  };

  // Iterate `labels_by_dim` in insertion order; matches Python dict iteration
  // (which preserves insertion order on 3.7+). Source dimensions are loaded in
  // a fixed order in indexes.ts so this is deterministic.
  for (const [dim, labels] of indexes.labelsByDim) {
    const dimDict: Record<string, string> = {};
    for (const [key, entry] of labels) {
      dimDict[key] = entry.ja;
    }
    jaPayload[dim] = dimDict;
  }

  const jaPath = join(outDir, 'ja.json');
  await writeFile(
    jaPath,
    JSON.stringify(jaPayload) + '\n',
    'utf-8',
  );

  return { files: [jaPath], dimensions: indexes.labelsByDim.size };
}
