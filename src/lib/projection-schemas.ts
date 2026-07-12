/**
 * src/lib/projection-schemas.ts — runtime Zod schemas for the
 * public/data.* and data/sectors/* JSON projections that downstream
 * pages + the OG endpoint consume.
 *
 * Lives under src/lib/ per §6.2 (general-purpose utility, no
 * forbidden imports). Migrated from src/data/lib/projection-schemas.ts
 * 2026-05-14 as part of Phase B continuation.
 *
 * Why runtime: TypeScript types are erased at compile time. Without a
 * runtime check, a corrupted projection (mid-rsync deploy, manual edit,
 * future ETL bug) silently produces pages with empty content or wrong
 * fields. These schemas are intentionally LIBERAL — `passthrough` keeps
 * extra fields so adding a new field to the ETL doesn't force a schema
 * bump in lockstep, while still failing the build when a required field
 * goes missing or changes type.
 *
 * Scope: the fields actually read by hub builders / OG renderer / sitemap.
 * Other fields are tolerated via passthrough. Update the schema only when
 * a new field becomes load-bearing in the consumer.
 */
import { z } from 'zod';

// ─── Per-occupation detail (public/data.detail/<padded>.json) ─────────

const DimensionEntrySchema = z.object({
  key: z.string(),
  label_ja: z.string(),
  score: z.number(),
});

