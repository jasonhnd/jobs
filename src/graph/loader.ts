/**
 * loadGraph() — build the immutable knowledge graph from sources.
 *
 * Pure functional core: reads every source file under data/, validates with
 * Zod, assembles in-memory maps + indexes, returns a frozen KnowledgeGraph.
 * No I/O after construction; every query function is O(1) or O(N) memory
 * lookup against pre-built indexes.
 *
 * Errors fail-fast (per docs/architecture.md §4 decision #5). The dev
 * escape hatch `ALLOW_PARTIAL_DATA=1` flows through strictLoadDir and
 * strictReadJson — set it for local debugging, never in CI / production.
 *
 * Async signature reserves room for future I/O parallelism even though
 * the current implementation is synchronous internally.
 */

import path from 'node:path';

import {
  strictReadJson,
  strictLoadDir,
} from '../lib/strict-load.js';
import {
  resolveSector,
  SENTINEL_UNCATEGORIZED,
} from './sector-resolver.js';
import { pickLatestScore } from './score-strategy.js';

import {
  OccupationSchema,
  TranslationENSchema,
  StatsLegacySchema,
  ScoreRunSchema,
  SectorsFileSchema,
  SectorOverridesSchema,
  LabelsFileSchema,
  type Occupation,
  type TranslationEN,
  type StatsLegacy,
  type ScoreRun,
  type LabelEntry,
  type SectorDef,
} from '../data/schema/index.js';

import {
  asOccupationId,
  asSectorId,
  asSkillId,
  asKnowledgeId,
  asAbilityId,
  asInterestId,
  asWorkValueId,
  asWorkCharacteristicId,
  asWorkActivityId,
  type OccupationId,
  type SectorId,
  type SkillId,
  type KnowledgeId,
  type AbilityId,
  type InterestId,
  type WorkValueId,
  type WorkCharacteristicId,
  type WorkActivityId,
} from './ids.js';

import type {
  AiRiskScore,
  DimensionLabel,
  HueBand,
  KnowledgeGraph,
  OccupationAbilityEdge,
  OccupationInterestEdge,
  OccupationKnowledgeEdge,
  OccupationNode,
  OccupationSkillEdge,
  OccupationWorkActivityEdge,
  OccupationWorkCharacteristicEdge,
  OccupationWorkValueEdge,
  SectorNode,
  WeightedEdge,
} from './types.js';

const REPO_ROOT = process.cwd();
const DATA_ROOT = path.join(REPO_ROOT, 'data');

// ─── public entrypoint ───────────────────────────────────────────

// Module-level memoization. The graph is Object.freeze'd at construction
// and doc §3.4 forbids mutation during build, so a single instance can
// be safely shared across all callers in one Node process. Without this,
// each Astro `.astro` frontmatter call rebuilt the graph from scratch
// (~120ms × 600+ pages = 70+ s of pure rebuild cost). Phase D audit #9
// (2026-05-14): build time 150s → ~35s.
//
// The cache holds the Promise (not the resolved KnowledgeGraph) so
// concurrent first-callers all await the same in-flight build instead
// of racing duplicate builds.
let _cachedGraph: Promise<KnowledgeGraph> | null = null;

/** Test-only reset hook. Production code must not call this. */
export function _resetGraphCacheForTests(): void {
  _cachedGraph = null;
}

export function loadGraph(): Promise<KnowledgeGraph> {
  if (_cachedGraph !== null) return _cachedGraph;
  _cachedGraph = buildGraph();
  return _cachedGraph;
}

