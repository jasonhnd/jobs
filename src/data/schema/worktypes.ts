import { z } from 'zod';

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

const AxisSchema = z.enum(['a1', 'a2', 'a3']);

const oneDecimalPct = z
  .number()
  .min(0)
  .max(100)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, {
    message: 'must have at most one decimal place',
  });

const ThresholdsSchema = z
  .object({
    a1: z.number().finite(),
    a2: z.number().finite(),
    a3: z.number().finite(),
  })
  .strict();

const FamilySchema = z
  .object({
    familyId: z.string().min(1),
    count: z.number().int().min(0),
    pct: oneDecimalPct,
  })
  .strict();

const OccupationWorktypeSchema = z
  .object({
    code: WorktypeFamilyCodeSchema,
    familyId: z.string().min(1),
    exposure: z.number().int().min(0).max(3),
    rarityPct: oneDecimalPct,
  })
  .strict();

const DistributionEntrySchema = z
  .object({
    count: z.number().int().min(0),
    pct: oneDecimalPct,
  })
  .strict();

const SmoothingAdjustmentSchema = z
  .object({
    occupationId: z.number().int().min(1),
    from: WorktypeFamilyCodeSchema,
    to: WorktypeFamilyCodeSchema,
    axis: AxisSchema,
    distance: z.number().finite().min(0),
  })
  .strict();

const CalibrationSchema = z
  .object({
    normalization: z.literal('z_score'),
    threshold_method: z.string().min(1),
    tie_break_rule: z.string().min(1),
    high_transformation_watch_threshold: z.number().min(0).max(10),
    guardrails: z
      .object({
        min_pct: z.number().min(0).max(100),
        max_pct: z.number().min(0).max(100),
        min_count: z.number().int().min(0),
        max_count: z.number().int().min(0),
      })
      .strict(),
    raw_distribution: z.record(WorktypeFamilyCodeSchema, DistributionEntrySchema),
    smoothing: z
      .object({
        method: z.string().min(1),
        adjustments: z.array(SmoothingAdjustmentSchema),
      })
      .strict(),
    variant_rarity: z
      .object({
        display: z.literal(false),
        reason: z.string().min(1),
      })
      .strict(),
    question_count_recommendation: z
      .object({
        mvp_questions: z.literal(9),
        note: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const WorktypesDataSchema = z
  .object({
    schema_version: z.literal('1.0'),
    generated_at: z.string().min(1),
    thresholds: ThresholdsSchema,
    families: z.record(WorktypeFamilyCodeSchema, FamilySchema),
    variants: z.record(
      WorktypeFamilyCodeSchema,
      z.record(z.string().min(1), z.string().min(1)),
    ),
    occupations: z.record(z.string().regex(/^\d+$/), OccupationWorktypeSchema),
    calibration: CalibrationSchema,
  })
  .strict();

export type WorktypesData = z.infer<typeof WorktypesDataSchema>;
export type WorktypeFamilyCode = z.infer<typeof WorktypeFamilyCodeSchema>;
