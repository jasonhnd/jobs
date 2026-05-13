/**
 * src/views/occupation-aux-data.ts — lazy loaders for the
 * auxiliary public/data.* files consumed by the occupation
 * detail page renderers.
 *
 * Extracted from src/pages/ja/[id].astro's module-scope getters.
 * Two files are read on first access and cached for the lifetime
 * of the build process:
 *
 *   public/data.profile5.json        — 5-axis ability profile per id
 *   public/data.transfer_paths.json  — career-transfer candidates per id
 *
 * The Step 8 architecture migration is gradually shifting both of
 * these onto the graph; until that lands, the page reads the
 * legacy JSON files directly. View layer is allowed `node:fs`
 * during this transition (see scripts/check-architecture.cjs).
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

function readJsonSafe<T = unknown>(p: string): T | null {
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
