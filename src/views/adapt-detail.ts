/**
 * adapt-detail.ts — single source of truth for projecting a per-occupation
 * detail JSON file into the flat `Rec` shape used by the [id].astro page
 * renderers.
 *
 * Pulled out of src/pages/ja/[id].astro to fix the audit's #2.2 finding —
 * the file used to ship two identical adapters (module-level `adapt` and
 * `adaptLocal` inside `getStaticPaths`) because Astro hoists
 * `getStaticPaths` into a scope that can't see top-of-file consts. The
 * fix is to import this module both at top-level AND from inside the
 * `getStaticPaths` body via `await import(...)` — same logic, one
 * implementation.
 *
 * Pure (no fs, no time). All callers MUST pass a Zod-validated object;
 * see DetailFileSchema in projection-schemas.ts.
 */

// ─── Public input/output shapes ────────────────────────────────────────────

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
}

// ─── Adapter ───────────────────────────────────────────────────────────────

export function adaptDetailFile(d: DetailFile): Rec {
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
    hourly_wage: null,
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
  };
}
