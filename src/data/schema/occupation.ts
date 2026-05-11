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
 */
import { z } from 'zod';

// ---------- Shared primitives ----------

/**
 * URL string restricted to http: / https:. Stricter than `z.string().url()`
 * because we render these as `<a href="...">` — `javascript:` or `data:` URLs
 * in the source data would be a stored-XSS vector even though they're
 * authored, not user-submitted.
 */
const safeHttpUrl = z.string().refine(
  (s) => {
    try {
      const proto = new URL(s).protocol;
      return proto === 'http:' || proto === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'must be an http(s) URL' },
);

/**
 * IPD numeric dimension. 7 of the 12 numeric subdivisions are raw IPD scores
 * on a 0–7 scale (interests, work_values, skills, knowledge, abilities,
 * work_characteristics, work_activities). Sampled actuals: min 0.0, max 6.85
 * (scripts/sample-numeric-ranges.ts on 2026-05-11). Schema allows 0–7 with a
 * tiny margin in case future IPD versions hit the ceiling.
 */
const ipdScoreDimension = z
  .record(z.string(), z.number().min(0).max(7))
  .nullish();

/**
 * Percentage / fraction dimension. The other 5 subdivisions
 * (education_distribution, training_pre, training_post, experience,
 * employment_type) are fractions in [0, 1]. Sampled actuals match.
 */
const fractionDimension = z
  .record(z.string(), z.number().min(0).max(1))
  .nullish();

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
    url: safeHttpUrl.nullish(),
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
    // Each is dict[str, float] mapping label_key → score. Ranges below are
    // enforced by Zod so an out-of-band score (e.g. -1, 99) fails the build
    // before propagating to rankings / treemap / OG. See `ipdScoreDimension`
    // and `fractionDimension` above for the rationale and observed ranges.
    interests: ipdScoreDimension,
    work_values: ipdScoreDimension,
    skills: ipdScoreDimension,
    knowledge: ipdScoreDimension,
    abilities: ipdScoreDimension,
    work_characteristics: ipdScoreDimension,
    work_activities: ipdScoreDimension,
    education_distribution: fractionDimension,
    training_pre: fractionDimension,
    training_post: fractionDimension,
    experience: fractionDimension,
    employment_type: fractionDimension,

    // ----- Tasks -----
    tasks_lead_ja: z.string().nullish(),
    tasks: z.array(TaskSchema).max(37).default([]),

    // ----- Related entities -----
    related_orgs: z.array(RelatedOrgSchema).max(10).default([]),
    related_certs_ja: z.array(z.string()).max(35).default([]),

    // ----- External link -----
    url: safeHttpUrl,

    // ----- Provenance -----
    data_source_versions: DataSourceVersionsSchema,
    last_updated_per_section: z.record(z.string(), z.number().int()).default({}),
  })
  .strict();

export type Occupation = z.infer<typeof OccupationSchema>;
