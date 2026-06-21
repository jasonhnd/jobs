#!/usr/bin/env bun
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../src/data/schema/index.js';
import { SCORE_ATTRIBUTION } from '../src/site/score-attribution.js';
import {
  computeGeoFacts,
  pickLatestGeoScoreRun,
  type GeoAttribution,
  type GeoScoreEntry,
  type GeoTreemapRow,
} from '../src/site/geo-facts.js';
import {
  renderHomeJsonLd,
  renderLlmsFullTxt,
  renderLlmsTxt,
} from '../src/site/geo-render.js';

const ROOT = process.cwd();

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n');
}

function fail(message: string): never {
  console.error(`[check-geo-freshness] FAIL: ${message}`);
  process.exit(1);
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

function assertExact(rel: string, expected: string): void {
  const got = readText(rel);
  const normalizedExpected = expected.replace(/\r\n/g, '\n');
  if (got !== normalizedExpected) {
    fail(`${rel} does not match the generated GEO facts. Run \`bun src/data/build.ts\`.`);
  }
}

function assertNoStaleOrPlaceholders(rel: string): void {
  const text = readText(rel);
  const forbidden = [
    '__SCORE_',
    '__GEO_',
    'Claude Opus 4.8',
    'claude-opus-4-8',
    '2026-05-30',
    'version": "0.5.0"',
  ];
  for (const token of forbidden) {
    if (text.includes(token)) {
      fail(`${rel} contains stale token ${JSON.stringify(token)}`);
    }
  }
}

function main(): void {
  const activeRun = pickLatestGeoScoreRun(loadScoreRuns());
  if (SCORE_ATTRIBUTION.modelId !== activeRun.scorer.model) {
    fail(`SCORE_ATTRIBUTION model ${SCORE_ATTRIBUTION.modelId} != active score run ${activeRun.scorer.model}`);
  }
  if (SCORE_ATTRIBUTION.runDate !== activeRun.run.run_date) {
    fail(`SCORE_ATTRIBUTION date ${SCORE_ATTRIBUTION.runDate} != active score run ${activeRun.run.run_date}`);
  }

  const treemapRows = JSON.parse(readText('public/data.treemap.json')) as GeoTreemapRow[];
  const attribution: GeoAttribution = {
    modelId: SCORE_ATTRIBUTION.modelId,
    modelDisplay: SCORE_ATTRIBUTION.modelDisplay,
    runDate: SCORE_ATTRIBUTION.runDate,
    standardLabel: SCORE_ATTRIBUTION.standardLabel,
  };
  const facts = computeGeoFacts(treemapRows, scoreMapFromRun(activeRun), attribution);

  assertExact('public/llms.txt', renderLlmsTxt(facts));
  assertExact('public/llms-full.txt', renderLlmsFullTxt(facts));
  assertExact('src/pages/_index-json-ld.json', renderHomeJsonLd(facts));

  assertNoStaleOrPlaceholders('public/llms.txt');
  assertNoStaleOrPlaceholders('public/llms-full.txt');
  assertNoStaleOrPlaceholders('src/pages/_index-json-ld.json');

  console.log(
    `[check-geo-freshness] OK - ${facts.attribution.modelDisplay} ${facts.attribution.runDate}, ` +
    `${facts.occupationCount} occupations, mean=${facts.meanAiImpact.toFixed(2)}`,
  );
}

main();

