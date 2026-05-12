/**
 * Knowledge graph node and edge types + the KnowledgeGraph interface.
 *
 * The graph is the in-memory domain model that views (src/views/, to come)
 * query against. It does NOT know HTML exists. It does NOT do I/O after
 * construction. It is fully immutable for its lifetime.
 *
 * See docs/architecture.md §2.2 for the layer contract.
 */

import type {
  OccupationId,
  SectorId,
  SkillId,
  KnowledgeId,
  AbilityId,
  InterestId,
  WorkValueId,
  WorkCharacteristicId,
  WorkActivityId,
} from './ids.js';

// ─── Shared shapes ───────────────────────────────────────────────

/** Visual hue band reused from source sector schema. */
export type HueBand = 'safe' | 'mid' | 'warm' | 'risk';

/** Bilingual label common to every dimension entry. */
export interface DimensionLabel<TId> {
  readonly id: TId;
  readonly nameJa: string;
  readonly nameEn: string;
  readonly onetId: string | null;
  readonly note: string | null;
}

/** Generic weighted edge — used for every Occupation→DimensionLabel edge. */
export interface WeightedEdge<TFrom, TTo> {
  readonly from: TFrom;
  readonly to: TTo;
  readonly weight: number;
}

// ─── Occupation node ─────────────────────────────────────────────

export interface OccupationStats {
  readonly salaryManYen: number | null;
  readonly workers: number | null;
  readonly monthlyHours: number | null;
  readonly averageAge: number | null;
  readonly recruitWageManYen: number | null;
  readonly recruitRatio: number | null;
}

export interface AiRiskScore {
  /** 0-10 integer score. */
  readonly score: number;
  readonly rationaleJa: string;
  readonly rationaleEn: string;
  readonly confidence: number | null;
  /** Model name (e.g., "claude-opus-4-7"). */
  readonly model: string;
  /** ISO date YYYY-MM-DD of the scoring run. */
  readonly date: string;
}

export interface OccupationClassifications {
  readonly mhlwMain: string | null;
  readonly mhlwAll: readonly string[];
  readonly jsocMain: string | null;
  readonly jsocAll: readonly string[];
}

export interface OccupationDescription {
  readonly summaryJa: string | null;
  readonly whatItIsJa: string | null;
  readonly howToBecomeJa: string | null;
  readonly workingConditionsJa: string | null;
}

export interface OccupationNode {
  readonly id: OccupationId;
  readonly titleJa: string;
  readonly titleEn: string | null;
  readonly aliasesJa: readonly string[];
  readonly aliasesEn: readonly string[];
  readonly classifications: OccupationClassifications;
  readonly description: OccupationDescription;
  /** External jobtag URL. */
  readonly url: string;
  /** Workforce stats — null when no stats_legacy file exists for this occupation. */
  readonly stats: OccupationStats | null;
  /** Latest AI risk score — null when this occupation has never been scored. */
  readonly aiRisk: AiRiskScore | null;
  /** Related Japanese certifications mentioned on the source jobtag page. */
  readonly relatedCertsJa: readonly string[];
  /**
   * Inline fraction distributions copied verbatim from the source file.
   * Keys are EN-snake-case (e.g. 'high_school', 'regular_employee') and
   * values are fractions in [0, 1]. `null` when the source omits the block.
   * These power the education / training / employment-type / experience
   * hub families.
   */
  readonly educationDistribution: Record<string, number> | null;
  readonly employmentType:        Record<string, number> | null;
  readonly trainingPre:           Record<string, number> | null;
  readonly trainingPost:          Record<string, number> | null;
  readonly experience:            Record<string, number> | null;
}

// ─── Sector node ─────────────────────────────────────────────────

export interface SectorNode {
  readonly id: SectorId;
  readonly nameJa: string;
  readonly nameEn: string;
  readonly hue: HueBand;
  readonly descriptionJa: string | null;
  /** mhlw_main glob patterns that automatically claim occupations for this sector. */
  readonly mhlwSeedCodes: readonly string[];
}

// ─── Dimension nodes ─────────────────────────────────────────────

export type SkillNode               = DimensionLabel<SkillId>;
export type KnowledgeNode           = DimensionLabel<KnowledgeId>;
export type AbilityNode             = DimensionLabel<AbilityId>;
export type InterestNode            = DimensionLabel<InterestId>;
export type WorkValueNode           = DimensionLabel<WorkValueId>;
export type WorkCharacteristicNode  = DimensionLabel<WorkCharacteristicId>;
export type WorkActivityNode        = DimensionLabel<WorkActivityId>;

// ─── Edge types ──────────────────────────────────────────────────

export type OccupationSkillEdge              = WeightedEdge<OccupationId, SkillId>;
export type OccupationKnowledgeEdge          = WeightedEdge<OccupationId, KnowledgeId>;
export type OccupationAbilityEdge            = WeightedEdge<OccupationId, AbilityId>;
export type OccupationInterestEdge           = WeightedEdge<OccupationId, InterestId>;
export type OccupationWorkValueEdge          = WeightedEdge<OccupationId, WorkValueId>;
export type OccupationWorkCharacteristicEdge = WeightedEdge<OccupationId, WorkCharacteristicId>;
export type OccupationWorkActivityEdge       = WeightedEdge<OccupationId, WorkActivityId>;

// ─── KnowledgeGraph interface ────────────────────────────────────

export interface KnowledgeGraph {
  // Node maps
  readonly occupations:         ReadonlyMap<OccupationId, OccupationNode>;
  readonly sectors:             ReadonlyMap<SectorId, SectorNode>;
  readonly skills:              ReadonlyMap<SkillId, SkillNode>;
  readonly knowledge:           ReadonlyMap<KnowledgeId, KnowledgeNode>;
  readonly abilities:           ReadonlyMap<AbilityId, AbilityNode>;
  readonly interests:           ReadonlyMap<InterestId, InterestNode>;
  readonly workValues:          ReadonlyMap<WorkValueId, WorkValueNode>;
  readonly workCharacteristics: ReadonlyMap<WorkCharacteristicId, WorkCharacteristicNode>;
  readonly workActivities:      ReadonlyMap<WorkActivityId, WorkActivityNode>;

  // Edge queries (pure, O(1) or O(N) lookups against pre-built indexes)
  sectorOf(id: OccupationId): SectorId | null;
  occupationsBySector(id: SectorId): readonly OccupationId[];

  skillsOf(id: OccupationId):              readonly OccupationSkillEdge[];
  knowledgeOf(id: OccupationId):           readonly OccupationKnowledgeEdge[];
  abilitiesOf(id: OccupationId):           readonly OccupationAbilityEdge[];
  interestsOf(id: OccupationId):           readonly OccupationInterestEdge[];
  workValuesOf(id: OccupationId):          readonly OccupationWorkValueEdge[];
  workCharacteristicsOf(id: OccupationId): readonly OccupationWorkCharacteristicEdge[];
  workActivitiesOf(id: OccupationId):      readonly OccupationWorkActivityEdge[];
}
