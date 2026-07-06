/**
 * TS ETL orchestrator — entry point for `npm run build:data`.
 *
 * Loads + validates source data, runs all 13 projections, writes them to
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
import { mkdir, rm, rename, readdir, cp, writeFile, access } from 'node:fs/promises';
import { basename, dirname, join, resolve, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';

// Used by the transactional promote (CODE-001 fix).
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
import { buildIndexes } from './lib/indexes.js';
import { buildDetail } from './projections/detail.js';
import { buildHolland } from './projections/holland.js';
import { buildLabels } from './projections/labels.js';
import { buildMePositions } from './projections/me-positions.js';
import { buildProfile5 } from './projections/profile5.js';
import { buildSearch } from './projections/search.js';
import { buildSectors } from './projections/sectors.js';
import { buildSkills } from './projections/skills.js';
import { buildTransferPaths } from './projections/transfer_paths.js';
import { buildTreemap } from './projections/treemap.js';
import { buildAiAdoption } from './projections/ai-adoption.js';
import { buildWorktypes } from './projections/worktypes.js';
import { formatModelDisplay } from '../site/score-attribution.js';
import { buildGeoSurfaces } from '../site/geo-build.js';
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

  // ───── Update src/lib/_content-date.ts (content-derived dateModified) ─────
  // Every template that emits `dateModified` in its JSON-LD imports
  // CONTENT_DATE from src/lib/_content-date.ts. We rewrite the file here so
  // the freshness signal tracks the actual latest score-run date instead of a
  // hardcoded calendar constant. Writes only on change → working tree stays
  // clean across rebuilds that don't introduce new scores.
  {
    let latestDate = '';
    let latestModel = '';
    for (const score of indexes.latestScoreByOcc.values()) {
      if (score.date && score.date > latestDate) {
        latestDate = score.date;
        latestModel = score.model;
      }
    }
    const { readFile } = await import('node:fs/promises');

    const contentDate = latestDate || '2026-05-30';
    const contentDatePath = join(REPO_ROOT, 'src/lib/_content-date.ts');
    const existing = await readFile(contentDatePath, 'utf-8').catch(() => '');
    const updated = existing.replace(
      /CONTENT_DATE = '[^']*'/,
      `CONTENT_DATE = '${contentDate}'`,
    );
    if (updated && updated !== existing) {
      await writeFile(contentDatePath, updated, 'utf-8');
      console.log(`  [content-date] updated to ${contentDate}`);
    } else {
      console.log(`  [content-date] ${contentDate} (unchanged)`);
    }

    // Active score attribution (model + date) → generated fs-free module, so
    // src/site/score-attribution.ts carries no node:fs into the Edge bundle.
    const runDate = latestDate || '2026-05-30';
    const modelId = latestModel || 'claude-opus-4-8';
    const modelDisplay = formatModelDisplay(modelId);
    const attrPath = join(REPO_ROOT, 'src/site/_score-attribution.ts');
    const attrExisting = await readFile(attrPath, 'utf-8').catch(() => '');
    const attrUpdated = attrExisting
      .replace(/modelId: '[^']*'/, `modelId: '${modelId}'`)
      .replace(/modelDisplay: '[^']*'/, `modelDisplay: '${modelDisplay}'`)
      .replace(/runDate: '[^']*'/, `runDate: '${runDate}'`);
    if (attrUpdated && attrUpdated !== attrExisting) {
      await writeFile(attrPath, attrUpdated, 'utf-8');
      console.log(`  [score-attribution] ${modelDisplay} (${runDate})`);
    } else {
      console.log(`  [score-attribution] ${modelDisplay} (${runDate}) (unchanged)`);
    }
  }

  // ───── Prepare staging dir ─────
  // Wipe any leftover stage from a crashed previous run, then create fresh.
  // TS_DIST is left untouched until every projection succeeds.
  await rm(STAGE_DIST, { recursive: true, force: true });

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

    runs.push(await runProjection('worktypes', async () => {
      const r = await buildWorktypes(indexes, STAGE_DIST);
      return {
        files: r.files,
        summary: `occupations=${r.occupations} families=${r.families} adjustments=${r.adjustments}`,
      };
    }));

    runs.push(await runProjection('treemap', async () => {
      const r = await buildTreemap(indexes, STAGE_DIST);
      return { files: r.files, summary: `rows=${r.rows} top10=${r.top10Rows}` };
    }));

    runs.push(await runProjection('ai-adoption', async () => {
      const r = await buildAiAdoption(STAGE_DIST);
      return { files: r.files, summary: `layers=${r.rows}` };
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
  } catch (err) {
    // Expected on clean state (ENOENT): no sentinel present.
    // Surface any other error so Windows file-lock / permission issues
    // (EPERM, EBUSY, antivirus-locked files) don't masquerade as a
    // clean state.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.warn('[build] partial-sentinel read unexpected error:', err);
    }
  }

  const buildId = `${new Date().toISOString()}.pid${process.pid}`;
  await writeFile(
    sentinelPath,
    JSON.stringify({ status: 'in_progress', build_id: buildId, started_at: new Date().toISOString() }, null, 2),
  );

  // 2026-05-17 CODE-001 fix: transactional promote with rollback.
  //
  // Previously this loop did `rm(to)` THEN `rename(from, to)`. If
  // rename failed (EBUSY on Windows + Dropbox / antivirus / file
  // indexer locking the target dir), `to` was already gone — the
  // build crashed leaving public/data.* in a half-old/half-new
  // state. Encountered ~5 times during the deep-audit session and
  // the audit team flagged it as P0.
  //
  // New flow per-entry: rename current → backup, rename staged →
  // current. If anything fails, undo by restoring the backup. Only
  // when ALL entries succeed do we delete the backups. Per-entry
  // backups (not a single root-level backup) so a midway failure
  // can roll back ONLY the entries that already moved, leaving
  // earlier ones in their new state to be re-tried, AND leaving
  // later ones in their old state (still correct).
  //
  // EBUSY/EPERM retries (3x with exponential backoff: 100ms, 300ms,
  // 900ms) before declaring failure — Windows file locks are
  // typically transient (antivirus scan, Dropbox sync chunk).

  const RETRY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);
  const RETRY_DELAYS_MS = [100, 300, 900];

  async function renameWithRetry(from: string, to: string): Promise<void> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        await rename(from, to);
        return;
      } catch (err) {
        lastErr = err;
        const code = (err as NodeJS.ErrnoException).code;
        // EXDEV: cross-device, can't be retried; copy fallback handled
        // by caller. RETRY_CODES: transient on Windows, try again.
        if (code === 'EXDEV') throw err;
        if (!RETRY_CODES.has(code || '')) throw err;
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        }
      }
    }
    throw lastErr;
  }

  const stagedEntries = await readdir(STAGE_DIST);
  // Track per-entry status so rollback knows what to undo.
  // - 'pending': not yet started
  // - 'backed-up': old → backup done, staged → current not started
  // - 'promoted': staged → current done, backup retained until success
  type EntryStatus = 'pending' | 'backed-up' | 'promoted';
  const entryStatus = new Map<string, EntryStatus>();
  for (const name of stagedEntries) entryStatus.set(name, 'pending');

  const backupSuffix = `.backup-${buildId.replace(/[:.]/g, '-')}`;

  try {
    for (const name of stagedEntries) {
      const from = join(STAGE_DIST, name);
      const to = join(TS_DIST, name);
      const backup = join(TS_DIST, `${name}${backupSuffix}`);

      // Step 1: move current → backup (if current exists).
      const currentExists = await pathExists(to);
      if (currentExists) {
        try {
          await renameWithRetry(to, backup);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === 'EXDEV') {
            await cp(to, backup, { recursive: true });
            await rm(to, { recursive: true, force: true });
          } else {
            throw err;
          }
        }
      }
      entryStatus.set(name, 'backed-up');

      // Step 2: move staged → current.
      try {
        await renameWithRetry(from, to);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EXDEV') {
          await cp(from, to, { recursive: true });
          await rm(from, { recursive: true, force: true });
        } else {
          throw err;
        }
      }
      entryStatus.set(name, 'promoted');
    }
  } catch (promoteErr) {
    // Rollback: any 'promoted' or 'backed-up' entries must be restored.
    console.error(
      `\n  [promote] FAILED — rolling back ${entryStatus.size} entries:`,
      promoteErr instanceof Error ? promoteErr.message : String(promoteErr),
    );
    for (const [name, status] of entryStatus) {
      const to = join(TS_DIST, name);
      const backup = join(TS_DIST, `${name}${backupSuffix}`);
      try {
        if (status === 'promoted') {
          // Restore: remove the new content, rename backup back.
          await rm(to, { recursive: true, force: true });
          if (await pathExists(backup)) {
            await renameWithRetry(backup, to);
          }
        } else if (status === 'backed-up') {
          // We removed the old but never put the new in place — restore old.
          if (await pathExists(backup)) {
            await renameWithRetry(backup, to);
          }
        }
        // 'pending' entries were never touched.
      } catch (rollbackErr) {
        console.error(
          `  [promote] rollback of ${name} also failed:`,
          rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        );
      }
    }
    throw promoteErr;
  }

  // All entries promoted successfully — clean up backups.
  for (const name of stagedEntries) {
    const backup = join(TS_DIST, `${name}${backupSuffix}`);
    await rm(backup, { recursive: true, force: true }).catch((err) => {
      // Backup cleanup failure is not fatal — the build itself succeeded,
      // just log it so an operator notices accumulating .backup-* directories.
      console.warn(`  [promote] backup cleanup failed for ${name}:`, err.message);
    });
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

  // 2026-05-17 CODE-002 fix: prune stale public/data.* entries that
  // a previous build emitted but the current build no longer
  // includes. Examples flagged by external audit:
  //   - data.featured.json  (removed Step 12)
  //   - data.score-history/ (removed Step 12)
  //   - data.tasks/         (removed Step 12)
  // These still shipped to prod via Astro publicDir → dist-astro,
  // exposing stale APIs. The manifest IS the source of truth for
  // "what this build owns"; anything matching `data.*` in TS_DIST
  // outside the manifest is treated as orphaned and deleted.
  //
  // Files/dirs in TS_DIST that don't match `data.*` (e.g. og.png,
  // robots.txt, llms.txt — Astro static input) are NEVER touched.
  const managedSet = new Set(stagedEntries);
  const allEntries = await readdir(TS_DIST, { withFileTypes: true });
  const orphaned: string[] = [];
  for (const ent of allEntries) {
    const name = ent.name;
    // Only manage data.* — leave SEO statics (robots.txt, og.png,
    // llms.txt, map-thumb.snippet.html, etc.) and any operator-
    // hand-placed file alone.
    if (!name.startsWith('data.') && !name.startsWith('data-')) continue;
    if (managedSet.has(name)) continue;
    // Don't touch backups left from a failed prior promote — they
    // get cleaned up by their own promote success path.
    if (name.includes('.backup-')) continue;
    orphaned.push(name);
  }
  if (orphaned.length > 0) {
    console.log(`  [cleanup] removing ${orphaned.length} orphaned public/data.* entries:`);
    for (const name of orphaned) {
      console.log(`    - ${name}`);
      await rm(join(TS_DIST, name), { recursive: true, force: true });
    }
  }

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