async function buildGraph(): Promise<KnowledgeGraph> {
  // 1. Load raw source data (fail-fast on any schema mismatch).
  const occupations = loadOccupations();
  const translations = loadTranslations();
  const stats = loadStats();
  const scoreRuns = loadScoreRuns();
  // Cast both to z.output types — same reason as the loadXxx helpers below.
  const sectorsFile = strictReadJson(
    path.join(DATA_ROOT, 'sectors', 'sectors.ja-en.json'),
    SectorsFileSchema,
    'graph.sectors',
  ) as { sectors: SectorDef[] };
  const overridesFile = strictReadJson(
    path.join(DATA_ROOT, 'sectors', 'overrides.json'),
    SectorOverridesSchema,
    'graph.sectors.overrides',
  ) as { overrides: Record<string, string> };
  const labelsByDim = loadAllLabels();

  // 2. Per-occupation auxiliaries: id-keyed maps for O(1) join.
  const translationsById = mapById(translations);
  const statsById = mapById(stats);
  const latestScoreByOcc = computeLatestScores(scoreRuns);

  // 3. Build the OccupationNode map.
  const occupationsMap = new Map<OccupationId, OccupationNode>();
  for (const occ of occupations) {
    const id = asOccupationId(occ.id);
    occupationsMap.set(id, buildOccupationNode(
      id,
      occ,
      translationsById.get(occ.id) ?? null,
      statsById.get(occ.id) ?? null,
      latestScoreByOcc.get(occ.id) ?? null,
    ));
  }

  // 4. Build the SectorNode map.
  const sectorsMap = new Map<SectorId, SectorNode>();
  for (const sec of sectorsFile.sectors) {
    const id = asSectorId(sec.id);
    sectorsMap.set(id, {
      id,
      nameJa: sec.ja,
      nameEn: sec.en,
      hue: sec.hue as HueBand,
      descriptionJa: sec.description_ja ?? null,
      // .default([]) in the Zod schema means this is always defined at
      // runtime, but strict-load's generic z.ZodSchema<T> picks the Input
      // type where it's optional — fall back defensively.
      mhlwSeedCodes: sec.mhlw_seed_codes ?? [],
    });
  }

  // 5. Build the 7 dimension-label maps.
  const skills              = buildDimensionMap<SkillId>(labelsByDim.get('skills'),               asSkillId);
  const knowledge           = buildDimensionMap<KnowledgeId>(labelsByDim.get('knowledge'),           asKnowledgeId);
  const abilities           = buildDimensionMap<AbilityId>(labelsByDim.get('abilities'),           asAbilityId);
  const interests           = buildDimensionMap<InterestId>(labelsByDim.get('interests'),           asInterestId);
  const workValues          = buildDimensionMap<WorkValueId>(labelsByDim.get('work_values'),          asWorkValueId);
  const workCharacteristics = buildDimensionMap<WorkCharacteristicId>(labelsByDim.get('work_characteristics'), asWorkCharacteristicId);
  const workActivities      = buildDimensionMap<WorkActivityId>(labelsByDim.get('work_activities'),      asWorkActivityId);

  // 6. Sector edges: derive per-occupation, also invert into bySector.
  const sectorByOcc = new Map<OccupationId, SectorId>();
  const occupationsBySectorIdx = new Map<SectorId, OccupationId[]>();
  for (const occ of occupations) {
    const occId = asOccupationId(occ.id);
    const assignment = resolveSector(
      occ.id,
      occ.classifications.mhlw_main,
      sectorsFile.sectors,
      overridesFile.overrides,
    );
    if (assignment.sector_id === SENTINEL_UNCATEGORIZED) continue;
    const secId = asSectorId(assignment.sector_id);
    sectorByOcc.set(occId, secId);
    let bucket = occupationsBySectorIdx.get(secId);
    if (!bucket) {
      bucket = [];
      occupationsBySectorIdx.set(secId, bucket);
    }
    bucket.push(occId);
  }

  // 7. Dimension edges: iterate the inline weight maps on each occupation.
  const skillsEdges              = new Map<OccupationId, readonly OccupationSkillEdge[]>();
  const knowledgeEdges           = new Map<OccupationId, readonly OccupationKnowledgeEdge[]>();
  const abilityEdges             = new Map<OccupationId, readonly OccupationAbilityEdge[]>();
  const interestEdges            = new Map<OccupationId, readonly OccupationInterestEdge[]>();
  const workValueEdges           = new Map<OccupationId, readonly OccupationWorkValueEdge[]>();
  const workCharacteristicEdges  = new Map<OccupationId, readonly OccupationWorkCharacteristicEdge[]>();
  const workActivityEdges        = new Map<OccupationId, readonly OccupationWorkActivityEdge[]>();

  for (const occ of occupations) {
    const occId = asOccupationId(occ.id);
    skillsEdges.set(             occId, buildWeightedEdges(occId, occ.skills              ?? null, asSkillId));
    knowledgeEdges.set(          occId, buildWeightedEdges(occId, occ.knowledge           ?? null, asKnowledgeId));
    abilityEdges.set(            occId, buildWeightedEdges(occId, occ.abilities           ?? null, asAbilityId));
    interestEdges.set(           occId, buildWeightedEdges(occId, occ.interests           ?? null, asInterestId));
    workValueEdges.set(          occId, buildWeightedEdges(occId, occ.work_values         ?? null, asWorkValueId));
    workCharacteristicEdges.set( occId, buildWeightedEdges(occId, occ.work_characteristics?? null, asWorkCharacteristicId));
    workActivityEdges.set(       occId, buildWeightedEdges(occId, occ.work_activities     ?? null, asWorkActivityId));
  }

  // Freeze the invert-index buckets so consumers can't mutate them.
  for (const [secId, bucket] of occupationsBySectorIdx) {
    occupationsBySectorIdx.set(secId, Object.freeze([...bucket]) as OccupationId[]);
  }

  // 8. Assemble the graph with closure-captured indexes.
  const graph: KnowledgeGraph = {
    occupations: occupationsMap,
    sectors: sectorsMap,
    skills,
    knowledge,
    abilities,
    interests,
    workValues,
    workCharacteristics,
    workActivities,

    sectorOf: (id) => sectorByOcc.get(id) ?? null,
    occupationsBySector: (id) => occupationsBySectorIdx.get(id) ?? EMPTY_OCC_LIST,

    skillsOf:              (id) => skillsEdges.get(id)             ?? EMPTY_EDGES,
    knowledgeOf:           (id) => knowledgeEdges.get(id)          ?? EMPTY_EDGES,
    abilitiesOf:           (id) => abilityEdges.get(id)            ?? EMPTY_EDGES,
    interestsOf:           (id) => interestEdges.get(id)           ?? EMPTY_EDGES,
    workValuesOf:          (id) => workValueEdges.get(id)          ?? EMPTY_EDGES,
    workCharacteristicsOf: (id) => workCharacteristicEdges.get(id) ?? EMPTY_EDGES,
    workActivitiesOf:      (id) => workActivityEdges.get(id)       ?? EMPTY_EDGES,
  };

  return Object.freeze(graph);
}

