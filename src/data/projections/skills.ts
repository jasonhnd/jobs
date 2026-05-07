/**
 * data.skills/<skill_key>.json + _index.json projections — per docs/DATA_ARCHITECTURE.md §6.5 / §6.6.
 *
 * Status: Future (skipped by default)
 * Consumer: future "find jobs by skill" page
 *
 * Migrated from scripts/projections/skills.py.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import type { LabelEntry } from '../schema/labels.js';

export interface SkillsBuildResult {
  files: string[];
  dir: string;
  skillFiles: number;
  indexFile: string;
}

export async function buildSkills(
  indexes: Indexes,
  distRoot: string,
): Promise<SkillsBuildResult> {
  const outDir = join(distRoot, 'data.skills');
  await mkdir(outDir, { recursive: true });

  const skillsLabels = indexes.labelsByDim.get('skills') ?? new Map<string, LabelEntry>();

  const writtenFiles: string[] = [];

  for (const [skillKey, label] of skillsLabels) {
    const ranked: Array<{ id: number; name_ja: string; score: number }> = [];
    // Match Python: iterate `indexes.occ_by_id.items()` in insertion order.
    for (const [occId, occ] of indexes.occById) {
      if (occ.skills == null) continue;
      const score = occ.skills[skillKey];
      if (score == null) continue;
      ranked.push({ id: occId, name_ja: occ.title_ja, score });
    }
    // Sort by score desc, stable.
    ranked.sort((a, b) => b.score - a.score);

    const payload = {
      skill_key: skillKey,
      label_ja: label.ja,
      occupations: ranked,
    };
    const filePath = join(outDir, `${skillKey}.json`);
    await writeFile(
      filePath,
      JSON.stringify(payload) + '\n',
      'utf-8',
    );
    writtenFiles.push(filePath);
  }

  // _index.json
  const indexSkills: Array<{ key: string; label_ja: string }> = [];
  for (const [key, value] of skillsLabels) {
    indexSkills.push({ key, label_ja: value.ja });
  }
  const indexPayload = {
    schema_version: '1.0',
    skills: indexSkills,
  };
  const indexPath = join(outDir, '_index.json');
  await writeFile(
    indexPath,
    JSON.stringify(indexPayload) + '\n',
    'utf-8',
  );

  return {
    files: [...writtenFiles, indexPath],
    dir: outDir,
    skillFiles: writtenFiles.length,
    indexFile: indexPath,
  };
}
