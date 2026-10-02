/**
 * TS ETL orchestrator — entry point for `npm run build:data`.
 *
 * Loads + validates source data, runs all 14 projections, writes them to
 * `public/` (Astro's publicDir; Astro then copies the whole publicDir into
 * `dist-astro/` during `astro build`).
 *
 * Validation is bundled: a schema or consistency violation aborts with
 * exit 1 before any projection writes, so partial output is never
 * committed by mistake.
 *
 * Exit code:
 *   0 — clean run (validation + all projections succeed).
 *   1 — at least one validation or projection error.
 */
import { mkdir, rm, readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';

import { promoteStagedOutputs } from './promote.js';
import { assertUniformVendorPanel, buildIndexes, type Indexes } from './lib/indexes.js';
import { rewriteGeneratedModule } from './lib/rewrite-generated-module.js';
import { buildDetail } from './projections/detail.js';
import { buildHolland } from './projections/holland.js';
import { buildLabels } from './projections/labels.js';
import { buildMePositions } from './projections/me-positions.js';
import { buildModelsByModel } from './projections/models-by-model.js';
import { buildModelsDeep } from './projections/models-deep.js';
import { buildProfile5 } from './projections/profile5.js';
import { buildSearch } from './projections/search.js';
import { buildScoreHistory } from './projections/score-history.js';
import { buildSectors } from './projections/sectors.js';
import { buildSkills } from './projections/skills.js';
import { buildTransferPaths } from './projections/transfer_paths.js';
import { buildTreemap } from './projections/treemap.js';
import { buildHaidSpec } from './projections/haid-spec.js';
import { buildHaidRelease } from './projections/haid-release.js';
import { buildWorktypes } from './projections/worktypes.js';
import { formatModelDisplay, pickAttributionBatch, type BatchMetaForAttribution } from '../site/score-attribution.js';
import { flagshipPanelMeta } from '../graph/score-strategy.js';

import { buildGeoSurfaces } from '../site/geo-build.js';
// Removed in Step 12 (dead projection cleanup, 2026-05-13):
//   - buildFeatured / data.featured.json  (no runtime consumer)
//   - buildTasks / data.tasks/*.json  (no runtime consumer; the
//     556-file per-occupation tasks dump cost ~1.2 MB build output
//     and ~1.5s pipeline time for an output nobody reads)
// The score_history projection was restored for multi-model comparison in
// 2026-07; tasks / featured remain removed.

const REPO_ROOT = process.cwd();

/**
 * Whitelist the resolved output path so a typo'd BUILD_DATA_OUT_DIR like
 * `../something` can't write outside the repo (or system temp). Audit's
 * #3.4. The check rejects paths that escape both roots before the build
 * ever touches the filesystem.
 */
function resolveOutDir(envValue: string | undefined): string {
  if (!envValue) return join(REPO_ROOT, 'public');
  const resolved = resolve(REPO_ROOT, envValue);
  const insideRepo = !relative(REPO_ROOT, resolved).startsWith('..' + sep) &&
    relative(REPO_ROOT, resolved) !== '..';
  const insideTmp = !relative(tmpdir(), resolved).startsWith('..' + sep) &&
    relative(tmpdir(), resolved) !== '..';
  if (!insideRepo && !insideTmp) {
    throw new Error(
      `[build] BUILD_DATA_OUT_DIR resolves outside the repo and the system temp dir: ${resolved}. ` +
      `Refusing to write there.`,
    );
  }
  return resolved;
}

// TS-ETL writes projections directly into Astro's publicDir (`./public/`).
// Astro then copies the entire publicDir into `dist-astro/` during `astro build`.
// `BUILD_DATA_OUT_DIR=...` overrides the output directory (used historically by
// the byte-diff workflow during Track B; left in place for ad-hoc verification).
const TS_DIST = resolveOutDir(process.env.BUILD_DATA_OUT_DIR);

// Staging dir for atomic per-file replacement. Projections write here, then
// we rename each top-level entry into TS_DIST on success. Includes the PID so
// concurrent runs (parallel CI shards, accidental dev re-run) don't clobber
// each other. Cleaned up on success and on failure.
const STAGE_DIST = `${TS_DIST}.tmp-${process.pid}`;

interface ProjectionRun {
  name: string;
  files: string[];
  durationMs: number;
  summary: string;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  console.log('TS ETL · running');
  console.log(`  output dir: ${TS_DIST}`);
  console.log(`  staging dir: ${STAGE_DIST}\n`);

  const indexes = await loadValidatedIndexes();
  await updateGeneratedMetadata(indexes);
  await prepareStagingDirectory();
  const runs = await runProjections(indexes);
  logProjectionRuns(runs);

  // Real filesystem. Tests import promoteStagedOutputs and inject faults.
  await promoteStagedOutputs({
    stageDir: STAGE_DIST,
    outDir: TS_DIST,
    cacheDir: join(REPO_ROOT, '.cache', 'etl'),
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`  done in ${elapsed}s`);
}

async function loadValidatedIndexes(): Promise<Indexes> {
  // ───── L1+L2: load + validate everything ─────
  console.log('  [L1+L2] loading + validating sources …');
  const { indexes, errors } = await buildIndexes();

  if (errors.length > 0) {
    console.error(`\n  [FAIL] ${errors.length} validation error(s):`);
    for (const err of errors.slice(0, 10)) {
      console.error(`    ${err.file}: ${err.message}`);
    }
    if (errors.length > 10) {
      console.error(`    … and ${errors.length - 10} more`);
    }
    process.exit(1);
  }

  console.log(`  [OK] all source files valid`);
  console.log(`     occupations:        ${indexes.occById.size}`);
  console.log(`     translations:       ${indexes.transById.size}`);
  console.log(`     stats_legacy:       ${indexes.statsById.size}`);
  console.log(`     score histories:    ${indexes.historyByOcc.size}`);
  console.log(`     latest scores:      ${indexes.latestScoreByOcc.size}`);
  console.log(`     flagship means:     ${indexes.flagshipByOcc.size}`);
  console.log(`     labels dimensions:  ${indexes.labelsByDim.size}`);
  console.log(`     sectors:            ${indexes.sectors.length}`);

  return indexes;
}

// Keep generated freshness and attribution modules aligned with the canonical batch.
async function updateGeneratedMetadata(indexes: Indexes): Promise<void> {
  const active = selectAttributionBatch(indexes);
  const modelDisplay = formatModelDisplay(active.model);
  await updateContentDate(active.runDate);
  await updateScoreAttribution(indexes, active, modelDisplay);
}

function selectAttributionBatch(indexes: Indexes): ReturnType<typeof pickAttributionBatch> {
  // One implementation of "which batch is canonical". This block used to
  // re-derive it inline from `latestScoreByOcc` with its own tie-breaking,
  // while `pickAttributionBatch` — documented in this file's header as the
  // canonical helper — was called by nothing but its own test. Two answers to
  // one question is the underlying hazard; the helper also fails fast on an
  // empty `data/scores/`, replacing hardcoded 2026-05-30 / claude-opus-4-8
  // fallbacks that would have published a two-generations-old attribution
  // across ~40 surfaces while the build reported success. Issue #219.
  const batchMetas: BatchMetaForAttribution[] = [...indexes.runsByModel.values()]
    .flat()
    .map((run) => ({
      scope: run.scope,
      model: run.scorer.model,
      runDate: run.run.run_date,
      hasAiois: Object.values(run.scores).some((entry) => entry.aiois != null),
      backfill: run.run.backfill === true,
    }));
  return pickAttributionBatch(batchMetas);
}

// Writes only on change, so rebuilds without new scores keep the working tree clean.
async function updateContentDate(runDate: string): Promise<void> {
  await rewriteGeneratedModule(join(REPO_ROOT, 'src/lib/_content-date.ts'), [
    {
      pattern: /CONTENT_DATE = '[^']*'/,
      replacement: `CONTENT_DATE = '${runDate}'`,
      expect: `CONTENT_DATE = '${runDate}'`,
    },
  ]);
  console.log(`  [content-date] ${runDate}`);
}

async function updateScoreAttribution(
  indexes: Indexes,
  active: ReturnType<typeof pickAttributionBatch>,
  modelDisplay: string,
): Promise<void> {
  // Active score attribution (model + date) → generated fs-free module, so
  // src/site/score-attribution.ts carries no node:fs into the Edge bundle.
  const sample = indexes.flagshipByOcc.get(1);
  if (!sample) throw new Error('[build] no flagship mean for occupation 1 — cannot write SCORE_PANEL');
  assertUniformVendorPanel(indexes.flagshipByOcc);
  const panel = flagshipPanelMeta(sample);

  await rewriteGeneratedModule(join(REPO_ROOT, 'src/site/_score-attribution.ts'), [
    { pattern: /modelId: '[^']*'/, replacement: `modelId: '${active.model}'`, expect: `modelId: '${active.model}'` },
    { pattern: /modelDisplay: '[^']*'/, replacement: `modelDisplay: '${modelDisplay}'`, expect: `modelDisplay: '${modelDisplay}'` },
    { pattern: /runDate: '[^']*'/, replacement: `runDate: '${active.runDate}'`, expect: `runDate: '${active.runDate}'` },
    { pattern: /vendorCount: \d+/, replacement: `vendorCount: ${panel.vendorCount}`, expect: `vendorCount: ${panel.vendorCount}` },
    { pattern: /latestRunDate: '[^']*'/, replacement: `latestRunDate: '${panel.latestRunDate}'`, expect: `latestRunDate: '${panel.latestRunDate}'` },
    { pattern: /staleMonths: \d+/, replacement: `staleMonths: ${panel.staleMonths}`, expect: `staleMonths: ${panel.staleMonths}` },
    { pattern: /staleVendorCount: \d+/, replacement: `staleVendorCount: ${panel.staleVendorCount}`, expect: `staleVendorCount: ${panel.staleVendorCount}` },
  ]);
  console.log(`  [score-attribution] ${modelDisplay} (${active.runDate})`);
  console.log(`  [score-panel] vendors=${panel.vendorCount} latest=${panel.latestRunDate} stale=${panel.staleVendorCount}`);
}

async function prepareStagingDirectory(): Promise<void> {
  // TS_DIST is left untouched until every projection succeeds.
  await rm(STAGE_DIST, { recursive: true, force: true });
  await pruneOrphanStagingDirectories();
  await mkdir(STAGE_DIST, { recursive: true });
}

async function pruneOrphanStagingDirectories(): Promise<void> {
  // 2026-05-17 RA-002 fix: prune orphan staging dirs from previously
  // killed builds. A hard-killed build (SIGKILL, Ctrl-C race, OOM)
  // can leave `<TS_DIST>.tmp-<dead-pid>` siblings behind, which dirty
  // the working tree and confuse `git status`. Safe to remove any
  // sibling that isn't our own STAGE_DIST: PIDs aren't reused while
  // a process is alive, and a concurrent build would have its own
  // PID-suffixed dir we never touch.
  const tsParent = dirname(TS_DIST);
  const orphanPrefix = `${basename(TS_DIST)}.tmp-`;
  try {
    for (const name of await readdir(tsParent)) {
      if (!name.startsWith(orphanPrefix)) continue;
      const full = join(tsParent, name);
      if (full === STAGE_DIST) continue;
      await rm(full, { recursive: true, force: true });
      console.log(`  [cleanup] removed orphan staging dir: ${name}`);
    }
  } catch (err) {
    // Expected on first-ever run (ENOENT): tsParent missing — fine.
    // Surface any other error so Windows file-lock / permission issues
    // (EPERM, EBUSY, antivirus-locked files) don't masquerade as a
    // clean first-run state.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.warn('[build] orphan-dir cleanup unexpected error:', err);
    }
  }
}

