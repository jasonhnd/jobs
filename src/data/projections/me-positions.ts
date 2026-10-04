/**
 * data.me-positions.json projection — per RA-134 / M2 self-positioning tool.
 *
 * Status: Implemented (2026-05-18, Agent E)
 * Consumer: /me page — given a job ID, shows its position in all 39
 *           rankings (rank within TOP-N + rank within the full universe).
 *
 * Shape: { meta: {...}, positions: { [jobId]: JobPositions } }
 *
 * For each scored occupation and each of the 39 rankings, we compute:
 *   - `rank`           : 1-based position within the ranking's TOP-N items, OR
 *                        null when the occupation isn't in the TOP-N (圏外).
 *   - `total`          : the TOP-N count actually published (usually 30 but some
 *                        rankings have smaller filtered totals).
 *   - `outOfUniverse`  : 1-based position within the *full* sorted+filtered
 *                        universe for this ranking, OR null when the occupation
 *                        fails the ranking's filter entirely (e.g. has no
 *                        salary data, or doesn't match the sector filter).
 *   - `universeSize`   : the size of the per-slug filtered universe — equals
 *                        the full scored occupation count when the ranking has
 *                        no filter, smaller (e.g. ~80) for filtered rankings
 *                        like `regulated-protected`.
 *   - `percentile`     : (outOfUniverse / universeSize) * 100, rounded to 1
 *                        decimal — handy for the "あなたは上位 X%" copy.
 *
 * Per-slug 'rankers' in me-positions/rankers.ts mirror the filter+sort logic in
 * src/views/ranking/rankings/*.ts exactly (verified against the full ranking
 * universe).
 * Keep the two in sync if either changes — a build-time drift guard in
 * buildMePositions() (RA-135) now asks buildRankings() for each ranking's full
 * universe and asserts the local RANKERS' full member set and order match it
 * for every slug, failing the build on divergence.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadGraph } from '../../graph/index.js';
import {
  buildRankings,
  loadOccupationsFromGraph,
  type Occupation,
  type RankingSlug,
} from '../../views/ranking/index.js';
import { RANKING_META } from '../../views/rankings-meta.js';
import { nowIso } from '../../lib/now.js';
import { RANKERS, type Ranker } from './me-positions/rankers.js';
import {
  assertRankingUniverseMatches,
  assertTopMatchesFullPrefix,
  buildCanonicalFullRankings,
} from './me-positions/universe.js';

export { rankIdsForSlug } from './me-positions/rankers.js';
export { assertRankingUniverseMatches } from './me-positions/universe.js';

// ───────────────────────────────────────────────────────────────────
// Type helpers (same shape consumed by /me)
// ───────────────────────────────────────────────────────────────────

export interface JobRankingPosition {
  /** 1-based rank within the published TOP-N items (null if 圏外). */
  rank: number | null;
  /** Total TOP-N items in this ranking (varies per slug — 30, 21, 15, etc.). */
  total: number;
  /** 1-based rank within the full filtered universe for this ranking.
   *  null when the job fails the filter entirely. */
  outOfUniverse: number | null;
  /** Size of the per-slug filtered universe — equals the full scored occupation
   *  count for unfiltered rankings, smaller for filtered ones. */
  universeSize: number;
  /** percentile = (outOfUniverse / universeSize) * 100, 1-decimal,
   *  null when outOfUniverse is null. */
  percentile: number | null;
}

export type RankingUniverseScope = 'all' | 'eligible';

/**
 * Rankings that order every scored occupation without an eligibility filter.
 * All other rankings must describe their denominator as the eligible/target
 * universe, even when the current fixture happens to have complete data.
 */
const ALL_OCCUPATION_UNIVERSE_SLUGS: ReadonlySet<RankingSlug> = new Set([
  'ai-risk-high',
  'ai-risk-low',
]);

export function rankingUniverseScope(slug: RankingSlug): RankingUniverseScope {
  return ALL_OCCUPATION_UNIVERSE_SLUGS.has(slug) ? 'all' : 'eligible';
}

export interface JobSummary {
  sectorJa: string;
  sectorId: string;
  aiRisk: number | null;
  salary: number | null;
  workers: number | null;
}

export interface JobPositions {
  jobId: number;
  nameJa: string;
  summary: JobSummary;
  inRankings: Record<string, JobRankingPosition>;
}

export interface MePositionsBuildResult {
  files: string[];
  jobCount: number;
  rankingCount: number;
}

export function computeJobRankingPosition(
  jobId: number,
  topRank: number | null,
  topTotal: number,
  fullUniverse: readonly number[],
): JobRankingPosition {
  const universeSize = fullUniverse.length;
  const fullIdx = fullUniverse.indexOf(jobId);
  const outOfUniverse = fullIdx === -1 ? null : fullIdx + 1;
  // Percentile is computed against the per-slug FILTERED universe size,
  // not the global occupation count — otherwise filtered rankings (e.g.
  // regulated-protected with ~80 jobs) would report a misleadingly
  // optimistic "top X%". See C1 fix.
  const percentile =
    outOfUniverse === null || universeSize === 0
      ? null
      : Math.round(((outOfUniverse / universeSize) * 100) * 10) / 10;

  return {
    rank: topRank,
    total: topTotal,
    outOfUniverse,
    universeSize,
    percentile,
  };
}

interface MePositionInputs {
  allOccs: Occupation[];
  canonicalFullBySlug: Map<RankingSlug, number[]>;
  topRankBySlug: Map<RankingSlug, Map<number, number>>;
  topTotalBySlug: Map<RankingSlug, number>;
}

