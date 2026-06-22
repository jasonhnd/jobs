#!/usr/bin/env bun
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../src/data/schema/index.js';
import { buildCompareGeoFactSummary, buildOccupationGeoFactSummary, buildOccupationSetGeoFactSummary, buildSectorGeoFactSummary, renderAiFactParagraph } from '../src/lib/ai-fact-summary.js';
import { loadGraph } from '../src/graph/index.js';
import { SCORE_ATTRIBUTION } from '../src/site/score-attribution.js';
import {
  computeGeoFacts,
  pickLatestGeoScoreRun,
  type GeoFacts,
  type GeoAttribution,
  type GeoScoreEntry,
  type GeoTreemapRow,
} from '../src/site/geo-facts.js';
import {
  renderHomeJsonLd,
  renderLlmsFullTxt,
  renderLlmsTxt,
} from '../src/site/geo-render.js';
import { makeCompareLoaderFromGraph } from '../src/views/compare.js';
import { buildCompareBundle } from '../src/views/compare-hub.js';
import { ABILITIES_CONFIGS } from '../src/views/genre-configs.js';
import { buildGenreResult, loadAllDetails } from '../src/views/genre-hub.js';
import { GEO_ANSWER_TOPIC_CONFIGS, buildGeoAnswerTopic } from '../src/views/geo-answer-topics.js';
import { loadGraphAdaptedDetails } from '../src/views/hub.js';
import { QA_ITEMS, selectExamples } from '../src/views/qa-meta.js';
import { buildRankings, loadOccupationsFromGraph } from '../src/views/ranking.js';

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

function assertContains(rel: string, expected: string): void {
  let got: string;
  try {
    got = readText(rel);
  } catch {
    fail(`${rel} is missing. Run \`bun run build\` before \`bun scripts/check-geo-freshness.ts\`.`);
  }
  if (!got.includes(expected)) {
    fail(`${rel} does not contain the generated GEO citable fact block.`);
  }
}

async function assertRenderedFactBlocks(facts: GeoFacts): Promise<void> {
  const graph = await loadGraph();

  const sector = facts.sectorsByMeanImpact[0];
  if (!sector) fail('no GEO sector facts available for rendered fact-block check');
  assertContains(
    `dist-astro/sectors/${sector.id}.html`,
    renderAiFactParagraph(buildSectorGeoFactSummary({ facts, sectorId: sector.id })),
  );

  const rankings = buildRankings(() => loadOccupationsFromGraph(graph));
  const ranking = rankings.results.get('ai-risk-high') ?? rankings.results.values().next().value;
  if (!ranking) fail('no ranking result available for rendered fact-block check');
  assertContains(
    `dist-astro/rankings/${ranking.slug}.html`,
    renderAiFactParagraph(buildOccupationSetGeoFactSummary({
      facts,
      subjectJa: ranking.h1Text,
      pageKindJa: 'ランキング',
      occupationIds: ranking.items.map((item) => item.id),
    })),
  );

  const genreConfig = ABILITIES_CONFIGS[0];
  if (!genreConfig) fail('no genre config available for rendered fact-block check');
  const genreResult = buildGenreResult(loadGraphAdaptedDetails(graph), genreConfig);
  assertContains(
    `dist-astro/abilities/${genreConfig.slug}.html`,
    renderAiFactParagraph(buildOccupationSetGeoFactSummary({
      facts,
      subjectJa: genreConfig.title_ja,
      pageKindJa: 'ジャンルページ',
      occupationIds: genreResult.items.map((item) => item.id),
    })),
  );

  const compare = buildCompareBundle(makeCompareLoaderFromGraph(graph)).results.values().next().value;
  if (!compare) fail('no compare result available for rendered fact-block check');
  assertContains(
    `dist-astro/compare/${compare.meta.slug}.html`,
    renderAiFactParagraph(buildCompareGeoFactSummary({
      facts,
      subjectJa: compare.meta.title_ja,
      occupationIds: [compare.a.id, compare.b.id],
    })),
  );

  const qa = QA_ITEMS[0];
  if (!qa) fail('no Q&A item available for rendered fact-block check');
  const examples = selectExamples(loadAllDetails(), qa, 10);
  assertContains(
    `dist-astro/q/${qa.slug}.html`,
    renderAiFactParagraph(buildOccupationSetGeoFactSummary({
      facts,
      subjectJa: qa.question,
      pageKindJa: 'Q&A',
      occupationIds: examples.map((example) => example.id),
    })),
  );

  const occupation = facts.occupations[0];
  if (!occupation) fail('no GEO occupation facts available for rendered occupation check');
  assertContains(
    `dist-astro/${occupation.id}.html`,
    renderAiFactParagraph(buildOccupationGeoFactSummary({ facts, occupationId: occupation.id })),
  );
  assertContains(
    `dist-astro/${occupation.id}.html`,
    `<details class="faq-item faq-ai-replacement"><summary>${occupation.nameJa}はAIでなくなる・AIに代替される仕事ですか？</summary>`,
  );
  assertContains(
    `dist-astro/${occupation.id}.html`,
    `GEO-AではAI影響度が10段階中 ${occupation.aiImpact.toFixed(1)} で`,
  );

  for (const config of GEO_ANSWER_TOPIC_CONFIGS) {
    const topic = buildGeoAnswerTopic(facts, config.slug);
    if (!topic) fail(`no GEO answer topic available for ${config.slug}`);
    assertContains(
      `dist-astro/answers/${config.slug}.html`,
      renderAiFactParagraph(buildOccupationSetGeoFactSummary({
        facts,
        subjectJa: topic.config.h1Ja,
        pageKindJa: 'ランキング型回答',
        occupationIds: topic.items.map((item) => item.id),
      })),
    );
  }
}

async function main(): Promise<void> {
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

  await assertRenderedFactBlocks(facts);

  console.log(
    `[check-geo-freshness] OK - ${facts.attribution.modelDisplay} ${facts.attribution.runDate}, ` +
    `${facts.occupationCount} occupations, mean=${facts.meanAiImpact.toFixed(2)}`,
  );
}

await main();
