/**
 * Transactional promote of a staged ETL directory into the publish directory.
 *
 * Extracted from build.ts so tests can inject the filesystem. build.ts calls
 * this with no overrides, so `bun src/data/build.ts` keeps the previous
 * CODE-001 / CODE-002 behavior.
 */
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PromoteFs {
  mkdir(path: string, options: { recursive: boolean }): Promise<unknown>;
  rm(path: string, options: { recursive?: boolean; force?: boolean }): Promise<unknown>;
  rename(from: string, to: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  readdirWithFileTypes(path: string): Promise<Array<{ name: string }>>;
  cp(from: string, to: string, options: { recursive: boolean }): Promise<unknown>;
  writeFile(path: string, data: string): Promise<void>;
  readFile(path: string, encoding: 'utf-8'): Promise<string>;
  access(path: string): Promise<void>;
}

const nodeFs: PromoteFs = {
  mkdir: (path, options) => mkdir(path, options),
  rm: (path, options) => rm(path, options),
  rename: (from, to) => rename(from, to),
  readdir: (path) => readdir(path),
  readdirWithFileTypes: (path) => readdir(path, { withFileTypes: true }),
  cp: (from, to, options) => cp(from, to, options),
  writeFile: (path, data) => writeFile(path, data),
  readFile: (path, encoding) => readFile(path, encoding),
  access: (path) => access(path),
};

/** EBUSY/EPERM/EACCES retries: 100ms, 300ms, 900ms. EXDEV is not retried. */
const RETRY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);
const RETRY_DELAYS_MS = [100, 300, 900];

export interface PromoteStagedOutputsOptions {
  stageDir: string;
  outDir: string;
  cacheDir: string;
  /**
   * Replaces individual filesystem calls. Omitted methods use node:fs/promises.
   * build.ts passes nothing.
   */
  fs?: Partial<PromoteFs>;
  /** Defaults to setTimeout. Tests pass a fake so retry coverage does not wait. */
  sleep?: (ms: number) => Promise<void>;
  log?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultLog(...args: unknown[]): void {
  console.log(...args);
}

function defaultWarn(...args: unknown[]): void {
  console.warn(...args);
}

function defaultError(...args: unknown[]): void {
  console.error(...args);
}

/**
 * Move every top-level entry in `stageDir` into `outDir`.
 *
 * Per-file rename is atomic on POSIX. The whole directory cannot be swapped
 * because `outDir` also holds tracked SEO statics (og.png, robots.txt,
 * llms*.txt) that the ETL must not touch. A failed run leaves the previous
 * output in place; only a fully successful run overwrites, one entry at a time.
 *
 * A crash mid-promote can still leave a mix of old and new entries. Mitigation:
 *   1. Write a per-run "promote-in-progress" sentinel BEFORE the loop.
 *   2. Replace it with a manifest listing the canonical entry set AFTER
 *      the loop completes.
 *   3. If a later build finds the sentinel, the previous promote crashed.
 *      Log a warning. The operator decides whether to wipe the output.
 *
 * Per entry: rename current → backup, then staged → current. On failure,
 * restore every entry that already moved. Delete backups only after all
 * entries succeed. EBUSY/EPERM/EACCES retry 3 times. EXDEV falls back to
 * copy + remove for every move, rollback included; a failed copy removes its
 * partial destination, and a restore removes whatever sits at the target
 * first, so a half-copied directory never blocks it.
 *
 * Backups live under `cacheDir`, never in `outDir`: `outDir` is copied
 * verbatim into the deploy, so a backup left by a failed rollback must not
 * sit there. A successful promote also moves older `data*.backup-*` leftovers
 * out of `outDir` into `cacheDir/stale-promote-backups/`.
 */
export async function promoteStagedOutputs(options: PromoteStagedOutputsOptions): Promise<void> {
  const fs: PromoteFs = { ...nodeFs, ...options.fs };
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? defaultLog;
  const warn = options.warn ?? defaultWarn;
  const error = options.error ?? defaultError;
  const { stageDir, outDir, cacheDir } = options;

  async function pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (err) {
        lastErr = err;
        const code = (err as NodeJS.ErrnoException).code;
        // EXDEV: cross-device, can't be retried; copy fallback handled
        // by caller. RETRY_CODES: transient on Windows, try again.
        if (code === 'EXDEV') throw err;
        if (!RETRY_CODES.has(code || '')) throw err;
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }
    throw lastErr;
  }

  /**
   * Move `from` to `to`. On EXDEV, copy then remove the source; a copy that
   * fails part-way removes its partial destination so `from` stays the only
   * copy. `onPlaced` runs once `to` holds a complete copy.
   */
  async function moveEntry(from: string, to: string, onPlaced: () => void = () => {}): Promise<void> {
    try {
      await renameWithRetry(from, to);
      onPlaced();
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
    }
    try {
      await fs.cp(from, to, { recursive: true });
    } catch (copyErr) {
      await fs.rm(to, { recursive: true, force: true }).catch(() => {});
      throw copyErr;
    }
    onPlaced();
    await fs.rm(from, { recursive: true, force: true });
  }

  log('\n  [promote] STAGE_DIST → TS_DIST …');
  await fs.mkdir(outDir, { recursive: true });
  // Manifest lives OUTSIDE the publish dir so it never gets served
  // (publicDir is copied verbatim into dist-astro). build.ts passes
  // `<repo>/.cache/etl`, which is gitignored.
  await fs.mkdir(cacheDir, { recursive: true });
  const sentinelPath = join(cacheDir, 'build-manifest.partial.json');
  const manifestPath = join(cacheDir, 'build-manifest.json');

