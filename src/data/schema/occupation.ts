/**
 * Source occupation schema — per docs/DATA_ARCHITECTURE.md §5.1.
 *
 * Source data file: data/occupations/<padded>.json (one per occupation, 4-digit padded id).
 * Does NOT contain stats_legacy (separate file, see ./stats-legacy.ts).
 * Does NOT contain English translations (those live in data/translations/en/<padded>.json).
 *
 * Null rules per §5.4:
 *   - 12 numeric subdivisions (interests..employment_type) integral block:
 *       - present and complete OR entirely null (not dict with all-None values)
 *   - tasks: empty list [] when known no tasks; never null
 *   - tasks_lead_ja: null when IPD タスク_リード文 absent
 *   - single-field absence within a present block: null (not omit key)
 *
 * Migrated from data/schema/occupation.py — keep structurally identical so byte-diff
 * validation against the Python ETL output passes (Track B, MIGRATION_PLAN.md).
 */
import { z } from 'zod';

// ---------- Sub-models ----------

/** 02 名称・分類領域 — classifications block. */
export const ClassificationsSchema = z
  .object({
    mhlw_main: z.string().nullish(), // e.g., "12_072-06"
    mhlw_all: z.array(z.string()).default([]),
    jsoc_main: z.string().nullish(), // e.g., "H533"
    jsoc_all: z.array(z.string()).default([]),
  })
  .strict();

export type Classifications = z.infer<typeof ClassificationsSchema>;

/** 03 解説領域 (text portion) — JA only; EN lives in translations layer. */
export const DescriptionSchema = z
  .object({
    summary_ja: z.string().nullish(),
    what_it_is_ja: z.string().nullish(),
    how_to_become_ja: z.string().nullish(),
    working_conditions_ja: z.string().nullish(),
  })
  .strict();

export type Description = z.infer<typeof DescriptionSchema>;

/**
 * 05 タスク領域 — single task entry. Up to 37 per occupation.
 *
 * - task_id is positional within the occupation's task list (1-37).
 * - execution_rate is a fraction 0.0-1.0 (IPD field 実施率).
 * - importance is a 0-5 score (IPD field 重要度).
 */
export const TaskSchema = z
  .object({
    task_id: z.number().int().min(1).max(37),
    description_ja: z.string(),
    execution_rate: z.number().min(0).max(1).nullish(),
    importance: z.number().min(0).max(5).nullish(),
  })
  .strict();

export type Task = z.infer<typeof TaskSchema>;

/** 03 関連団体 entry — name + URL pair. */
export const RelatedOrgSchema = z
  .object({
    name_ja: z.string(),
    url: z.string().nullish(),
  })
  .strict();

export type RelatedOrg = z.infer<typeof RelatedOrgSchema>;

/** Provenance for this occupation's source data. */
export const DataSourceVersionsSchema = z
  .object({
    ipd_numeric: z.string(), // e.g., "v7.00"
    ipd_description: z.string(), // e.g., "v7.00"
    ipd_retrieved_at: z.string(), // ISO date YYYY-MM-DD
  })
  .strict();

export type DataSourceVersions = z.infer<typeof DataSourceVersionsSchema>;

// ---------- Main model ----------

/**
 * Top-level occupation record — one per file at data/occupations/<padded>.json.
 */
export const OccupationSchema = z
  .object({
    // ----- Identity & meta -----
    id: z.number().int().min(1).max(999),
    ipd_id: z.string().regex(/^IPD_01_01_\d+$/),
    schema_version: z.string().default('7.00'),
    ingested_at: z.string(), // ISO date

    // ----- Names & classifications -----
    title_ja: z.string(),
    aliases_ja: z.array(z.string()).max(25).default([]),

    classifications: ClassificationsSchema,
    description: DescriptionSchema,

    // ----- Numeric profile (12 subdivisions; whole-block-null per §5.4) -----
    // Each is dict[str, float] mapping label_key → score.
    interests: z.record(z.string(), z.number()).nullish(),
    work_values: z.record(z.string(), z.number()).nullish(),
    skills: z.record(z.string(), z.number()).nullish(),
    knowledge: z.record(z.string(), z.number()).nullish(),
    abilities: z.record(z.string(), z.number()).nullish(),
    work_characteristics: z.record(z.string(), z.number()).nullish(),
    work_activities: z.record(z.string(), z.number()).nullish(),
    education_distribution: z.record(z.string(), z.number()).nullish(),
    training_pre: z.record(z.string(), z.number()).nullish(),
    training_post: z.record(z.string(), z.number()).nullish(),
    experience: z.record(z.string(), z.number()).nullish(),
    employment_type: z.record(z.string(), z.number()).nullish(),

    // ----- Tasks -----
    tasks_lead_ja: z.string().nullish(),
    tasks: z.array(TaskSchema).max(37).default([]),

    // ----- Related entities -----
    related_orgs: z.array(RelatedOrgSchema).max(10).default([]),
    related_certs_ja: z.array(z.string()).max(35).default([]),

    // ----- External link -----
    url: z.string(),

    // ----- Provenance -----
    data_source_versions: DataSourceVersionsSchema,
    last_updated_per_section: z.record(z.string(), z.number().int()).default({}),
  })
  .strict();

export type Occupation = z.infer<typeof OccupationSchema>;
