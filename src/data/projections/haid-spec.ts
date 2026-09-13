/**
 * data.haid-spec.json — machine-readable HAID v1.0 definitions.
 *
 * src/site/haid-spec.ts is the source; this file only serialises it.
 * No counts live here — quarterly counts are a separate release projection.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HAID_BOUNDARIES, HAID_CANONICAL_PATH, HAID_CASES, HAID_CERTAINTY_JA, HAID_GRADE_JA,
  HAID_LEVELS, HAID_LICENSE, HAID_LICENSE_URL, HAID_NAME_EN, HAID_NAME_JA, HAID_RELATIONS,
  HAID_SPEC_DATE, HAID_SPEC_VERSION, HAID_TERMS, HAID_WINDOW_JA,
} from '../../site/haid-spec.js';

export function buildHaidSpecPayload() {
  return {
    schema_version: '1.0.0',
    standard: 'HAID',
    name_ja: HAID_NAME_JA,
    name_en: HAID_NAME_EN,
    version: HAID_SPEC_VERSION,
    published: HAID_SPEC_DATE,
    license: HAID_LICENSE,
    license_url: HAID_LICENSE_URL,
    url: `https://mirai-shigoto.com${HAID_CANONICAL_PATH}`,
    relations: HAID_RELATIONS,
    levels: HAID_LEVELS,
    boundaries: HAID_BOUNDARIES,
    terms: HAID_TERMS,
    window_labels_ja: HAID_WINDOW_JA,
    grade_labels_ja: HAID_GRADE_JA,
    certainty_labels_ja: HAID_CERTAINTY_JA,
    cases: HAID_CASES,
  };
}

export async function buildHaidSpec(distRoot: string): Promise<{ files: string[]; rows: number }> {
  const payload = buildHaidSpecPayload();
  const outPath = join(distRoot, 'data.haid-spec.json');
  await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  return { files: [outPath], rows: payload.levels.length };
}