  // Detect a leftover partial sentinel from a previous crash before we
  // start mutating the output. Don't fail — just warn — because the
  // previous build may have been killed before any promote happened,
  // in which case the current state is still consistent.
  try {
    const prev = await fs.readFile(sentinelPath, 'utf-8');
    warn(
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
      warn('[build] partial-sentinel read unexpected error:', err);
    }
  }

  const buildId = `${new Date().toISOString()}.pid${process.pid}`;
  await fs.writeFile(
    sentinelPath,
    JSON.stringify({ status: 'in_progress', build_id: buildId, started_at: new Date().toISOString() }, null, 2),
  );

  const stagedEntries = await fs.readdir(stageDir);
  // Track per-entry status so rollback knows what to undo.
  // - 'pending': not yet started
  // - 'backed-up': old → backup done, staged → current not started
  // - 'promoted': staged → current done, backup retained until success
  type EntryStatus = 'pending' | 'backed-up' | 'promoted';
  const entryStatus = new Map<string, EntryStatus>();
  for (const name of stagedEntries) entryStatus.set(name, 'pending');

  // Outside outDir, so a backup kept after a failed rollback is never deployed.
  const backupDir = join(cacheDir, `promote.backup-${buildId.replace(/[:.]/g, '-')}`);
  await fs.mkdir(backupDir, { recursive: true });
  const backupOf = (name: string): string => join(backupDir, name);

  try {
    for (const name of stagedEntries) {
      const from = join(stageDir, name);
      const to = join(outDir, name);
      const markBackedUp = (): void => {
        entryStatus.set(name, 'backed-up');
      };

      // Step 1: move current → backup (if current exists).
      if (await pathExists(to)) await moveEntry(to, backupOf(name), markBackedUp);
      markBackedUp();

      // Step 2: move staged → current.
      await moveEntry(from, to, () => {
        entryStatus.set(name, 'promoted');
      });
    }
  } catch (promoteErr) {
    // Rollback: any 'promoted' or 'backed-up' entries must be restored.
    error(
      `\n  [promote] FAILED — rolling back ${entryStatus.size} entries:`,
      promoteErr instanceof Error ? promoteErr.message : String(promoteErr),
    );
    let rollbackFailed = false;
    for (const [name, status] of entryStatus) {
      // 'pending' entries were never touched.
      if (status === 'pending') continue;
      const to = join(outDir, name);
      const backup = backupOf(name);
      try {
        // Remove the new or half-copied content first, so restoring never
        // hits ENOTEMPTY and never leaves a partial directory in place.
        await fs.rm(to, { recursive: true, force: true });
        if (await pathExists(backup)) await moveEntry(backup, to);
      } catch (rollbackErr) {
        rollbackFailed = true;
        error(
          `  [promote] rollback of ${name} also failed:`,
          rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        );
        if (await pathExists(backup)) error(`  [promote] previous ${name} is kept at ${backup}`);
      }
    }
    if (!rollbackFailed) await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});
    throw promoteErr;
  }

  // All entries promoted successfully — clean up backups.
  for (const name of stagedEntries) {
    await fs.rm(backupOf(name), { recursive: true, force: true }).catch((err) => {
      // Backup cleanup failure is not fatal — the build itself succeeded,
      // just log it so an operator notices accumulating backup directories.
      warn(`  [promote] backup cleanup failed for ${name}:`, err.message);
    });
  }
  await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});

  // Promote succeeded. Write the manifest BEFORE clearing the sentinel
  // so a crash between these two writes still leaves a coherent record.
  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      status: 'ok',
      build_id: buildId,
      finished_at: new Date().toISOString(),
      promoted_entries: stagedEntries.sort(),
    }, null, 2),
  );
  await fs.rm(sentinelPath, { force: true }).catch(() => {});
  await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});

  // Prune stale publish entries that a previous build emitted but this
  // build no longer includes. The manifest is the source of truth for
  // what this build owns. Anything matching `data.*` / `data-` outside
  // the manifest is orphaned and deleted.
  //
  // Entries that don't match (og.png, robots.txt, llms.txt, and any
  // operator-placed file) are never touched. Names containing
  // `.backup-` belong to a failed prior promote: they are not deleted, but
  // moved out of the publish dir so they are never deployed.
  const managedSet = new Set(stagedEntries);
  const allEntries = await fs.readdirWithFileTypes(outDir);
  const orphaned: string[] = [];
  const staleBackups: string[] = [];
  for (const ent of allEntries) {
    const name = ent.name;
    if (!name.startsWith('data.') && !name.startsWith('data-')) continue;
    if (managedSet.has(name)) continue;
    if (name.includes('.backup-')) staleBackups.push(name);
    else orphaned.push(name);
  }
  if (staleBackups.length > 0) {
    const staleDir = join(cacheDir, 'stale-promote-backups');
    await fs.mkdir(staleDir, { recursive: true });
    warn(`  [promote] moved ${staleBackups.length} leftover backup(s) out of the publish dir into ${staleDir}:`);
    for (const name of staleBackups) {
      warn(`    - ${name}`);
      const target = join(staleDir, name);
      await fs.rm(target, { recursive: true, force: true });
      await moveEntry(join(outDir, name), target);
    }
  }
  if (orphaned.length > 0) {
    log(`  [cleanup] removing ${orphaned.length} orphaned public/data.* entries:`);
    for (const name of orphaned) {
      log(`    - ${name}`);
      await fs.rm(join(outDir, name), { recursive: true, force: true });
    }
  }
}
