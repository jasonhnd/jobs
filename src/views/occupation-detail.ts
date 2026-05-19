/**
 * src/views/occupation-detail.ts — graph → adapt-detail.DetailFile adapter.
 *
 * Step 8: the 556 /ja/[id] occupation detail pages now source their
 * DetailFile records from the knowledge graph rather than reading
 * public/data.detail/<id>.json. The auxiliary profile5 + transfer_paths
 * projections are still consumed file-side (deferred to a later step).
 *
 * Output is identical to the legacy projection (src/data/projections/
 * detail.ts) for every field adapt-detail.adaptDetailFile reads. The
 * SEO baseline diff verifies byte-equivalence across all 556 pages.
 */

import type { KnowledgeGraph, OccupationId } from '@/graph';
import type { Profile5Record } from '@/graph/profile5';
import type { TransferPathEntry } from '@/graph/transfer-paths';
import {
  riskBand as legacyRiskBand,
  demandBand as legacyDemandBand,
  workforceBand as legacyWorkforceBand,
} from '../data/lib/bands';

/**
 * Empty Profile5Record — all 5 axes null. Used as the default when a
 * caller (e.g., tests) doesn't pass profile5 into `adaptDetailFile`.
 * Production callers always pass the real value from
 * `graph.occupations.get(id).profile5`.
 */
const EMPTY_PROFILE5: Profile5Record = {
  creative: null,
  social: null,
  judgment: null,
  physical: null,
  routine: null,
};

/**
 * Empty TransferPathEntry — no candidates. Used as the default when a
 * caller doesn't pass transferCandidates into `adaptDetailFile`.
 * Production callers always pass the real value from
 * `graph.transferCandidatesOf(id)`.
 */
const EMPTY_TRANSFER: TransferPathEntry = {
  source_id: -1,
  candidates: [],
  fallback: 'no_skills',
};

// ─── Per-occupation detail file shapes (merged from adapt-detail.ts
//     2026-05-14 Phase D #7 per docs/architecture.md §8 row 13). ───────────

export interface TopNEntry {
  key: string;
  label_ja: string;
  score: number;
}

export interface OrgEntry {
  name_ja?: string | null;
  url?: string | null;
}

export interface ClassificationsField {
  l1?: string;
  l2?: string;
  l3?: string;
  [k: string]: unknown;
}

export interface SectorMeta {
  id?: string;
  ja?: string;
}

export interface DataSourceVersions {
  ipd_numeric?: string;
  ipd_description?: string;
  ipd_retrieved_at?: string;
  [k: string]: unknown;
}

export interface DetailFile {
  id: number;
  schema_version?: string;
  title?: { ja?: string; aliases_ja?: string[] };
  description?: {
    summary_ja?: string | null;
    what_it_is_ja?: string | null;
    how_to_become_ja?: string | null;
    working_conditions_ja?: string | null;
  };
  classifications?: ClassificationsField;
  sector?: SectorMeta;
  risk_band?: string | null;
  workforce_band?: string | null;
  demand_band?: string | null;
  ai_risk?: {
    score?: number | null;
    model?: string | null;
    scored_at?: string | null;
    rationale_ja?: string | null;
    rationale_long_ja?: string | null;
    displaceable_tasks_ja?: string[];
    resilient_tasks_ja?: string[];
    horizon_5y_ja?: string | null;
  };
  stats?: {
    salary_man_yen?: number | null;
    workers?: number | null;
    monthly_hours?: number | null;
    average_age?: number | null;
    recruit_wage_man_yen?: number | null;
    recruit_ratio?: number | null;
    hourly_wage?: number | null;
  };
  skills_top10?: TopNEntry[];
  knowledge_top5?: TopNEntry[];
  abilities_top5?: TopNEntry[];
  tasks_count?: number | null;
  tasks_lead_ja?: string | null;
  related_orgs?: OrgEntry[];
  related_certs_ja?: string[];
  url?: string;
  data_source_versions?: DataSourceVersions;
}

