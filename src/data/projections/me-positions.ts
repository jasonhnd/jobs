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
 * Per-slug 'rankers' below mirror the filter+sort logic in
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
  HIGH_DEMAND_MIN,
  demandScore,
  type Occupation,
  type RankingSlug,
} from '../../views/ranking/index.js';
import { RANKING_META } from '../../views/rankings-meta.js';
import { nowIso } from '../../lib/now.js';
import { EDU, EMP } from '../domain/distribution-labels.js';

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

// ───────────────────────────────────────────────────────────────────
// Per-ranking "ranker" — produces the FULL sorted+filtered universe.
// `items` is sliced to TOP-N before consumption; .indexOf() against the
// full universe gives outOfUniverse directly. The full universe size
// varies per slug — full count for unfiltered rankings, smaller for filtered.
//
// Mirrors src/views/ranking/rankings/*.ts. Keep in lockstep.
// ───────────────────────────────────────────────────────────────────

// Sector groupings — mirror src/views/ranking/utilities.ts
const PHYSICAL_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'noringyo', 'keiseki',
]);
const INTERPERSONAL_SECTORS: ReadonlySet<string> = new Set([
  'iryo', 'fukushi', 'kyoiku', 'hanbai', 'service',
]);
const CRAFT_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'keiseki', 'noringyo',
]);
const PUBLIC_SECTORS: ReadonlySet<string> = new Set(['hoan']);

function inSet(o: Occupation, set: ReadonlySet<string>): boolean {
  return set.has(o.sector_id);
}

function eduPct(o: Occupation, key: string): number {
  return o.education_pct?.[key] ?? 0;
}
function gradPct(o: Occupation): number {
  return eduPct(o, EDU.masters) + eduPct(o, EDU.doctorate);
}
function empPct(o: Occupation, key: string): number {
  return o.employment_type?.[key] ?? 0;
}

/**
 * Per-slug "full universe" producer — applies the ranking's filter +
 * sort, returns the COMPLETE ordered list (no slice). The TOP-N list
 * published by buildRankings is just `.slice(0, TOP_N)` of this.
 *
 * Important: the comparator order MUST match the upstream builder, or
 * outOfUniverse will drift away from the rank we'd compute by visually
 * scrolling through the ranking page.
 */
type Ranker = (
  scored: Occupation[],
  occs: Occupation[],
  withSalary: Occupation[],
) => Occupation[];