// ─── source-load helpers ─────────────────────────────────────────

const SUFFIX_JSON = (f: string) => f.endsWith('.json') && !f.startsWith('.');

// strict-load's `z.ZodSchema<T>` generic infers T from the schema, but for
// schemas that use `.default(...)` it picks the Input type (where the field
// is optional) instead of the Output type (where it's filled in). Every
// returning helper below casts to the schema's Output type — verified
// safe because strict-load actually invokes `schema.parse()` which always
// applies defaults.

function loadOccupations(): Occupation[] {
  return strictLoadDir(
    path.join(DATA_ROOT, 'occupations'),
    SUFFIX_JSON,
    OccupationSchema,
    'graph.occupations',
  ).items as Occupation[];
}

function loadTranslations(): TranslationEN[] {
  // Translations directory may be absent in early-stage repos; treat as
  // optional. strict-load throws on missing dir under strict mode, so
  // probe with a safe wrapper.
  try {
    return strictLoadDir(
      path.join(DATA_ROOT, 'translations', 'en'),
      SUFFIX_JSON,
      TranslationENSchema,
      'graph.translations.en',
    ).items as TranslationEN[];
  } catch (err) {
    // Re-throw only if it's not a missing-directory case. The strict-load
    // error format ends with the underlying ENOENT message — match that.
    if (/ENOENT/.test((err as Error).message)) return [];
    throw err;
  }
}

function loadStats(): StatsLegacy[] {
  return strictLoadDir(
    path.join(DATA_ROOT, 'stats_legacy'),
    SUFFIX_JSON,
    StatsLegacySchema,
    'graph.stats',
  ).items as StatsLegacy[];
}

function loadScoreRuns(): ScoreRun[] {
  return strictLoadDir(
    path.join(DATA_ROOT, 'scores'),
    SUFFIX_JSON,
    ScoreRunSchema,
    'graph.scores',
  ).items as ScoreRun[];
}

const LABEL_DIMENSIONS = [
  'abilities',
  'interests',
  'knowledge',
  'skills',
  'work_activities',
  'work_characteristics',
  'work_values',
] as const;

function loadAllLabels(): Map<string, Map<string, LabelEntry>> {
  const out = new Map<string, Map<string, LabelEntry>>();
  for (const dim of LABEL_DIMENSIONS) {
    const file = strictReadJson(
      path.join(DATA_ROOT, 'labels', `${dim}.ja-en.json`),
      LabelsFileSchema,
      `graph.labels.${dim}`,
    );
    const inner = new Map<string, LabelEntry>();
    for (const [key, entry] of Object.entries(file.labels)) inner.set(key, entry);
    out.set(file.dimension, inner);
  }
  return out;
}

// ─── derivation helpers ──────────────────────────────────────────

function mapById<T extends { id: number }>(items: readonly T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const it of items) m.set(it.id, it);
  return m;
}

interface RawScoreHist {
  model: string;
  date: string;
  ai_risk: number;
  rationale_ja: string;
  rationale_en: string;
  confidence?: number | null;
}

