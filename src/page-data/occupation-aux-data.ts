/**
 * src/page-data/occupation-aux-data.ts — lazy loaders for the
 * auxiliary public/data.* files consumed by the occupation
 * detail page renderers.
 *
 * Two files are read on first access and cached for the lifetime
 * of the build process:
 *
 *   public/data.profile5.json        — 5-axis ability profile per id
 *   public/data.transfer_paths.json  — career-transfer candidates per id
 *
 * Moved from src/views/ in Phase E (2026-05-15): this module does
 * fs I/O, which makes it a build-time orchestrator rather than a
 * pure view. The view layer is now fs-free.
 *
 * FUTURE — graph integration:
 *   Both data files are projections of source occupations (see
 *   src/data/projections/profile5.ts + transfer_paths.ts). The
 *   audit's medium-term recommendation is to wire those projection
 *   computations into src/graph/loader.ts so views/pages receive
 *   profile5 + transferPaths via the graph contract instead of via
 *   fs re-reads. Public data.*.json emission would still happen
 *   for browser consumers. Deferred — Phase E ships the directory
 *   relocation only; graph migration is a separate follow-up.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

interface Profile5File {
  profiles?: Record<string, Record<string, number | null>>;
}

export interface TransferCandidate {
  readonly id: number;
  readonly title_ja: string;
  readonly ai_risk: number | null;
  readonly similarity: number;
  readonly sector_id?: string;
}

export interface TransferPathEntry {
  readonly source_id: number;
  readonly candidates: ReadonlyArray<TransferCandidate>;
  readonly fallback?: string;
}

interface TransferPathsFile {
  paths?: Record<string, TransferPathEntry>;
}

/** Per-file paths under public/. Re-computed per call but cheap
 *  (the cache lives in the calling getter, not here). */
function auxPaths(): { profile5: string; transfer: string } {
  const repo = path.resolve(process.cwd());
  return {
    profile5: path.join(repo, 'public', 'data.profile5.json'),
    transfer: path.join(repo, 'public', 'data.transfer_paths.json'),
  };
}

/**
 * Read + parse a JSON file, returning `null` on any failure
 * (missing file, unreadable bytes, invalid JSON). Used by the
 * two lazy getters below; exported so the fallback-path
 * behaviour can be unit-tested directly. Pure given the
 * filesystem state at call time.
 */
export function readJsonSafe<T = unknown>(p: string): T | null {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

let _profile5: Record<string, Record<string, number | null>> | null = null;

/** Returns the profile5 map keyed by occupation id. Cached on
 *  first call. Missing/unreadable file → empty map. */
export function getProfile5(): Record<string, Record<string, number | null>> {
  if (_profile5 === null) {
    _profile5 = (readJsonSafe<Profile5File>(auxPaths().profile5) ?? {}).profiles ?? {};
  }
  return _profile5;
}

let _transferPaths: Record<string, TransferPathEntry> | null = null;

/** Returns the transfer-paths map keyed by occupation id. Cached
 *  on first call. Missing/unreadable file → empty map. */
export function getTransferPaths(): Record<string, TransferPathEntry> {
  if (_transferPaths === null) {
    _transferPaths = (readJsonSafe<TransferPathsFile>(auxPaths().transfer) ?? {}).paths ?? {};
  }
  return _transferPaths;
}
