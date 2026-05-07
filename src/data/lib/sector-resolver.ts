/**
 * Resolve occupation → sector — per docs/DATA_ARCHITECTURE.md §6.11.
 *
 * Pure functional core; no I/O. Used by both the sector projection (writes
 * data.sectors.json + review_queue) and treemap (decorates each tile with
 * sector_id / sector_ja / hue).
 *
 * Resolution rule (see also src/data/schema/sector.ts docstring):
 *   1. overrides[padded_id] wins, if present.
 *   2. Glob-match occ.classifications.mhlw_main against every sector's
 *      seed_codes:
 *        - 1 match → that sector wins.
 *        - 0 matches → "_uncategorized".
 *        - >1 matches → first match wins, ambiguous flag set.
 *   3. No mhlw_main on the occupation → "_uncategorized".
 *
 * The resolver is deterministic: given the same (sectors_def, overrides,
 * occupations) input it always produces the same output.
 *
 * Migrated from scripts/lib/sector_resolver.py.
 */
import type { SectorDef } from '../schema/sector.js';

/**
 * Sector id assigned to occupations that match no seed and have no override.
 * Treated as a real sector in projections (so 関連職業 etc. don't crash) but
 * flagged in review_queue for the operator to either (a) add an override or
 * (b) extend a sector's seed_codes.
 */
export const SENTINEL_UNCATEGORIZED = '_uncategorized';

export type Provenance =
  | 'override'
  | 'auto'
  | 'auto-ambiguous'
  | 'unmatched'
  | 'no-mhlw';

/** Result of resolving one occupation to a sector. */
export interface SectorAssignment {
  sector_id: string;
  provenance: Provenance;
  /** Seed glob patterns that matched (debug aid). */
  matched_seeds: readonly string[];
  /** If multi-match, all sector_ids that matched (first is the winner). */
  candidates: readonly string[];
}

/**
 * Glob-match a seed pattern against an mhlw_main code.
 *
 * Mirrors Python fnmatch semantics for our patterns:
 *   - `*` = any chars (zero or more)
 *   - `?` = single char
 *   - `[seq]` / `[!seq]` = char class / negated char class
 *
 * Underscores and hyphens are literal (not metachars in fnmatch).
 */
export function fnmatchCase(value: string, pattern: string): boolean {
  return globToRegex(pattern).test(value);
}

/** Convert an fnmatch-style glob to an anchored RegExp. */
function globToRegex(pattern: string): RegExp {
  let out = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;
    if (ch === '*') {
      out += '.*';
      i += 1;
    } else if (ch === '?') {
      out += '.';
      i += 1;
    } else if (ch === '[') {
      // Character class — copy verbatim until matching ']'.
      const end = pattern.indexOf(']', i + 1);
      if (end === -1) {
        // Unterminated bracket — treat as literal '['.
        out += '\\[';
        i += 1;
      } else {
        let cls = pattern.slice(i + 1, end);
        if (cls.startsWith('!')) cls = '^' + cls.slice(1);
        out += '[' + cls + ']';
        i = end + 1;
      }
    } else if ('\\^$.|+(){}'.includes(ch)) {
      out += '\\' + ch;
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  out += '$';
  return new RegExp(out);
}

/** Return [(sector_id, matched_seed), ...] for all sectors whose any seed matches. */
function findMatchingSectors(
  code: string,
  sectors: readonly SectorDef[],
): Array<readonly [string, string]> {
  const matches: Array<readonly [string, string]> = [];
  for (const s of sectors) {
    for (const seed of s.mhlw_seed_codes) {
      if (fnmatchCase(code, seed)) {
        matches.push([s.id, seed]);
        break; // one match per sector is enough
      }
    }
  }
  return matches;
}

/** Resolve a single occupation to its sector. */
export function resolveSector(
  occId: number,
  mhlwMain: string | null | undefined,
  sectors: readonly SectorDef[],
  overrides: Readonly<Record<string, string>>,
): SectorAssignment {
  const padded = String(occId).padStart(4, '0');
  if (Object.prototype.hasOwnProperty.call(overrides, padded)) {
    return {
      sector_id: overrides[padded]!,
      provenance: 'override',
      matched_seeds: [],
      candidates: [],
    };
  }

  if (!mhlwMain) {
    return {
      sector_id: SENTINEL_UNCATEGORIZED,
      provenance: 'no-mhlw',
      matched_seeds: [],
      candidates: [],
    };
  }

  const matches = findMatchingSectors(mhlwMain, sectors);
  if (matches.length === 0) {
    return {
      sector_id: SENTINEL_UNCATEGORIZED,
      provenance: 'unmatched',
      matched_seeds: [],
      candidates: [],
    };
  }

  if (matches.length === 1) {
    const [sectorId, seed] = matches[0]!;
    return {
      sector_id: sectorId,
      provenance: 'auto',
      matched_seeds: [seed],
      candidates: [sectorId],
    };
  }

  const [winnerId, winnerSeed] = matches[0]!;
  return {
    sector_id: winnerId,
    provenance: 'auto-ambiguous',
    matched_seeds: [winnerSeed],
    candidates: matches.map(([id]) => id),
  };
}

/**
 * Return a list of human-readable problems with the sector definitions.
 * Empty list = OK. Caller decides whether to fail the build or just warn.
 */
export function validateSectorDefinitions(sectors: readonly SectorDef[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const s of sectors) {
    if (s.id === SENTINEL_UNCATEGORIZED) {
      problems.push(
        `sector id '${s.id}' collides with the SENTINEL_UNCATEGORIZED ` +
          `value reserved by the resolver`,
      );
    }
    if (seenIds.has(s.id)) {
      problems.push(`duplicate sector id: ${s.id}`);
    }
    seenIds.add(s.id);
    if (s.mhlw_seed_codes.length === 0) {
      problems.push(
        `sector '${s.id}' has no mhlw_seed_codes — it can only ever ` +
          `be reached via overrides`,
      );
    }
  }
  return problems;
}