export const DetailFileSchema = z
  .object({
    id: z.number().int(),
    title: z
      .object({
        ja: z.string().optional(),
      })
      .passthrough()
      .nullish(),
    ai_risk: z
      .object({
        score: z.number().nullish(),
        rationale_ja: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    risk_band: z.string().nullish(),
    description: z
      .object({
        summary_ja: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    stats: z
      .object({
        salary_man_yen: z.number().nullish(),
        workers: z.number().nullish(),
        monthly_hours: z.number().nullish(),
        average_age: z.number().nullish(),
        recruit_ratio: z.number().nullish(),
        recruit_wage_man_yen: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
    sector: z
      .object({
        id: z.string().nullish(),
        ja: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    related_certs_ja: z.array(z.string()).optional(),
    abilities_top5: z.array(DimensionEntrySchema).nullish(),
    knowledge_top5: z.array(DimensionEntrySchema).nullish(),
    skills_top10: z.array(DimensionEntrySchema).nullish(),
    work_values_top5: z.array(DimensionEntrySchema).nullish(),
    work_characteristics_top5: z.array(DimensionEntrySchema).nullish(),
    training_pre_top5: z.array(DimensionEntrySchema).nullish(),
    training_post_top5: z.array(DimensionEntrySchema).nullish(),
    experience_top5: z.array(DimensionEntrySchema).nullish(),
    education_distribution: z.record(z.string(), z.number()).nullish(),
    employment_type: z.record(z.string(), z.number()).nullish(),
  })
  .passthrough();

// ─── Sectors projection (public/data.sectors.json) ────────────────────

export const SectorRecordSchema = z
  .object({
    id: z.string(),
    ja: z.string(),
    hue: z.enum(['safe', 'mid', 'warm']),
    occupation_count: z.number(),
    mean_ai_risk: z.number(),
    total_workforce: z.number(),
    sample_titles_ja: z.array(z.string()).optional(),
  })
  .passthrough();

export const SectorsProjectionSchema = z
  .object({
    sectors: z.array(SectorRecordSchema),
  })
  .passthrough();

// ─── Worktype diagnostic projection (public/data.worktypes.json) ───────

export const WorktypeFamilyCodeSchema = z.enum([
  'CPB',
  'CPK',
  'CDB',
  'CDK',
  'RPB',
  'RPK',
  'RDB',
  'RDK',
]);

const WorktypeFamilyRecordSchema = z
  .object({
    familyId: z.string(),
    count: z.number().int().min(0),
    pct: z.number().min(0).max(100),
  })
  .passthrough();

const WorktypeOccupationRecordSchema = z
  .object({
    code: WorktypeFamilyCodeSchema,
    familyId: z.string(),
    exposure: z.number().int().min(0).max(3),
    rarityPct: z.number().min(0).max(100),
  })
  .passthrough();

export const WorktypesProjectionSchema = z
  .object({
    schema_version: z.literal('1.0'),
    families: z.record(WorktypeFamilyCodeSchema, WorktypeFamilyRecordSchema),
    variants: z.record(WorktypeFamilyCodeSchema, z.record(z.string(), z.string())),
    occupations: z.record(z.string().regex(/^\d+$/), WorktypeOccupationRecordSchema),
  })
  .passthrough();

export type WorktypesProjectionShape = z.infer<typeof WorktypesProjectionSchema>;

// ─── Multi-model score history (public/data.score_history.json) ───────

const ScoreHistoryDimsSchema = z
  .object({
    d1: z.number(), d2: z.number(), d3: z.number(), d4: z.number(), d5: z.number(),
    d6: z.number(), d7: z.number(), d8: z.number(), d9: z.number(), d10: z.number(),
  })
  .strict();

export const ScoreHistoryEntrySchema = z
  .object({
    model: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    transformation: z.number(),
    displacement: z.number().nullable(),
    dims: ScoreHistoryDimsSchema.nullable(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if ((entry.displacement === null) !== (entry.dims === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dims'],
        message: 'displacement and dims must be null together for legacy entries',
      });
    }
  });

export const ScoreHistoryProjectionSchema = z.record(
  z.string().regex(/^\d+$/),
  z.array(ScoreHistoryEntrySchema).min(1),
);

export type ScoreHistoryProjectionShape = z.infer<typeof ScoreHistoryProjectionSchema>;

// ─── /models magazine feature projection (public/data.models_deep.json) ───

const ModelsDeepPairBatchSchema = z
  .object({
    model: z.string(),
    modelDisplay: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const ModelsDeepModelCardSchema = z
  .object({
    model: z.string(),
    modelDisplay: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    covered_count: z.number().int().min(0),
    personality_sentence_id: z.string(),
  })
  .strict();

const ModelsDeepConsensusSchema = z
  .object({
    id: z.number().int(),
    title_ja: z.string(),
    href: z.string().regex(/^\/\d+$/),
  })
  .strict();

const ModelsDeepStorySchema = z
  .object({
    id: z.number().int(),
    title_ja: z.string(),
    href: z.string().regex(/^\/\d+$/),
    baseline_transformation: z.number(),
    candidate_transformation: z.number(),
    baseline_rationale_ja: z.string().min(1),
    candidate_rationale_ja: z.string().min(1),
    editorial_sentence_id: z.string(),
  })
  .strict();

export const ModelsDeepProjectionSchema = z
  .object({
    generated_at: z.string(),
    latest_pair: z
      .object({
        baseline: ModelsDeepPairBatchSchema,
        candidate: ModelsDeepPairBatchSchema,
        compared_count: z.number().int().min(1),
      })
      .strict(),
    model_cards: z.array(ModelsDeepModelCardSchema).min(1),
    consensus: z.array(ModelsDeepConsensusSchema).length(3),
    stories: z.array(ModelsDeepStorySchema).min(3).max(5),
  })
  .strict();

export type ModelsDeepProjectionShape = z.infer<typeof ModelsDeepProjectionSchema>;

// ─── Source sector definition (data/sectors/sectors.ja-en.json) ───────

const SectorDefSchema = z
  .object({
    id: z.string(),
    ja: z.string(),
    en: z.string(),
    hue: z.string(),
    description_ja: z.string().optional().default(''),
    mhlw_seed_codes: z.array(z.string()).default([]),
  })
  .passthrough();

export const SectorsSourceFileSchema = z
  .object({
    sectors: z.array(SectorDefSchema),
  })
  .passthrough();

// ─── Skill ranking projection (public/data.skills/<ipdKey>.json) ──────

export const SkillRankingFileSchema = z
  .object({
    skill_key: z.string(),
    label_ja: z.string(),
    occupations: z.array(
      z.object({
        id: z.number().int(),
        name_ja: z.string(),
        score: z.number(),
      }),
    ),
  })
  .passthrough();

export type SkillRankingFileShape = z.infer<typeof SkillRankingFileSchema>;

// ─── Holland projection (public/data.holland.json) ────────────────────

export const HollandFileSchema = z
  .object({
    cols: z.array(z.string()),
    rows: z.array(z.array(z.union([z.number(), z.string(), z.null()]))),
  })
  .passthrough();

// ─── Treemap projection (public/data.treemap.json) ────────────────────
// (Already validated in rankings.ts via its own local schema; provided
// here for hub loaders that read only id + a handful of fields.)

export const TreemapRecordSummarySchema = z
  .object({
    id: z.number().int(),
    ai_risk: z.number().nullable(),
    risk_band: z.string().nullable(),
    workers: z.number().nullable(),
    salary: z.number().nullable(),
    sector_id: z.string().optional(),
    sector_ja: z.string().optional(),
  })
  .passthrough();

export const TreemapFileSummarySchema = z.array(TreemapRecordSummarySchema);

export type TreemapRecordSummary = z.infer<typeof TreemapRecordSummarySchema>;
