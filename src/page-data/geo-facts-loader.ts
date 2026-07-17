import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../data/schema/index.js';
import { SCORE_ATTRIBUTION } from '../site/score-attribution.js';
import {
  computeGeoFacts,
  GeoTreemapRowsSchema,
  type GeoFacts,
} from '../site/geo-facts.js';

const ROOT = process.cwd();

let cachedGeoFacts: GeoFacts | null = null;

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8');
}

function loadScoreRuns(): ScoreRun[] {
  const dir = join(ROOT, 'data', 'scores');
  const runs: ScoreRun[] = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, name), 'utf-8'));
    runs.push(ScoreRunSchema.parse(parsed));
  }
  return runs;
}

export function loadGeoFacts(): GeoFacts {
  if (cachedGeoFacts) return cachedGeoFacts;

  const scoreRuns = loadScoreRuns();
  const treemapRows = GeoTreemapRowsSchema.parse(JSON.parse(readText('public/data.treemap.json')));
  const facts = computeGeoFacts(treemapRows, scoreRuns);
  if (SCORE_ATTRIBUTION.modelId !== facts.attribution.modelId) {
    throw new Error(
      `geo-facts-loader: SCORE_ATTRIBUTION model ${SCORE_ATTRIBUTION.modelId} != active score run ${facts.attribution.modelId}`,
    );
  }
  if (SCORE_ATTRIBUTION.runDate !== facts.attribution.runDate) {
    throw new Error(
      `geo-facts-loader: SCORE_ATTRIBUTION date ${SCORE_ATTRIBUTION.runDate} != active score run ${facts.attribution.runDate}`,
    );
  }
  cachedGeoFacts = facts;
  return cachedGeoFacts;
}
