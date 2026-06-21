import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScoreRun } from '../data/schema/index.js';
import type { Indexes } from '../data/lib/indexes.js';
import { formatModelDisplay } from './score-attribution.js';
import {
  computeGeoFacts,
  pickLatestGeoScoreRun,
  type GeoAttribution,
  type GeoScoreEntry,
  type GeoTreemapRow,
} from './geo-facts.js';
import {
  renderHomeJsonLd,
  renderLlmsFullTxt,
  renderLlmsTxt,
} from './geo-render.js';

export interface GeoSurfaceBuildResult {
  readonly files: string[];
  readonly summary: string;
}

async function writeIfChanged(path: string, content: string): Promise<void> {
  const existing = await readFile(path, 'utf-8').catch(() => null);
  if (existing !== content) {
    await writeFile(path, content, 'utf-8');
  }
}

function scoreMapFromRun(run: ScoreRun): Map<number, GeoScoreEntry> {
  const out = new Map<number, GeoScoreEntry>();
  for (const [idRaw, entry] of Object.entries(run.scores)) {
    const id = Number.parseInt(idRaw, 10);
    if (Number.isFinite(id)) out.set(id, entry);
  }
  return out;
}

export async function buildGeoSurfaces(
  indexes: Indexes,
  distRoot: string,
  repoRoot = process.cwd(),
): Promise<GeoSurfaceBuildResult> {
  const treemapPath = join(distRoot, 'data.treemap.json');
  const treemapRows = JSON.parse(await readFile(treemapPath, 'utf-8')) as GeoTreemapRow[];
  const scoreRuns = [...indexes.runsByModel.values()].flat();
  const activeRun = pickLatestGeoScoreRun(scoreRuns);
  const attribution: GeoAttribution = {
    modelId: activeRun.scorer.model,
    modelDisplay: formatModelDisplay(activeRun.scorer.model),
    runDate: activeRun.run.run_date,
    standardLabel: 'AIOIS-10',
  };
  const facts = computeGeoFacts(treemapRows, scoreMapFromRun(activeRun), attribution);

  const llmsPath = join(distRoot, 'llms.txt');
  const llmsFullPath = join(distRoot, 'llms-full.txt');
  const homeJsonLdPath = join(repoRoot, 'src', 'pages', '_index-json-ld.json');

  await writeIfChanged(llmsPath, renderLlmsTxt(facts));
  await writeIfChanged(llmsFullPath, renderLlmsFullTxt(facts));
  await writeIfChanged(homeJsonLdPath, renderHomeJsonLd(facts));

  return {
    files: [llmsPath, llmsFullPath, homeJsonLdPath],
    summary: `model=${facts.attribution.modelId} date=${facts.attribution.runDate} rows=${facts.occupationCount}`,
  };
}

