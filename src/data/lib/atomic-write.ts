/**
 * Atomic dist/ replacement — per docs/DATA_ARCHITECTURE.md §7.6.3.
 *
 * Write the entire build to a staging directory, then swap atomically. If the
 * build fails midway, the existing dist/ is untouched.
 *
 * Usage:
 *   const atomic = new AtomicDist('./dist-ts');
 *   const staging = await atomic.begin();
 *   try {
 *     // write all projection outputs into `staging`
 *     ...
 *     await atomic.commit();
 *   } catch (err) {
 *     await atomic.rollback();
 *     throw err;
 *   }
 *
 * Migrated from scripts/lib/atomic_write.py (the Python version uses a context
 * manager; TS uses explicit begin/commit/rollback).
 */
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';

export class AtomicDist {
  readonly distRoot: string;
  readonly staging: string;
  readonly previous: string;

  constructor(distRoot: string) {
    this.distRoot = distRoot;
    const parent = dirname(distRoot);
    const name = basename(distRoot);
    this.staging = join(parent, `${name}.next`);
    this.previous = join(parent, `${name}.prev`);
  }

  /** Create a clean staging dir and return its path. */
  async begin(): Promise<string> {
    await rmIfExists(this.staging);
    await mkdir(this.staging, { recursive: true });
    return this.staging;
  }

  /**
   * Atomic-ish swap:
   *   1. rename old dist/ → dist.prev/
   *   2. rename dist.next/ → dist/
   *   3. rmtree dist.prev/
   *
   * If step 1 or 2 fails, dist/ is restored from dist.prev/ before re-throwing.
   */
  async commit(): Promise<void> {
    await rmIfExists(this.previous);
    if (await exists(this.distRoot)) {
      await rename(this.distRoot, this.previous);
    }
    try {
      await rename(this.staging, this.distRoot);
    } catch (err) {
      if (await exists(this.previous)) {
        await rename(this.previous, this.distRoot);
      }
      throw err;
    }
    await rmIfExists(this.previous);
  }

  /** Discard the staging dir, leave dist/ untouched. Safe to call multiple times. */
  async rollback(): Promise<void> {
    await rmIfExists(this.staging);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function rmIfExists(path: string): Promise<void> {
  if (await exists(path)) {
    await rm(path, { recursive: true, force: true });
  }
}