async function runProjections(indexes: Indexes): Promise<ProjectionRun[]> {
  console.log('\n  [build] running projections …');
  const runs: ProjectionRun[] = [];
  try {
    runs.push(...await runCoreProjections(indexes));
    runs.push(...await runDiscoveryProjections(indexes));
    runs.push(...await runModelProjections(indexes));
    runs.push(...await runGraphAndGeoProjections(indexes));
  } catch (err) {
    // Projection failure never touches existing TS_DIST contents.
    await discardStagedOutputs();
    throw err;
  }
  return runs;
}

async function runCoreProjections(indexes: Indexes): Promise<ProjectionRun[]> {
  const runs: ProjectionRun[] = [];
  // sectors: must run first (others may depend on sector_id derivations).
  runs.push(await runProjection('sectors', async () => {
    const r = await buildSectors(indexes, STAGE_DIST);
    return {
      files: r.files,
      summary: r.skipped ?? `sectors=${r.sectors} uncategorized=${r.uncategorized} ambiguous=${r.ambiguous}`,
    };
  }));

  runs.push(await runProjection('labels', async () => {
    const r = await buildLabels(indexes, STAGE_DIST);
    return { files: r.files, summary: `dimensions=${r.dimensions}` };
  }));

  runs.push(await runProjection('profile5', async () => {
    const r = await buildProfile5(indexes, STAGE_DIST);
    return {
      files: r.files,
      summary: `occupations=${r.occupations} axes=${r.axes.length}`,
    };
  }));

  runs.push(await runProjection('worktypes', async () => {
    const r = await buildWorktypes(indexes, STAGE_DIST);
    return {
      files: r.files,
      summary: `occupations=${r.occupations} families=${r.families} adjustments=${r.adjustments}`,
    };
  }));
  return runs;
}

