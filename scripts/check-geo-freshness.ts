#!/usr/bin/env bun
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../src/data/schema/index.js';
import { buildCompareGeoFactSummary, buildOccupationGeoFactSummary, buildOccupationSetGeoFactSummary, buildSectorGeoFactSummary, renderAiFactParagraph } from '../src/lib/ai-fact-summary.js';
import { loadGraph } from '../src/graph/index.js';
import { SCORE_ATTRIBUTION, SCORE_PANEL, formatModelDisplay } from '../src/site/score-attribution.js';
import {
  computeGeoFacts,
  GeoTreemapRowsSchema,
  pickLatestGeoScoreRun,
  type GeoFacts,
} from '../src/site/geo-facts.js';
import { bindHomeFacts, buildHomeKpiView } from '../src/site/home-facts-render.js';
import { buildMethodologyBatchView } from '../src/site/methodology-facts.js';
import {
  CROSS_MODEL_VALIDATION_NOTE,
  hasCrossModelValidationNote,
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
const GEO_ASTRO_PAGES = [
  'src/pages/standard.astro',
  'src/pages/methodology.astro',
] as const;

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

function assertExact(rel: string, expected: string): void {
  const got = readText(rel);
  const normalizedExpected = expected.replace(/\r\n/g, '\n');
  if (got !== normalizedExpected) {
    fail(`${rel} does not match the generated GEO facts. Run \`bun src/data/build.ts\`.`);
  }
}

interface StaleModelTokens {
  /** Model ids and run dates of every superseded batch. Never allowed. */
  readonly identifiers: readonly string[];
  /** Human-readable model names, incl. the vendor-stripped short form. */
  readonly displayNames: readonly string[];
}

/**
 * Superseded model identifiers, derived from `data/scores/`.
 *
 * Previously this was a hand-edited literal list. It only ever named the model
 * that was canonical two generations ago, so it could not catch a leak of the
 * *current* model — the leak that actually matters — and went one generation
 * further out of date on every batch landing (#217).
 *
 * Deriving it means the set is correct by construction: everything in
 * `data/scores/` except the active run is stale, forever, without maintenance.
 */
export function staleModelTokens(runs: readonly ScoreRun[], active: ScoreRun): StaleModelTokens {
  const identifiers = new Set<string>();
  const displayNames = new Set<string>();
  for (const run of runs) {
    const isActive = run.scorer.model === active.scorer.model && run.run.run_date === active.run.run_date;
    if (isActive) continue;
    identifiers.add(run.scorer.model);
    identifiers.add(run.run.run_date);
    const display = formatModelDisplay(run.scorer.model);
    displayNames.add(display);
    // `/models` renders Anthropic models without the vendor prefix, so the
    // short form is a distinct leak shape (e.g. "Opus 4.8" vs "Claude Opus 4.8").
    const short = display.replace(/^Claude\s+/, '');
    if (short !== display) displayNames.add(short);
  }
  return { identifiers: [...identifiers], displayNames: [...displayNames] };
}

/**
 * `allowValidationModelNames` exempts display names only — never ids or run
 * dates. `llms.txt` may legitimately name an older model inside the historical
 * cross-model validation note; it must never carry that model's machine
 * identifier or batch date, which would mean the generated attribution is stale.
 */
export function firstStaleToken(
  text: string,
  stale: StaleModelTokens,
  options: { allowValidationModelNames?: boolean } = {},
): string | null {
  const forbidden = ['__SCORE_', '__GEO_', 'version": "0.5.0"', ...stale.identifiers];
  if (!options.allowValidationModelNames) {
    forbidden.push(...stale.displayNames);
  }
  return forbidden.find((token) => text.includes(token)) ?? null;
}

function assertNoStaleOrPlaceholders(
  rel: string,
  stale: StaleModelTokens,
  options: { allowValidationModelNames?: boolean } = {},
): void {
  const token = firstStaleToken(readText(rel), stale, options);
  if (token !== null) {
    fail(`${rel} contains stale token ${JSON.stringify(token)}`);
  }
}

function assertDocumentedDetailProjectionExamples(): void {
  const discoveryFiles = ['public/llms.txt', 'public/llms-full.txt'] as const;
  const ambiguousDetailPattern = /data\.detail\/(?:<id>|\{id\})\.json/i;
  const concreteDetailPattern = /https:\/\/mirai-shigoto\.com\/data\.detail\/(\d{4})\.json/g;

  for (const rel of discoveryFiles) {
    const text = readText(rel);
    if (!text.includes('detail IDs are zero-padded to four digits')) {
      fail(`${rel} must document the four-digit zero-padding rule for per-occupation detail IDs`);
    }
    if (ambiguousDetailPattern.test(text)) {
      fail(`${rel} contains an ambiguous per-occupation detail URL placeholder`);
    }

    const exampleIds = [...text.matchAll(concreteDetailPattern)].map((match) => match[1]!);
    if (exampleIds.length === 0) {
      fail(`${rel} must include at least one concrete per-occupation detail URL`);
    }

    for (const paddedId of new Set(exampleIds)) {
      for (const outputRoot of ['public', 'dist-astro'] as const) {
        const exampleRel = `${outputRoot}/data.detail/${paddedId}.json`;
        let parsed: { id?: unknown };
        try {
          parsed = JSON.parse(readText(exampleRel)) as { id?: unknown };
        } catch {
          fail(`${rel} documents ${paddedId}.json, but ${exampleRel} is missing or invalid`);
        }
        if (parsed.id !== Number.parseInt(paddedId, 10)) {
          fail(`${exampleRel} id does not match its documented zero-padded filename`);
        }
      }
    }
  }
}

function assertFreshGeoAstroPages(): void {
  const forbidden = [
    '__SCORE_',
    '__GEO_',
    'claude-opus-4-8',
    'version": "0.5.0"',
    '変化の大きさの平均差 <strong>−0.07</strong>',
  ];
  for (const rel of GEO_ASTRO_PAGES) {
    if (rel.replace(/\\/g, '/').startsWith('src/pages/yearly/')) continue;
    const text = readText(rel);
    const derivesConsensus = text.includes('CONSENSUS_STANDARD_FORMAL') ||
      text.includes('formatConsensusFooterLine') ||
      text.includes('CONSENSUS_FAQ_SENTENCE') ||
      text.includes('複数のAIモデルによる総合') ||
      text.includes('SCORE_ATTRIBUTION.modelDisplay') ||
      text.includes('batchView.currentModelDisplay');
    const derivesDate = text.includes('SCORE_PANEL.latestRunDate') ||
      text.includes('SCORE_ATTRIBUTION.runDate') ||
      text.includes('batchView.currentRunDate');
    if (!derivesConsensus) {
      fail(`${rel} must derive published-score copy from the consensus panel (or the active-batch aggregate)`);
    }
    if (!derivesDate) {
      fail(`${rel} must derive the current scoring date from SCORE_PANEL or the active-batch aggregate`);
    }
    for (const token of forbidden) {
      if (text.includes(token)) {
        fail(`${rel} contains stale token ${JSON.stringify(token)}`);
      }
    }
  }
}

/**
 * The runbook's "現行 batch" section names the active model, run date, and
 * score file. It had gone two generations stale (claude-opus-4-8 / 2026-05-30)
 * with nothing to notice, because it is prose nobody generates. Pin it to the
 * data so forgetting to update it after landing a batch fails the gate rather
 * than quietly misinforming the next operator. Issue #219 follow-up.
 */
function assertRunbookCurrentBatch(activeRun: ScoreRun): void {
  const rel = 'docs/SCORING_RUNBOOK.md';
  const text = readText(rel);
  const model = activeRun.scorer.model;
  const runDate = activeRun.run.run_date;
  const expected = [
    `- モデル: \`${model}\``,
    `- run date: \`${runDate}\``,
    `- Score output: \`data/scores/occupations_${model}_${runDate}.json\``,
  ];
  for (const line of expected) {
    if (!text.includes(line)) {
      fail(
        `${rel} "現行 batch" is out of date: expected the line ${JSON.stringify(line)}. ` +
        `The active batch under data/scores/ is ${model} @ ${runDate}.`,
      );
    }
  }
}

function assertHomeAndReadmeConsistency(facts: GeoFacts): void {
  const source = readText('src/index-source.html');
  const rendered = bindHomeFacts(source, facts);
  const view = buildHomeKpiView(facts);
  if (/__ACTIVE_BATCH_[A-Z0-9_]+__/.test(rendered)) {
    fail('homepage active-batch placeholders were not fully resolved');
  }
  if (facts.fiveBandDistribution.reduce((sum, band) => sum + band.sharePct, 0) !== 100) {
    fail('homepage five-band percentages must sum to exactly 100');
  }
  for (const expected of [
    `${view.workforceMan}<small>万</small>`,
    `${view.meanAiImpact}<small>/10</small>`,
    `${view.highImpactWagesTrillion}<small>兆</small>`,
    `影響≥${facts.highImpactThreshold}・${view.highImpactCount}職業`,
  ]) {
    if (!rendered.includes(expected)) fail(`homepage active-batch rendering is missing ${expected}`);
    assertContains('dist-astro/index.html', expected);
  }

  const methodology = buildMethodologyBatchView(facts);
  assertContains('dist-astro/methodology.html', '複数のAI');
  assertContains('dist-astro/methodology.html', SCORE_PANEL.latestRunDate);
  assertContains('dist-astro/methodology.html', methodology.meanAiImpact);
  assertContains('dist-astro/methodology.html', 'Claude Fable 5');

  const readme = readText('README.md');
  const staleCurrentClaims = [
    'Claude Fable 5 が AIOIS-10 で採点した',
    '現行の active score run は 2026-06-13',
    'with Claude Fable 5-scored',
    'AIOIS-10 scores use Claude Fable 5',
    'AIOIS-10 v1.0 に基づく現行スコアリングに使用している LLM',
  ];
  for (const claim of staleCurrentClaims) {
    if (readme.includes(claim)) fail(`README.md contains stale current-model claim ${JSON.stringify(claim)}`);
  }
  if (!readme.includes('これは Fable predecessor の外部整合性チェック')) {
    fail('README.md must scope the Fable 40-occupation validation as historical predecessor evidence');
  }
}

function assertContainsText(rel: string, expected: string, label: string): void {
  const text = readText(rel);
  if (!text.includes(expected)) {
    fail(`${rel} is missing ${label}`);
  }
}

/** Inverse of assertContainsText, for copy that must NOT survive a batch change. */
function assertOmitsText(rel: string, forbidden: string, why: string): void {
  if (readText(rel).includes(forbidden)) {
    fail(`${rel} still carries copy it should have dropped — ${why}`);
  }
}

function assertCrossModelValidationArchive(): void {
  const rel = 'data/validation/issue-15-d2b/results.json';
  const parsed = JSON.parse(readText(rel)) as {
    run_date?: string;
    sample_size?: number;
    models?: string[];
    scores?: Record<string, { fable?: number; opus?: number; sonnet?: number }>;
    stats?: {
      pearson?: { fo?: number; fs?: number; os?: number };
      mean_spread?: number;
      within_2_0?: string;
      mad_vs_fable?: { opus?: number; sonnet?: number };
    };
  };
  if (parsed.run_date !== '2026-06-23') fail(`${rel} run_date must be 2026-06-23`);
  if (parsed.sample_size !== 40) fail(`${rel} sample_size must be 40`);
  if (!parsed.models?.includes('claude-fable-5(canonical)')) fail(`${rel} must include canonical Fable model`);
  const stats = parsed.stats;
  const pearson = stats?.pearson;
  const madVsFable = stats?.mad_vs_fable;
  if (!pearson || pearson.fo !== 0.970 || pearson.fs !== 0.951 || pearson.os !== 0.924) {
    fail(`${rel} Pearson stats drifted from the reviewed D2-B validation`);
  }
  if (!stats || stats.mean_spread !== 1.02 || stats.within_2_0 !== '38/40') {
    fail(`${rel} agreement summary drifted from the reviewed D2-B validation`);
  }
  if (!madVsFable || madVsFable.opus !== 0.57 || madVsFable.sonnet !== 0.61) {
    fail(`${rel} MAD-vs-Fable summary drifted from the reviewed D2-B validation`);
  }
  const busGuide = parsed.scores?.['111'];
  const stenographer = parsed.scores?.['424'];
  if (busGuide?.fable !== 4.3 || busGuide.opus !== 3.0 || busGuide.sonnet !== 5.3) {
    fail(`${rel} id=111 validation scores drifted`);
  }
  if (stenographer?.fable !== 8.3 || stenographer.opus !== 7.0 || stenographer.sonnet !== 9.3) {
    fail(`${rel} id=424 validation scores drifted`);
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
  const scoreRuns = loadScoreRuns();
  const activeRun = pickLatestGeoScoreRun(scoreRuns);
  if (SCORE_ATTRIBUTION.modelId !== activeRun.scorer.model) {
    fail(`SCORE_ATTRIBUTION model ${SCORE_ATTRIBUTION.modelId} != active score run ${activeRun.scorer.model}`);
  }
  if (SCORE_ATTRIBUTION.runDate !== activeRun.run.run_date) {
    fail(`SCORE_ATTRIBUTION date ${SCORE_ATTRIBUTION.runDate} != active score run ${activeRun.run.run_date}`);
  }

  const treemapRows = GeoTreemapRowsSchema.parse(JSON.parse(readText('public/data.treemap.json')));
  const facts = computeGeoFacts(treemapRows, scoreRuns);

  assertExact('public/llms.txt', renderLlmsTxt(facts));
  assertExact('public/llms-full.txt', renderLlmsFullTxt(facts));
  assertExact('src/pages/_index-json-ld.json', renderHomeJsonLd(facts));

  const stale = staleModelTokens(scoreRuns, activeRun);
  assertNoStaleOrPlaceholders('public/llms.txt', stale, { allowValidationModelNames: true });
  assertNoStaleOrPlaceholders('public/llms-full.txt', stale, { allowValidationModelNames: true });
  assertNoStaleOrPlaceholders('src/pages/_index-json-ld.json', stale);
  assertDocumentedDetailProjectionExamples();
  assertFreshGeoAstroPages();
  assertHomeAndReadmeConsistency(facts);
  assertRunbookCurrentBatch(activeRun);
  assertCrossModelValidationArchive();
  // The D2-B note is a claim about the Fable 5 batch specifically. Assert both
  // directions: present when that batch is canonical, ABSENT otherwise. The
  // one-sided version had been unreachable since the GPT batch landed, so the
  // condition that actually matters now — a stale validation claim leaking into
  // another model's output — was unchecked. Issue #219 follow-up.
  if (hasCrossModelValidationNote(facts.attribution)) {
    assertContainsText('public/llms.txt', CROSS_MODEL_VALIDATION_NOTE, 'D2-B cross-model validation note');
    assertContainsText('public/llms-full.txt', CROSS_MODEL_VALIDATION_NOTE, 'D2-B cross-model validation note');
  } else {
    const why = `the D2-B note describes the Claude Fable 5 batch, but the active batch is ${facts.attribution.modelDisplay} (${facts.attribution.runDate})`;
    assertOmitsText('public/llms.txt', CROSS_MODEL_VALIDATION_NOTE, why);
    assertOmitsText('public/llms-full.txt', CROSS_MODEL_VALIDATION_NOTE, why);
  }
  assertContainsText('src/pages/methodology.astro', 'r=0.92〜0.97', 'D2-B cross-model validation correlation copy');
  assertContainsText('src/pages/methodology.astro', '38/40 職業', 'D2-B cross-model validation agreement copy');

  await assertRenderedFactBlocks(facts);

  console.log(
    `[check-geo-freshness] OK - ${facts.attribution.modelDisplay} ${facts.attribution.runDate}, ` +
    `${facts.occupationCount} occupations, mean=${facts.meanAiImpact.toFixed(2)}`,
  );
}

// Guarded so the pure helpers above can be imported by tests without running
// the whole gate (which reads dist-astro/ and exits the process).
if (import.meta.main) {
  await main();
}
