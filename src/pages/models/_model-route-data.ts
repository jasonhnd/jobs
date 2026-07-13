import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { modelSlug } from '@/site/score-attribution';

export interface ModelBatchMeta {
  readonly model: string;
  readonly slug: string;
  readonly date: string;
  readonly covered_count: number;
}

export async function loadModelBatchMetas(): Promise<ModelBatchMeta[]> {
  const dir = join(process.cwd(), 'data', 'scores');
  const files = (await readdir(dir)).filter((file) => /^occupations_.*\.json$/.test(file)).sort();
  const metas: ModelBatchMeta[] = [];
  for (const file of files) {
    const raw = await readFile(join(dir, file), 'utf-8');
    const data = JSON.parse(raw) as {
      scope: string;
      scorer: { model: string };
      run: { run_date: string };
      input?: { occupation_count_scored?: number };
      scores: Record<string, unknown>;
    };
    if (data.scope !== 'occupations') continue;
    metas.push({
      model: data.scorer.model,
      slug: modelSlug(data.scorer.model),
      date: data.run.run_date,
      covered_count: data.input?.occupation_count_scored ?? Object.keys(data.scores).length,
    });
  }
  return metas.sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));
}