async function runDiscoveryProjections(indexes: Indexes): Promise<ProjectionRun[]> {
  const runs: ProjectionRun[] = [];
  runs.push(await runProjection('treemap', async () => {
    const r = await buildTreemap(indexes, STAGE_DIST);
    return { files: r.files, summary: `rows=${r.rows} top10=${r.top10Rows}` };
  }));

  runs.push(await runProjection('haid-spec', async () => {
    const r = await buildHaidSpec(STAGE_DIST);
    return { files: r.files, summary: `levels=${r.rows}` };
  }));

  runs.push(await runProjection('haid-release', async () => {
    const r = await buildHaidRelease(STAGE_DIST);
    return { files: r.files, summary: `releases=${r.releases.length} latest=${r.latest} +deprecated-stub` };
  }));

  runs.push(await runProjection('search', async () => {
    const r = await buildSearch(indexes, STAGE_DIST);
    return { files: r.files, summary: `documents=${r.documents}` };
  }));

  runs.push(await runProjection('transfer_paths', async () => {
    const r = await buildTransferPaths(indexes, STAGE_DIST);
    return {
      files: r.files,
      summary: `sources=${r.sources} primary=${r.summary.primary} fallback_no_safer=${r.summary.fallback_no_safer_in_sector}`,
    };
  }));

  runs.push(await runProjection('detail', async () => {
    const r = await buildDetail(indexes, STAGE_DIST);
    return { files: [r.dir], summary: `files=${r.fileCount}` };
  }));
  return runs;
}