const RANKERS: Record<RankingSlug, Ranker> = {
  // ── Phase 1 baseline ──
  'ai-risk-high': (scored) =>
    [...scored].sort((a, b) => (b.ai_risk ?? 0) - (a.ai_risk ?? 0) || a.id - b.id),
  'ai-risk-low': (scored) =>
    [...scored].sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || a.id - b.id),
  'salary-safe': (_scored, _occs, withSalary) =>
    withSalary
      .filter((o) => (o.ai_risk ?? 0) <= 5)
      .sort((a, b) => {
        const sa = a.salary ?? 0;
        const sb = b.salary ?? 0;
        if (sb !== sa) return sb - sa;
        const ra = a.ai_risk ?? 0;
        const rb = b.ai_risk ?? 0;
        if (ra !== rb) return ra - rb;
        return a.id - b.id;
      }),
  workers: (_scored, occs) =>
    occs.filter((o) => o.workers).sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0)),
  salary: (_scored, occs) =>
    occs
      .filter((o) => o.salary)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id),
  'entry-salary': (_scored, occs) =>
    occs
      .filter((o) => o.recruit_wage)
      .sort((a, b) => (b.recruit_wage ?? 0) - (a.recruit_wage ?? 0) || a.id - b.id),
  'young-workforce': (_scored, occs) =>
    occs
      .filter((o) => o.average_age)
      .sort((a, b) => (a.average_age ?? 0) - (b.average_age ?? 0) || a.id - b.id),
  'short-hours': (_scored, occs) =>
    occs
      .filter((o) => o.monthly_hours)
      .sort((a, b) => (a.monthly_hours ?? 0) - (b.monthly_hours ?? 0) || a.id - b.id),
  'high-demand': (_scored, occs) => {
    let withDemand = occs.filter(
      (o) => demandScore(o.demand_band) >= HIGH_DEMAND_MIN,
    );
    if (withDemand.length < 30) {
      withDemand = occs.filter((o) => o.demand_band);
    }
    return [...withDemand].sort((a, b) => {
      const ds =
        demandScore(b.demand_band) -
        demandScore(a.demand_band);
      if (ds !== 0) return ds;
      const ss = (b.salary ?? 0) - (a.salary ?? 0);
      if (ss !== 0) return ss;
      return a.id - b.id;
    });
  },

  // ── Phase 2 単軸 ──
  'hourly-wage': (_scored, occs) =>
    occs
      .filter((o) => o.hourly_wage)
      .sort((a, b) => (b.hourly_wage ?? 0) - (a.hourly_wage ?? 0) || a.id - b.id),
  'recruit-ratio': (_scored, occs) =>
    occs
      .filter((o) => o.recruit_ratio !== null)
      .sort((a, b) => (b.recruit_ratio ?? 0) - (a.recruit_ratio ?? 0) || a.id - b.id),
  'aging-workforce': (_scored, occs) =>
    occs
      .filter((o) => o.average_age)
      .sort((a, b) => (b.average_age ?? 0) - (a.average_age ?? 0) || a.id - b.id),
  'monthly-hours-long': (_scored, occs) =>
    occs
      .filter((o) => o.monthly_hours)
      .sort((a, b) => (b.monthly_hours ?? 0) - (a.monthly_hours ?? 0) || a.id - b.id),
  'recruit-ratio-low': (_scored, occs) =>
    occs
      .filter((o) => o.recruit_ratio !== null)
      .sort((a, b) => (a.recruit_ratio ?? 0) - (b.recruit_ratio ?? 0) || a.id - b.id),

  // ── Phase 2 AI 軸派生 ──
  'ai-replaced-soon': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 0) >= 8)
      .sort((a, b) => {
        const r = (b.ai_risk ?? 0) - (a.ai_risk ?? 0);
        if (r !== 0) return r;
        return (b.workers ?? 0) - (a.workers ?? 0);
      }),
  'ai-resistant-craft': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 3 && inSet(o, CRAFT_SECTORS))
      .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || a.id - b.id),
  'ai-at-risk-but-paid': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 0) >= 7 && (o.salary ?? 0) >= 500)
      .sort((a, b) => {
        const s = (b.salary ?? 0) - (a.salary ?? 0);
        if (s !== 0) return s;
        return (b.ai_risk ?? 0) - (a.ai_risk ?? 0);
      }),
  'ai-augmented': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? -1) >= 4 && (o.ai_risk ?? -1) <= 6)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id),
  'ai-frontier': (scored) =>
    scored
      .filter((o) => o.sector_id === 'it' && (o.ai_risk ?? 0) >= 5)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id),
  'ai-stable-employment': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 5 && empPct(o, EMP.regular) >= 60)
      .sort(
        (a, b) =>
          empPct(b, EMP.regular) - empPct(a, EMP.regular) ||
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0),
      ),

  // ── Phase 2 組合せ ──
  'ai-safe-high-demand': (scored) =>
    scored
      .filter(
        (o) =>
          (o.ai_risk ?? 999) <= 5 &&
          demandScore(o.demand_band) >= HIGH_DEMAND_MIN,
      )
      .sort(
        (a, b) =>
          demandScore(b.demand_band) -
            demandScore(a.demand_band) ||
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0),
      ),
  'ai-safe-short-hours': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 5 && o.monthly_hours)
      .sort(
        (a, b) =>
          (a.monthly_hours ?? 9999) - (b.monthly_hours ?? 9999) ||
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0),
      ),
  'ai-safe-young-workforce': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 5 && o.average_age)
      .sort(
        (a, b) =>
          (a.average_age ?? 999) - (b.average_age ?? 999) ||
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0),
      ),
  'ai-safe-no-license': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 5 && o.certs.length === 0)
      .sort(
        (a, b) =>
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0),
      ),
  'ai-safe-physical': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 5 && inSet(o, PHYSICAL_SECTORS))
      .sort(
        (a, b) =>
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0),
      ),
  'ai-safe-interpersonal': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 5 && inSet(o, INTERPERSONAL_SECTORS))
      .sort(
        (a, b) =>
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0),
      ),
  'high-salary-high-demand': (scored) =>
    scored
      .filter(
        (o) => o.salary && demandScore(o.demand_band) >= HIGH_DEMAND_MIN,
      )
      .sort(
        (a, b) =>
          (b.salary ?? 0) - (a.salary ?? 0) ||
          demandScore(b.demand_band) -
            demandScore(a.demand_band),
      ),
  'high-salary-young-entry': (_scored, occs) =>
    occs
      .filter((o) => o.recruit_wage && o.average_age && o.average_age <= 40)
      .sort(
        (a, b) =>
          (b.recruit_wage ?? 0) - (a.recruit_wage ?? 0) ||
          (a.average_age ?? 999) - (b.average_age ?? 999),
      ),

  // ── Phase 2 教育・資格 ──
  'license-required': (_scored, occs) =>
    occs
      .filter((o) => o.certs.length >= 1)
      .sort(
        (a, b) => b.certs.length - a.certs.length || (b.salary ?? 0) - (a.salary ?? 0),
      ),
  'no-license-required': (scored) =>
    scored
      .filter((o) => o.certs.length === 0 && (o.ai_risk ?? 999) <= 5)
      .sort(
        (a, b) =>
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0),
      ),
  'high-school-ok': (_scored, occs) =>
    occs
      .filter((o) => eduPct(o, EDU.highSchool) >= 30)
      .sort(
        (a, b) =>
          eduPct(b, EDU.highSchool) - eduPct(a, EDU.highSchool) ||
          (b.salary ?? 0) - (a.salary ?? 0),
      ),
  'university-required': (_scored, occs) =>
    occs
      .filter((o) => eduPct(o, EDU.university) >= 50)
      .sort(
        (a, b) =>
          eduPct(b, EDU.university) - eduPct(a, EDU.university) ||
          (b.salary ?? 0) - (a.salary ?? 0),
      ),
  'graduate-school-required': (_scored, occs) =>
    occs
      .filter((o) => gradPct(o) >= 30)
      .sort(
        (a, b) => gradPct(b) - gradPct(a) || (b.salary ?? 0) - (a.salary ?? 0),
      ),

  // ── Phase 2 ニッチ ──
  'public-sector': (_scored, occs) =>
    occs
      .filter((o) => inSet(o, PUBLIC_SECTORS))
      .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || a.id - b.id),
  'freelance-friendly': (_scored, occs) =>
    occs
      .filter((o) => empPct(o, EMP.selfEmployedFreelance) >= 20)
      .sort(
        (a, b) =>
          empPct(b, EMP.selfEmployedFreelance) -
            empPct(a, EMP.selfEmployedFreelance) ||
          (b.salary ?? 0) - (a.salary ?? 0),
      ),
  'self-employed-typical': (_scored, occs) =>
    occs
      .filter(
        (o) =>
          empPct(o, EMP.selfEmployedFreelance) + empPct(o, EMP.executive) >= 30,
      )
      .sort(
        (a, b) =>
          empPct(b, EMP.selfEmployedFreelance) +
            empPct(b, EMP.executive) -
            (empPct(a, EMP.selfEmployedFreelance) + empPct(a, EMP.executive)) ||
          (b.salary ?? 0) - (a.salary ?? 0),
      ),
  'large-workforce-stable': (scored) =>
    scored
      .filter((o) => (o.ai_risk ?? 999) <= 5 && o.workers && o.workers >= 50000)
      .sort(
        (a, b) =>
          (b.workers ?? 0) - (a.workers ?? 0) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0),
      ),
  'regulated-protected': (scored) =>
    scored
      .filter((o) => o.certs.length >= 2 && (o.ai_risk ?? 999) <= 5)
      .sort(
        (a, b) =>
          b.certs.length - a.certs.length || (a.ai_risk ?? 0) - (b.ai_risk ?? 0),
      ),
  'low-stress-stable': (scored) =>
    scored
      .filter(
        (o) =>
          (o.ai_risk ?? 999) <= 5 && o.monthly_hours && o.monthly_hours <= 165,
      )
      .sort(
        (a, b) =>
          (a.monthly_hours ?? 999) - (b.monthly_hours ?? 999) ||
          (a.ai_risk ?? 0) - (b.ai_risk ?? 0),
      ),
};

