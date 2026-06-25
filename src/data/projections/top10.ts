/**
 * data.top10.json projection.
 *
 * Slim homepage-mobile payload for the high-impact TOP 10 carousel.
 * It intentionally mirrors only the fields renderMobileTop10 reads so
 * mobile first load does not need public/data.treemap.json.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';

export interface Top10BuildResult {
  files: string[];
  rows: number;
}

interface Top10Row {
  id: number;
  name_ja: string;
  name_en: string | null;
  ai_risk: number;
  ai_rationale_ja: string;
  workers: number | null;
  salary: number | null;
}

export async function buildTop10(
  indexes: Indexes,
  distRoot: string,
): Promise<Top10BuildResult> {
  const rows: Top10Row[] = [];

  for (const [occId, score] of indexes.latestScoreByOcc) {
    const occ = indexes.occById.get(occId);
    const stats = indexes.statsById.get(occId);
    if (!occ || !stats) continue;

    rows.push({
      id: occId,
      name_ja: occ.title_ja,
      name_en: indexes.transById.get(occId)?.title_en ?? null,
      ai_risk: score.ai_risk,
      ai_rationale_ja: score.rationale_ja,
      workers: stats.workers ?? null,
      salary: stats.salary_man_yen ?? null,
    });
  }

  rows.sort((a, b) => (b.ai_risk - a.ai_risk) || (a.id - b.id));
  const top10 = rows.slice(0, 10);

  const dataPath = join(distRoot, 'data.top10.json');
  await writeFile(
    dataPath,
    JSON.stringify(top10) + '\n',
    'utf-8',
  );

  return { files: [dataPath], rows: top10.length };
}
