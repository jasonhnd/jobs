import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../data/schema/index.js';
import { SCORE_ATTRIBUTION } from '../site/score-attribution.js';
import {
  computeGeoFacts,
  pickLatestGeoScoreRun,
  type GeoAttribution,
  type GeoFacts,
  type GeoScoreEntry,
  type GeoTreemapRow,
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

function scoreMapFromRun(run: ScoreRun): Map<number, GeoScoreEntry> {
  const out = new Map<number, GeoScoreEntry>();
  for (const [idRaw, entry] of Object.entries(run.scores)) {
    const id = Number.parseInt(idRaw, 10);
    if (Number.isFinite(id)) out.set(id, entry);
  }
  return out;
}

export function loadGeoFacts(): GeoFacts {
  if (cachedGeoFacts) return cachedGeoFacts;

  const activeRun = pickLatestGeoScoreRun(loadScoreRuns());
  if (SCORE_ATTRIBUTION.modelId !== activeRun.scorer.model) {
    throw new Error(
      `geo-facts-loader: SCORE_ATTRIBUTION model ${SCORE_ATTRIBUTION.modelId} != active score run ${activeRun.scorer.model}`,
    );
  }
  if (SCORE_ATTRIBUTION.runDate !== activeRun.run.run_date) {
    throw new Error(
      `geo-facts-loader: SCORE_ATTRIBUTION date ${SCORE_ATTRIBUTION.runDate} != active score run ${activeRun.run.run_date}`,
    );
  }
  const treemapRows = JSON.parse(readText('public/data.treemap.json')) as GeoTreemapRow[];
  const attribution: GeoAttribution = {
    modelId: SCORE_ATTRIBUTION.modelId,
    modelDisplay: SCORE_ATTRIBUTION.modelDisplay,
    runDate: SCORE_ATTRIBUTION.runDate,
    standardLabel: SCORE_ATTRIBUTION.standardLabel,
  };

  cachedGeoFacts = computeGeoFacts(treemapRows, scoreMapFromRun(activeRun), attribution);
  return cachedGeoFacts;
}
