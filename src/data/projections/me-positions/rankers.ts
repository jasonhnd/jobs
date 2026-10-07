import {
  HIGH_DEMAND_MIN,
  demandScore,
  type Occupation,
  type RankingSlug,
} from '../../../views/ranking/index.js';
import { EDU, EMP } from '../../domain/distribution-labels.js';
import { graduateShare } from '../../domain/education-share.js';

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
  return graduateShare(eduPct(o, EDU.masters), eduPct(o, EDU.doctorate));
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
export type Ranker = (
  scored: Occupation[],
  occs: Occupation[],
  withSalary: Occupation[],
) => Occupation[];

export const RANKERS: Record<RankingSlug, Ranker> = {
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
      // Single demand band clears HIGH_DEMAND_MIN, so this term is currently
      // always 0; kept so lowering the threshold cannot silently drop demand
      // from the ordering.
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
 * Ordered ids from one local ranker. Fixture tests pin filter and sort
 * through this wrapper. It writes nothing, and buildMePositions does not
 * call it — published positions still come from the canonical full ranking.
 */
export function rankIdsForSlug(
  slug: RankingSlug,
  scored: Occupation[],
  occs: Occupation[],
  withSalary: Occupation[],
): number[] {
  return RANKERS[slug](scored, occs, withSalary).map((occupation) => occupation.id);
}

