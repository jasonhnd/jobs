import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../data/lib/indexes.js';
import {
  computeGeoFacts,
  GeoTreemapRowsSchema,
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

export async function buildGeoSurfaces(
  indexes: Indexes,
  distRoot: string,
  repoRoot = process.cwd(),
): Promise<GeoSurfaceBuildResult> {
  const treemapPath = join(distRoot, 'data.treemap.json');
  const treemapRows = GeoTreemapRowsSchema.parse(JSON.parse(await readFile(treemapPath, 'utf-8')));
  const scoreRuns = [...indexes.runsByModel.values()].flat();
  const facts = computeGeoFacts(treemapRows, scoreRuns);

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