export interface Rec {
  id: number;
  name_ja: string;
  desc_ja: string | null;
  what_it_is_ja: string | null;
  how_to_become_ja: string | null;
  working_conditions_ja: string | null;
  salary: number | null;
  workers: number | null;
  hours: number | null;
  age: number | null;
  recruit_wage: number | null;
  recruit_ratio: number | null;
  hourly_wage: number | null;
  ai_risk: number | null;
  ai_rationale_ja: string | null;
  url: string;
  aliases_ja: string[];
  classifications: ClassificationsField;
  sector: SectorMeta | null;
  risk_band: string | null;
  workforce_band: string | null;
  demand_band: string | null;
  ai_model: string | null;
  ai_scored_at: string | null;
  skills_top10: TopNEntry[];
  knowledge_top5: TopNEntry[];
  abilities_top5: TopNEntry[];
  tasks_count: number | null;
  tasks_lead_ja: string | null;
  related_orgs: OrgEntry[];
  related_certs_ja: string[];
  data_source_versions: DataSourceVersions;
  ai_rationale_long_ja: string | null;
  ai_displaceable_tasks_ja: string[];
  ai_resilient_tasks_ja: string[];
  ai_horizon_5y_ja: string | null;
  /**
   * Pre-computed 5-axis ability profile. Sourced from
   * `graph.occupations.get(id).profile5` in the production page-data
   * pipeline (Phase E follow-up 2026-05-16). When `adaptDetailFile`
   * is called without an explicit profile5 (e.g., from unit tests),
   * every axis is null so renderers degrade to "dash" gracefully.
   */
  profile5: Profile5Record;
  /**
   * Top-N transfer-path candidates (same-sector, strictly safer when
   * available). Sourced from `graph.transferCandidatesOf(id)` in the
   * production page-data pipeline (Phase E follow-up 2026-05-17).
   * Tests may omit it; `fallback: 'no_skills'` + empty candidates means
   * renderers skip the block entirely.
   */
  transferCandidates: TransferPathEntry;
}

/**
 * Project a per-occupation detail JSON file into the flat `Rec` shape used
 * by the [id].astro page renderers. Pure (no fs, no time). All callers MUST
 * pass a Zod-validated object; see DetailFileSchema in projection-schemas.ts.
 *
 * The `profile5` argument is graph-sourced — `DetailFile` itself doesn't
 * carry profile5 (the projection writes a separate `public/data.profile5.json`
 * for browser consumers), so this adapter takes it as a side input. Tests
 * may omit it; production page-data always supplies the per-occupation value
 * from `graph.occupations.get(id).profile5`.
 */
export function adaptDetailFile(
  d: DetailFile,
  profile5: Profile5Record = EMPTY_PROFILE5,
  transferCandidates: TransferPathEntry = EMPTY_TRANSFER,
): Rec {
  const stats = d.stats ?? {};
  const ai = d.ai_risk ?? {};
  const title = d.title ?? {};
  const desc = d.description ?? {};
  return {
    id: d.id,
    name_ja: title.ja ?? '',
    desc_ja: desc.summary_ja ?? null,
    what_it_is_ja: desc.what_it_is_ja ?? null,
    how_to_become_ja: desc.how_to_become_ja ?? null,
    working_conditions_ja: desc.working_conditions_ja ?? null,
    salary: stats.salary_man_yen ?? null,
    workers: stats.workers ?? null,
    hours: stats.monthly_hours ?? null,
    age: stats.average_age ?? null,
    recruit_wage: stats.recruit_wage_man_yen ?? null,
    recruit_ratio: stats.recruit_ratio ?? null,
    // hourly_wage = recruit_wage_man_yen × 10000 / 160h. Same formula as
    // src/views/ranking/loaders.ts (rounded to a clean integer here).
    hourly_wage:
      stats.recruit_wage_man_yen != null
        ? Math.round((stats.recruit_wage_man_yen * 10000) / 160)
        : null,
    ai_risk: ai.score ?? null,
    ai_rationale_ja: ai.rationale_ja ?? null,
    url: d.url ?? `https://shigoto.mhlw.go.jp/User/Occupation/Detail/${d.id}`,
    aliases_ja: title.aliases_ja ?? [],
    classifications: d.classifications ?? {},
    sector: d.sector ?? null,
    risk_band: d.risk_band ?? null,
    workforce_band: d.workforce_band ?? null,
    demand_band: d.demand_band ?? null,
    ai_model: ai.model ?? null,
    ai_scored_at: ai.scored_at ?? null,
    skills_top10: d.skills_top10 ?? [],
    knowledge_top5: d.knowledge_top5 ?? [],
    abilities_top5: d.abilities_top5 ?? [],
    tasks_count: d.tasks_count ?? null,
    tasks_lead_ja: d.tasks_lead_ja ?? null,
    related_orgs: d.related_orgs ?? [],
    related_certs_ja: d.related_certs_ja ?? [],
    data_source_versions: d.data_source_versions ?? {},
    ai_rationale_long_ja: ai.rationale_long_ja ?? null,
    ai_displaceable_tasks_ja: ai.displaceable_tasks_ja ?? [],
    ai_resilient_tasks_ja: ai.resilient_tasks_ja ?? [],
    ai_horizon_5y_ja: ai.horizon_5y_ja ?? null,
    profile5,
    transferCandidates,
  };
}