/**
 * Ask the canonical ranking builders for their full sorted universes through
 * buildRankings' explicit projection-only limit option. Public ranking pages
 * still use the default TOP_N contract.
 */
function buildCanonicalFullRankings(allOccs: Occupation[]): Map<RankingSlug, number[]> {
  const { results } = buildRankings(
    () => allOccs,
    { limit: Number.POSITIVE_INFINITY },
  );
  return new Map(
    Array.from(results, ([slug, result]) => [
      slug,
      result.items.map((o) => o.id),
    ]),
  );
}

function findDuplicate(ids: readonly number[]): number | null {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}

export function assertRankingUniverseMatches(
  slug: RankingSlug | string,
  canonicalFull: readonly number[],
  localFull: readonly number[],
): void {
  const canonicalDuplicate = findDuplicate(canonicalFull);
  if (canonicalDuplicate !== null) {
    throw new Error(
      `[me-positions] canonical ranking "${slug}" contains duplicate id ${canonicalDuplicate}.`,
    );
  }

  const localDuplicate = findDuplicate(localFull);
  if (localDuplicate !== null) {
    throw new Error(
      `[me-positions] local RANKER "${slug}" contains duplicate id ${localDuplicate}.`,
    );
  }

  if (canonicalFull.length !== localFull.length) {
    throw new Error(
      `[me-positions] RANKER universe size drift on "${slug}": ` +
        `canonical=${canonicalFull.length} local=${localFull.length}. ` +
        'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
    );
  }

  const localIds = new Set(localFull);
  const missingLocal = canonicalFull.find((id) => !localIds.has(id));
  if (missingLocal !== undefined) {
    throw new Error(
      `[me-positions] RANKER universe membership drift on "${slug}": ` +
        `canonical id ${missingLocal} is missing locally. ` +
        'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
    );
  }

  const canonicalIds = new Set(canonicalFull);
  const extraLocal = localFull.find((id) => !canonicalIds.has(id));
  if (extraLocal !== undefined) {
    throw new Error(
      `[me-positions] RANKER universe membership drift on "${slug}": ` +
        `local id ${extraLocal} is not in canonical. ` +
        'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
    );
  }

  for (let i = 0; i < canonicalFull.length; i += 1) {
    if (canonicalFull[i] !== localFull[i]) {
      throw new Error(
        `[me-positions] RANKER universe order drift on "${slug}" at position ${i + 1}: ` +
          `canonical=${canonicalFull[i]} local=${localFull[i]}. ` +
          'The local RANKERS mirror diverged from buildRankings() — re-sync them.',
      );
    }
  }
}