/** Read occupations and ranking universes, then validate the local mirror. */
async function readMePositionInputs(): Promise<MePositionInputs> {
  const graph = await loadGraph();
  const allOccs = loadOccupationsFromGraph(graph);
  const scored = allOccs.filter((o) => o.ai_risk !== null);
  const withSalary = allOccs.filter((o) => o.salary && o.ai_risk !== null);

  const { results } = buildRankings(() => allOccs);

  // Pre-compute the FULL sorted-and-filtered list for every ranking from
  // both sources:
  //   - canonicalFullBySlug comes directly from buildRankings(), using its
  //     explicit full-universe limit option, and drives outOfUniverse.
  //   - localFullBySlug is the hand-maintained mirror retained as a drift
  //     guard so future canonical ranking edits fail loudly if RANKERS are
  //     not updated in lockstep.
  const canonicalFullBySlug = buildCanonicalFullRankings(allOccs);
  const localFullBySlug = new Map<RankingSlug, number[]>();
  for (const [slug, ranker] of Object.entries(RANKERS) as Array<[RankingSlug, Ranker]>) {
    const sorted = ranker(scored, allOccs, withSalary);
    localFullBySlug.set(slug, sorted.map((o) => o.id));
  }

  // Pre-compute the TOP-N rank lookup per slug → Map<jobId, rank>.
  const topRankBySlug = new Map<RankingSlug, Map<number, number>>();
  const topTotalBySlug = new Map<RankingSlug, number>();
  for (const [slug, result] of results) {
    const rankMap = new Map<number, number>();
    result.items.forEach((o, i) => rankMap.set(o.id, i + 1));
    topRankBySlug.set(slug, rankMap);
    topTotalBySlug.set(slug, result.items.length);
  }

  // ───── Drift guard (RA-135) ─────
  // The per-slug RANKERS mirror are a hand-maintained mirror of the canonical
  // buildRankings() filter+sort. If they diverge, a job's published "上位 X%"
  // (computed here from canonical full rankings) would stop being protected by
  // the local mirror. Assert the full canonical universe's membership and order
  // match the local RANKERS for every slug and FAIL the build loudly rather
  // than shipping inconsistent positions.
  for (const [slug, result] of results) {
    const canonicalFull = canonicalFullBySlug.get(slug);
    if (!canonicalFull) {
      throw new Error(`[me-positions] canonical ranking "${slug}" has no full-universe result.`);
    }
    assertTopMatchesFullPrefix(slug, result.items.map((o) => o.id), canonicalFull);

    const localFull = localFullBySlug.get(slug);
    if (!localFull) {
      throw new Error(`[me-positions] canonical ranking "${slug}" has no local RANKER — re-sync.`);
    }
    assertRankingUniverseMatches(slug, canonicalFull, localFull);
  }
  for (const slug of Object.keys(RANKERS) as RankingSlug[]) {
    if (!canonicalFullBySlug.has(slug)) {
      throw new Error(`[me-positions] local RANKER "${slug}" has no canonical ranking — re-sync.`);
    }
  }

  return { allOccs, canonicalFullBySlug, topRankBySlug, topTotalBySlug };
}

/** Calculate one occupation's positions in every ranking. */
function computeOccupationPositions(
  occ: Occupation,
  inputs: MePositionInputs,
): JobPositions {
  const { canonicalFullBySlug, topRankBySlug, topTotalBySlug } = inputs;
  const jobId = occ.id;
  const inRankings: Record<string, JobRankingPosition> = {};
  for (const slug of Object.keys(RANKERS) as RankingSlug[]) {
    const topMap = topRankBySlug.get(slug);
    const full = canonicalFullBySlug.get(slug)!;
    const topRank = topMap?.get(jobId) ?? null;
    inRankings[slug] = computeJobRankingPosition(
      jobId,
      topRank,
      topTotalBySlug.get(slug) ?? 0,
      full,
    );
  }
  return {
    jobId,
    nameJa: occ.title_ja ?? '',
    summary: {
      sectorJa: occ.sector_ja,
      sectorId: occ.sector_id,
      aiRisk: occ.ai_risk,
      salary: occ.salary,
      workers: occ.workers,
    },
    inRankings,
  };
}

/** Bundle the per-job records with ranking labels and payload metadata. */
function assembleMePositionsPayload(
  allOccs: Occupation[],
  positions: Record<string, JobPositions>,
) {
  // Bundle ranking labels in the same file so /me can render names
  // without a second fetch. Tiny — ~3 KB before gzip.
  const rankings = RANKING_META.map((m) => ({
    slug: m.slug,
    name_ja: m.name_ja,
    description_ja: m.description_ja,
    universe_scope: rankingUniverseScope(m.slug),
  }));

  return {
    meta: {
      schema_version: '1.1',
      generated_at: nowIso(),
      record_count: Object.keys(positions).length,
      ranking_count: Object.keys(RANKERS).length,
      // Derive from the actual occupation universe instead of a hardcoded count,
      // so the published "全 N 中…" denominator can't silently go stale when
      // the occupation count changes.
      universe_size: allOccs.length,
    },
    rankings,
    positions,
  };

}

/** Build me-positions.json from validated inputs and per-job positions. */
export async function buildMePositions(
  distRoot: string,
): Promise<MePositionsBuildResult> {
  const inputs = await readMePositionInputs();
  const positions: Record<string, JobPositions> = {};
  for (const occ of inputs.allOccs) {
    positions[String(occ.id)] = computeOccupationPositions(occ, inputs);
  }
  const payload = assembleMePositionsPayload(inputs.allOccs, positions);

  const outPath = join(distRoot, 'data.me-positions.json');
  await writeFile(outPath, JSON.stringify(payload) + '\n', 'utf-8');

  return {
    files: [outPath],
    jobCount: Object.keys(positions).length,
    rankingCount: Object.keys(RANKERS).length,
  };
}