function computeLatestScores(runs: readonly ScoreRun[]): Map<number, AiRiskScore> {
  const history = new Map<number, RawScoreHist[]>();
  for (const run of runs) {
    if (run.scope !== 'occupations') continue;
    for (const [occIdStr, entry] of Object.entries(run.scores)) {
      const occId = Number.parseInt(occIdStr, 10);
      if (!Number.isFinite(occId)) continue; // bad key — surfaced by data-validation, ignore here
      let bucket = history.get(occId);
      if (!bucket) {
        bucket = [];
        history.set(occId, bucket);
      }
      bucket.push({
        model: run.scorer.model,
        date: run.run.run_date,
        ai_risk: entry.ai_risk,
        rationale_ja: entry.rationale_ja,
        rationale_en: entry.rationale_en,
        confidence: entry.confidence,
      });
    }
  }
  const latest = new Map<number, AiRiskScore>();
  for (const [occId, hist] of history) {
    hist.sort((a, b) => a.date.localeCompare(b.date));
    const pick = pickLatestScore(hist);
    latest.set(occId, {
      score: pick.ai_risk,
      rationaleJa: pick.rationale_ja,
      rationaleEn: pick.rationale_en,
      confidence: pick.confidence ?? null,
      model: pick.model,
      date: pick.date,
    });
  }
  return latest;
}

function buildOccupationNode(
  id: OccupationId,
  occ: Occupation,
  trans: TranslationEN | null,
  stats: StatsLegacy | null,
  aiRisk: AiRiskScore | null,
): OccupationNode {
  return {
    id,
    titleJa: occ.title_ja,
    titleEn: trans?.title_en ?? null,
    aliasesJa: occ.aliases_ja,
    aliasesEn: trans?.aliases_en ?? [],
    classifications: {
      mhlwMain: occ.classifications.mhlw_main ?? null,
      mhlwAll: occ.classifications.mhlw_all,
      jsocMain: occ.classifications.jsoc_main ?? null,
      jsocAll: occ.classifications.jsoc_all,
    },
    description: {
      summaryJa: occ.description.summary_ja ?? null,
      whatItIsJa: occ.description.what_it_is_ja ?? null,
      howToBecomeJa: occ.description.how_to_become_ja ?? null,
      workingConditionsJa: occ.description.working_conditions_ja ?? null,
    },
    url: occ.url,
    stats: stats === null ? null : {
      salaryManYen: stats.salary_man_yen ?? null,
      workers: stats.workers ?? null,
      monthlyHours: stats.monthly_hours ?? null,
      averageAge: stats.average_age ?? null,
      recruitWageManYen: stats.recruit_wage_man_yen ?? null,
      recruitRatio: stats.recruit_ratio ?? null,
    },
    aiRisk,
    relatedCertsJa: occ.related_certs_ja ?? [],
    educationDistribution: occ.education_distribution ?? null,
    employmentType:        occ.employment_type        ?? null,
    trainingPre:           occ.training_pre           ?? null,
    trainingPost:          occ.training_post          ?? null,
    experience:            occ.experience            ?? null,
    tasksCount: occ.tasks.length,
    tasksLeadJa: occ.tasks_lead_ja ?? null,
    relatedOrgs: (occ.related_orgs ?? []).map(o => ({
      nameJa: o.name_ja,
      url: o.url ?? null,
    })),
    dataSourceVersions: {
      ipdNumeric: occ.data_source_versions.ipd_numeric,
      ipdDescription: occ.data_source_versions.ipd_description,
      ipdRetrievedAt: occ.data_source_versions.ipd_retrieved_at,
    },
  };
}

function buildDimensionMap<TId extends string>(
  labels: ReadonlyMap<string, LabelEntry> | undefined,
  brand: (s: string) => TId,
): ReadonlyMap<TId, DimensionLabel<TId>> {
  const m = new Map<TId, DimensionLabel<TId>>();
  if (!labels) return m;
  for (const [key, entry] of labels) {
    const id = brand(key);
    m.set(id, {
      id,
      nameJa: entry.ja,
      nameEn: entry.en,
      onetId: entry.onet_id ?? null,
      note: entry.note ?? null,
    });
  }
  return m;
}

function buildWeightedEdges<TId>(
  from: OccupationId,
  weights: Record<string, number> | null | undefined,
  brand: (s: string) => TId,
): readonly WeightedEdge<OccupationId, TId>[] {
  if (!weights) return EMPTY_EDGES as readonly WeightedEdge<OccupationId, TId>[];
  const out: WeightedEdge<OccupationId, TId>[] = [];
  for (const [key, weight] of Object.entries(weights)) {
    out.push({ from, to: brand(key), weight });
  }
  return Object.freeze(out);
}

// Singleton empties — share one frozen array across every "no edges" lookup
// so consumers never get a mutable empty array. Typed as the most generic
// readonly tuple; cast at call sites where the specific edge type is needed.
const EMPTY_EDGES: readonly WeightedEdge<OccupationId, never>[] = Object.freeze([]);
const EMPTY_OCC_LIST: readonly OccupationId[] = Object.freeze([]);