function assertTopMatchesFullPrefix(
  slug: RankingSlug,
  canonicalTop: readonly number[],
  canonicalFull: readonly number[],
): void {
  for (let i = 0; i < canonicalTop.length; i += 1) {
    if (canonicalTop[i] !== canonicalFull[i]) {
      throw new Error(
        `[me-positions] canonical full ranking "${slug}" does not preserve TOP-N at position ${i + 1}: ` +
          `top=${canonicalTop[i]} full=${canonicalFull[i]}.`,
      );
    }
  }
}

/**
 * Build me-positions.json — runs loadGraph + buildRankings exactly once,
 * then walks every (jobId × slug) pair to assemble per-job position
 * records. Writes a single JSON file. ~150 KB unminified at 556 × 39
 * positions; ~25 KB gzipped (numeric-heavy, repeats well).
 */
export async function buildMePositions(
  distRoot: string,
): Promise<MePositionsBuildResult> {
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
  // The per-slug RANKERS above are a hand-maintained mirror of the canonical
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

  // ───── Assemble per-job positions ─────
  const positions: Record<string, JobPositions> = {};
  for (const occ of allOccs) {
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
    positions[String(jobId)] = {
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

  // Bundle ranking labels in the same file so /me can render names
  // without a second fetch. Tiny — ~3 KB before gzip.
  const rankings = RANKING_META.map((m) => ({
    slug: m.slug,
    name_ja: m.name_ja,
    description_ja: m.description_ja,
    universe_scope: rankingUniverseScope(m.slug),
  }));

  const payload = {
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

  const outPath = join(distRoot, 'data.me-positions.json');
  await writeFile(outPath, JSON.stringify(payload) + '\n', 'utf-8');

  return {
    files: [outPath],
    jobCount: Object.keys(positions).length,
    rankingCount: Object.keys(RANKERS).length,
  };
}
