/**
 * TS ETL orchestrator — entry point for `npm run build:data`.
 *
 * Loads + validates source data, runs all 12 projections, writes them to
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
import { mkdir, rm, rename, readdir, cp, writeFile } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { buildIndexes } from './lib/indexes.js';
import { buildDetail } from './projections/detail.js';
import { buildHolland } from './projections/holland.js';
import { buildLabels } from './projections/labels.js';
import { buildProfile5 } from './projections/profile5.js';
import { buildSearch } from './projections/search.js';
import { buildSectors } from './projections/sectors.js';
import { buildSkills } from './projections/skills.js';
import { buildTransferPaths } from './projections/transfer_paths.js';
import { buildTreemap } from './projections/treemap.js';
// Removed in Step 12 (dead projection cleanup, 2026-05-13):
//   - buildFeatured / data.featured.json  (no runtime consumer)
//   - buildScoreHistory / data.score_history.json  (no runtime consumer)
//   - buildTasks / data.tasks/*.json  (no runtime consumer; the
//     556-file per-occupation tasks dump cost ~1.2 MB build output
//     and ~1.5s pipeline time for an output nobody reads)
// All three were "future projections" placeholders. test-consistency
// schema checks for these outputs were removed together. If a future
// feature needs them, restore from git history.

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
  console.log(`     labels dimensions:  ${indexes.labelsByDim.size}`);
  console.log(`     sectors:            ${indexes.sectors.length}`);

  // ───── Prepare staging dir ─────
  // Wipe any leftover stage from a crashed previous run, then create fresh.
  // TS_DIST is left untouched until every projection succeeds.
  await rm(STAGE_DIST, { recursive: true, force: true });
  await mkdir(STAGE_DIST, { recursive: true });

  // ───── Run projections (writes to STAGE_DIST) ─────
  console.log('\n  [build] running projections …');
  const runs: ProjectionRun[] = [];

  try {
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

    runs.push(await runProjection('treemap', async () => {
      const r = await buildTreemap(indexes, STAGE_DIST);
      return { files: r.files, summary: `rows=${r.rows}` };
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

    // ───── "Future" projections (mirror Python --enable-future order).
    //       After Step 12 cleanup only skills + holland remain — both
    //       are read by sector/hub pages. tasks / featured / score_history
    //       were removed. ─────
    runs.push(await runProjection('skills', async () => {
      const r = await buildSkills(indexes, STAGE_DIST);
      return { files: [r.dir, r.indexFile], summary: `skill_files=${r.skillFiles}` };
    }));

    runs.push(await runProjection('holland', async () => {
      const r = await buildHolland(indexes, STAGE_DIST);
      return { files: r.files, summary: `rows=${r.rows}` };
    }));
  } catch (err) {
    // Any projection failure: wipe staging so we don't leave half-written
    // outputs behind. Existing TS_DIST contents are NOT touched.
    await rm(STAGE_DIST, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  for (const r of runs) {
    console.log(`     [OK] ${r.name.padEnd(18)} ${String(r.durationMs).padStart(5)}ms  ${r.summary}`);
  }

  // ───── Atomic-ish promotion: STAGE_DIST → TS_DIST ─────
  // Per-file rename is atomic on POSIX. We can't atomically swap the whole
  // dir because TS_DIST also holds tracked SEO statics (og.png, robots.txt,
  // llms*.txt) that the ETL must NOT touch. Replacing per top-level entry
  // achieves the goal: a partial / failed run leaves the previous output
  // untouched; only fully-successful runs overwrite, and each entry is
  // swapped in O(1).
  //
  // Audit's #7.4: a crash mid-promote (disk full, OOM kill, …) could
  // leave half-old/half-new state on disk. We can't make this multi-step
  // truly atomic without a separate version directory, but we do mitigate:
  //   1. Write a per-run "promote-in-progress" sentinel BEFORE the loop.
  //   2. Replace it with a manifest listing the canonical entry set AFTER
  //      the loop completes.
  //   3. If a subsequent build starts and finds the sentinel still present,
  //      it indicates the previous promote crashed — log a clear warning so
  //      the operator can decide whether to wipe TS_DIST and rebuild.
  console.log('\n  [promote] STAGE_DIST → TS_DIST …');
  await mkdir(TS_DIST, { recursive: true });
  // Manifest lives OUTSIDE TS_DIST so it never gets served to the web
  // (publicDir is copied verbatim into dist-astro). We track it next to
  // the repo root in a gitignored .cache/ directory.
  const cacheDir = join(REPO_ROOT, '.cache', 'etl');
  await mkdir(cacheDir, { recursive: true });
  const sentinelPath = join(cacheDir, 'build-manifest.partial.json');
  const manifestPath = join(cacheDir, 'build-manifest.json');

  // Detect a leftover partial sentinel from a previous crash before we
  // start mutating the output. Don't fail — just warn — because the
  // previous build may have been killed before any promote happened,
  // in which case the current state is still consistent.
  try {
    const { readFile } = await import('node:fs/promises');
    const prev = await readFile(sentinelPath, 'utf-8');
    console.warn(
      `  [WARN] previous build left a partial-promote sentinel:\n    ${prev}\n` +
      `  TS_DIST may contain a mix of old + new files. Continuing — this build will overwrite.`,
    );
  } catch {
    // No sentinel — clean state.
  }

  const buildId = `${new Date().toISOString()}.pid${process.pid}`;
  await writeFile(
    sentinelPath,
    JSON.stringify({ status: 'in_progress', build_id: buildId, started_at: new Date().toISOString() }, null, 2),
  );

  const stagedEntries = await readdir(STAGE_DIST);
  for (const name of stagedEntries) {
    const from = join(STAGE_DIST, name);
    const to = join(TS_DIST, name);
    await rm(to, { recursive: true, force: true });
    try {
      await rename(from, to);
    } catch (err) {
      // EXDEV (cross-device) — fall back to recursive copy.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EXDEV') {
        await cp(from, to, { recursive: true });
        await rm(from, { recursive: true, force: true });
      } else {
        throw err;
      }
    }
  }

  // Promote succeeded. Write the manifest BEFORE clearing the sentinel
  // so a crash between these two writes still leaves a coherent record.
  await writeFile(
    manifestPath,
    JSON.stringify({
      status: 'ok',
      build_id: buildId,
      finished_at: new Date().toISOString(),
      promoted_entries: stagedEntries.sort(),
    }, null, 2),
  );
  await rm(sentinelPath, { force: true }).catch(() => {});
  await rm(STAGE_DIST, { recursive: true, force: true }).catch(() => {});

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`  done in ${elapsed}s`);
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
  await rm(STAGE_DIST, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
});