function topN(
  edges: ReadonlyArray<{ to: string | { toString(): string }; weight: number }>,
  labelMap: ReadonlyMap<string, string>,
  n: number,
): TopNEntry[] | null {
  if (edges.length === 0) return null;
  const sorted = [...edges].sort((a, b) => b.weight - a.weight);
  return sorted.slice(0, n).map((e) => {
    const key = String(e.to);
    return {
      key,
      label_ja: labelMap.get(key) ?? key,
      score: e.weight,
    };
  });
}

function labelMap<T extends { nameJa: string }>(
  src: ReadonlyMap<unknown, T>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const [id, node] of src) m.set(String(id), node.nameJa);
  return m;
}

/**
 * Build a complete DetailFile from graph for a given occupation id.
 * Mirrors src/data/projections/detail.ts exactly for every field
 * adapt-detail.adaptDetailFile downstream consumes.
 */
export function buildOccupationDetailFile(
  graph: KnowledgeGraph,
  occId: OccupationId,
): DetailFile {
  const occ = graph.occupations.get(occId);
  if (!occ) throw new Error(`buildOccupationDetailFile: occupation ${String(occId)} not in graph`);

  const sectorId = graph.sectorOf(occId);
  const sector = sectorId ? graph.sectors.get(sectorId) : null;
  const aiScore = occ.aiRisk?.score ?? null;

  const skillLabels = labelMap(graph.skills as ReadonlyMap<unknown, { nameJa: string }>);
  const knowledgeLabels = labelMap(graph.knowledge as ReadonlyMap<unknown, { nameJa: string }>);
  const abilityLabels = labelMap(graph.abilities as ReadonlyMap<unknown, { nameJa: string }>);

  return {
    id: Number(occ.id),
    schema_version: '1.2',
    title: {
      ja: occ.titleJa,
      aliases_ja: [...occ.aliasesJa],
    },
    description: {
      summary_ja: occ.description.summaryJa ?? null,
      what_it_is_ja: occ.description.whatItIsJa ?? null,
      how_to_become_ja: occ.description.howToBecomeJa ?? null,
      working_conditions_ja: occ.description.workingConditionsJa ?? null,
    },
    classifications: {
      mhlw_main: occ.classifications.mhlwMain ?? undefined,
      mhlw_all: [...occ.classifications.mhlwAll],
      jsoc_main: occ.classifications.jsocMain ?? undefined,
      jsoc_all: [...occ.classifications.jsocAll],
    },
    sector: sector
      ? { id: String(sector.id), ja: sector.nameJa }
      : undefined,
    risk_band: legacyRiskBand(aiScore),
    workforce_band: legacyWorkforceBand(occ.stats?.workers ?? null),
    demand_band: legacyDemandBand(occ.stats?.recruitRatio ?? null),
    ai_risk: occ.aiRisk
      ? {
          score: occ.aiRisk.score,
          model: occ.aiRisk.model,
          scored_at: occ.aiRisk.date,
          rationale_ja: occ.aiRisk.rationaleJa,
          // rationale_long_ja / displaceable_tasks_ja / resilient_tasks_ja /
          // horizon_5y_ja: not currently emitted by the projection either
          // (all null/empty in public/data.detail/*.json). Adapter handles
          // null gracefully.
        }
      : undefined,
    stats: occ.stats
      ? {
          salary_man_yen: occ.stats.salaryManYen,
          workers: occ.stats.workers,
          monthly_hours: occ.stats.monthlyHours,
          average_age: occ.stats.averageAge,
          recruit_wage_man_yen: occ.stats.recruitWageManYen,
          recruit_ratio: occ.stats.recruitRatio,
        }
      : undefined,
    skills_top10:    topN(graph.skillsOf(occId),    skillLabels,    10) ?? undefined,
    knowledge_top5:  topN(graph.knowledgeOf(occId), knowledgeLabels, 5) ?? undefined,
    abilities_top5:  topN(graph.abilitiesOf(occId), abilityLabels,   5) ?? undefined,
    tasks_count: occ.tasksCount,
    tasks_lead_ja: occ.tasksLeadJa,
    related_orgs: occ.relatedOrgs.map(o => ({ name_ja: o.nameJa, url: o.url })),
    related_certs_ja: [...occ.relatedCertsJa],
    data_source_versions: {
      ipd_numeric: occ.dataSourceVersions.ipdNumeric,
      ipd_description: occ.dataSourceVersions.ipdDescription,
      ipd_retrieved_at: occ.dataSourceVersions.ipdRetrievedAt,
    },
  } as DetailFile;
}
