/**
 * data.haid-spec.json projection.
 *
 * Machine-readable copy of the HAID v1.0 specification so third parties can
 * cite the levels by code and reuse the definitions. The TypeScript module in
 * src/site/haid-spec.ts is the source of truth; this file only serializes it.
 * No numbers live here — quarterly counts are a separate release projection.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HAID_BOUNDARIES,
  HAID_CANONICAL_PATH,
  HAID_CASES,
  HAID_CERTAINTY_JA,
  HAID_LEVELS,
  HAID_LICENSE,
  HAID_NAME_EN,
  HAID_NAME_JA,
  HAID_RELATIONS,
  HAID_SPEC_DATE,
  HAID_SPEC_VERSION,
  HAID_TERMS,
  HAID_WINDOW_JA,
} from '../../site/haid-spec.js';

interface HaidSpecBuildResult {
  files: string[];
  rows: number;
}

export function buildHaidSpecPayload() {
  return {
    schema_version: '1.0.0',
    standard: 'HAID',
    name_ja: HAID_NAME_JA,
    name_en: HAID_NAME_EN,
    version: HAID_SPEC_VERSION,
    published: HAID_SPEC_DATE,
    license: HAID_LICENSE,
    url: `https://mirai-shigoto.com${HAID_CANONICAL_PATH}`,
    relations: HAID_RELATIONS,
    levels: HAID_LEVELS,
    boundaries: HAID_BOUNDARIES,
    terms: HAID_TERMS,
    window_labels_ja: HAID_WINDOW_JA,
    certainty_labels_ja: HAID_CERTAINTY_JA,
    cases: HAID_CASES,
  };
}

export async function buildHaidSpec(distRoot: string): Promise<HaidSpecBuildResult> {
  const payload = buildHaidSpecPayload();
  const outPath = join(distRoot, 'data.haid-spec.json');
  await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  return { files: [outPath], rows: payload.levels.length };
}