async function runModelProjections(indexes: Indexes): Promise<ProjectionRun[]> {
  const runs: ProjectionRun[] = [];
  // ───── "Future" projections (mirror Python --enable-future order).
  //       After Step 12 cleanup tasks / featured remain removed. ─────
  runs.push(await runProjection('score-history', async () => {
    const r = await buildScoreHistory(indexes, STAGE_DIST);
    return { files: r.files, summary: `occupations=${r.occupations} entries=${r.entries}` };
  }));

  runs.push(await runProjection('models-deep', async () => {
    const r = await buildModelsDeep(indexes, STAGE_DIST);
    return {
      files: r.files,
      summary: `cards=${r.modelCards} consensus=${r.consensus} stories=${r.stories} bytes=${r.bytes}`,
    };
  }));

  runs.push(await runProjection('models-by-model', async () => {
    const r = await buildModelsByModel(indexes, STAGE_DIST);
    return {
      files: r.files,
      summary: `models=${r.models} max_page_bytes=${r.maxPageBytes}`,
    };
  }));

  runs.push(await runProjection('skills', async () => {
    const r = await buildSkills(indexes, STAGE_DIST);
    return { files: [r.dir, r.indexFile], summary: `skill_files=${r.skillFiles}` };
  }));

  runs.push(await runProjection('holland', async () => {
    const r = await buildHolland(indexes, STAGE_DIST);
    return { files: r.files, summary: `rows=${r.rows}` };
  }));
  return runs;
}

async function runGraphAndGeoProjections(indexes: Indexes): Promise<ProjectionRun[]> {
  const runs: ProjectionRun[] = [];
  // RA-134 (2026-05-18): me-positions.json — per-job rank in every
  // ranking. Doesn't consume `indexes` (it operates on the graph + the
  // views/ranking layer to mirror buildRankings exactly), but lives in
  // the same projection slot so output cleanup + atomic promote
  // naturally cover it. Called after holland so the rank list is
  // stable for the run.
  runs.push(await runProjection('me-positions', async () => {
    const r = await buildMePositions(STAGE_DIST);
    return {
      files: r.files,
      summary: `jobs=${r.jobCount} rankings=${r.rankingCount}`,
    };
  }));

  // Issue #10: GEO surfaces are generated from the same facts as the public
  // data projection, so llms*.txt and homepage JSON-LD cannot drift after a
  // score-batch update.
  runs.push(await runProjection('geo-surfaces', async () => {
    const r = await buildGeoSurfaces(indexes, STAGE_DIST, REPO_ROOT);
    return { files: r.files, summary: r.summary };
  }));
  return runs;
}

function logProjectionRuns(runs: readonly ProjectionRun[]): void {
  for (const r of runs) {
    console.log(`     [OK] ${r.name.padEnd(18)} ${String(r.durationMs).padStart(5)}ms  ${r.summary}`);
  }
}

async function discardStagedOutputs(): Promise<void> {
  await rm(STAGE_DIST, { recursive: true, force: true }).catch(() => {});
}

async function runProjection(
  name: string,
  fn: () => Promise<{ files: string[]; summary: string }>,
): Promise<ProjectionRun> {
  const t0 = Date.now();
  const result = await fn();
  return {
    name,
    files: result.files,
    durationMs: Date.now() - t0,
    summary: result.summary,
  };
}

main().catch(async (err) => {
  console.error('TS ETL crashed:', err);
  // Defense in depth: stage dir should already be cleaned by main(), but if
  // an error escapes from outside the try block we still don't want to
  // leave a `public.tmp-<pid>/` orphan.
  await discardStagedOutputs();
  process.exit(1);
});
