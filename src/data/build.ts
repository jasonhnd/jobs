/**
 * TS ETL orchestrator — entry point for `npm run build:data:ts`.
 *
 * Loads + validates source data, runs all migrated projections, writes them
 * to `dist-ts/`. Coexists with the legacy Python pipeline (`npm run build:data`)
 * which writes to `dist/`. Use `npm run diff:projections <file>` to compare.
 *
 * Per docs/MIGRATION_PLAN.md:
 *   - Track B-1 (PR 3): stub — load + validate only.
 *   - Track B-3 (PR 8+): each PR adds one projection; byte-diff vs Python.
 *
 * Exit code:
 *   0 — clean run (validation + all enabled projections succeed).
 *   1 — at least one validation or projection error.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildIndexes } from './lib/indexes.js';
// (build:data:ts had output to ./dist-ts/ for byte-diff; now writes to ./dist/
// so the existing Python HTML generators that read dist/ keep working until
// Track D replaces them with Astro pages.)
import { buildDetail } from './projections/detail.js';
import { buildFeatured } from './projections/featured.js';
import { buildHolland } from './projections/holland.js';
import { buildLabels } from './projections/labels.js';
import { buildProfile5 } from './projections/profile5.js';
import { buildScoreHistory } from './projections/score_history.js';
import { buildSearch } from './projections/search.js';
import { buildSectors } from './projections/sectors.js';
import { buildSkills } from './projections/skills.js';
import { buildTasks } from './projections/tasks.js';
import { buildTransferPaths } from './projections/transfer_paths.js';
import { buildTreemap } from './projections/treemap.js';

const REPO_ROOT = process.cwd();
// `BUILD_DATA_OUT_DIR=...` overrides the output directory (used by the diff
// workflow during Track B-3 verification: BUILD_DATA_OUT_DIR=dist-ts).
const TS_DIST = process.env.BUILD_DATA_OUT_DIR
  ? join(REPO_ROOT, process.env.BUILD_DATA_OUT_DIR)
  : join(REPO_ROOT, 'dist');

interface ProjectionRun {
  name: string;
  files: string[];
  durationMs: number;
  summary: string;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  console.log('TS ETL · running');
  console.log(`  output dir: ${TS_DIST}\n`);

  // ───── L1+L2: load + validate everything ─────
  console.log('  [L1+L2] loading + validating sources …');
  const { indexes, errors } = await buildIndexes();

  if (errors.length > 0) {
    console.error(`\n  ✗ ${errors.length} validation error(s):`);
    for (const err of errors.slice(0, 10)) {
      console.error(`    ${err.file}: ${err.message}`);
    }
    if (errors.length > 10) {
      console.error(`    … and ${errors.length - 10} more`);
    }
    process.exit(1);
  }

  console.log(`  ✓ all source files valid`);
  console.log(`     occupations:        ${indexes.occById.size}`);
  console.log(`     translations:       ${indexes.transById.size}`);
  console.log(`     stats_legacy:       ${indexes.statsById.size}`);
  console.log(`     score histories:    ${indexes.historyByOcc.size}`);
  console.log(`     latest scores:      ${indexes.latestScoreByOcc.size}`);
  console.log(`     labels dimensions:  ${indexes.labelsByDim.size}`);
  console.log(`     sectors:            ${indexes.sectors.length}`);

  // ───── Prepare output dir ─────
  await mkdir(TS_DIST, { recursive: true });

  // ───── Run projections ─────
  console.log('\n  [build] running projections …');
  const runs: ProjectionRun[] = [];

  // sectors: must run first (others may depend on sector_id derivations).
  runs.push(await runProjection('sectors', async () => {
    const r = await buildSectors(indexes, TS_DIST);
    return {
      files: r.files,
      summary: r.skipped ?? `sectors=${r.sectors} uncategorized=${r.uncategorized} ambiguous=${r.ambiguous}`,
    };
  }));

  runs.push(await runProjection('labels', async () => {
    const r = await buildLabels(indexes, TS_DIST);
    return { files: r.files, summary: `dimensions=${r.dimensions}` };
  }));

  runs.push(await runProjection('profile5', async () => {
    const r = await buildProfile5(indexes, TS_DIST);
    return {
      files: r.files,
      summary: `occupations=${r.occupations} axes=${r.axes.length}`,
    };
  }));

  runs.push(await runProjection('treemap', async () => {
    const r = await buildTreemap(indexes, TS_DIST);
    return { files: r.files, summary: `rows=${r.rows}` };
  }));

  runs.push(await runProjection('search', async () => {
    const r = await buildSearch(indexes, TS_DIST);
    return { files: r.files, summary: `documents=${r.documents}` };
  }));

  runs.push(await runProjection('transfer_paths', async () => {
    const r = await buildTransferPaths(indexes, TS_DIST);
    return {
      files: r.files,
      summary: `sources=${r.sources} primary=${r.summary.primary} fallback_no_safer=${r.summary.fallback_no_safer_in_sector}`,
    };
  }));

  runs.push(await runProjection('detail', async () => {
    const r = await buildDetail(indexes, TS_DIST);
    return { files: [r.dir], summary: `files=${r.fileCount}` };
  }));

  // ───── Future projections (mirror Python --enable-future order) ─────
  runs.push(await runProjection('tasks', async () => {
    const r = await buildTasks(indexes, TS_DIST);
    return { files: [r.dir], summary: `files=${r.fileCount}` };
  }));

  runs.push(await runProjection('skills', async () => {
    const r = await buildSkills(indexes, TS_DIST);
    return { files: [r.dir, r.indexFile], summary: `skill_files=${r.skillFiles}` };
  }));

  runs.push(await runProjection('holland', async () => {
    const r = await buildHolland(indexes, TS_DIST);
    return { files: r.files, summary: `rows=${r.rows}` };
  }));

  runs.push(await runProjection('featured', async () => {
    const r = await buildFeatured(indexes, TS_DIST);
    return {
      files: r.files,
      summary: `picked=${r.picked} pool=${r.candidatePool}`,
    };
  }));

  runs.push(await runProjection('score_history', async () => {
    const r = await buildScoreHistory(indexes, TS_DIST);
    return { files: [r.dir], summary: `files=${r.fileCount}` };
  }));

  for (const r of runs) {
    console.log(`     ✓ ${r.name.padEnd(18)} ${String(r.durationMs).padStart(5)}ms  ${r.summary}`);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\n  done in ${elapsed}s`);
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

main().catch((err) => {
  console.error('TS ETL crashed:', err);
  process.exit(1);
});
