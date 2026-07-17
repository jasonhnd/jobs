/**
 * ScoreRun v2.0 schema — per docs/DATA_ARCHITECTURE.md §2.3.1.
 *
 * Source data file: data/scores/<scope>_<model-slug>_<run-date>.json
 *   - scope ∈ {occupations, tasks}
 *   - one file per scoring run, NEVER overwritten or deleted
 *
 * Migration from v1.0 (data/ai_scores_<date>.json):
 *   - Old fields r/j → new ai_risk/rationale_ja (rationale_en dropped
 *     2026-05-30 — site is Japanese-only, see CHANGELOG)
 *   - Missing metadata fields:
 *       - Optional[str] fields: "<unknown - migrated from v1.0>"
 *       - Optional[float/int] fields: null
 */
import { z } from 'zod';

// One-decimal-place granularity (e.g. 6.9 ok; 6.95 rejected). FP-tolerant
// because 6.9 * 10 === 69.00000000000001 in JS. Integers still pass (7 → 7.0).
const oneDecimalScore = z
  .number()
  .min(0)
  .max(10)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, {
    message: 'must have at most one decimal place',
  });

const AIOIS_INDEX_TOLERANCE = 0.05 + 1e-9;

/**
 * AIOIS-10 profile — the 10 orthogonal dimensions (D1–D10) plus the two derived
 * indices, per docs/AIOIS-10.md. Present on batches scored under the AIOIS-10
 * standard; absent (nullish) on legacy single-axis batches. The headline
 * `ai_risk` of an AIOIS batch equals `transformation`.
 */
export const Aiois10Schema = z
  .object({
    d1: oneDecimalScore, d2: oneDecimalScore, d3: oneDecimalScore, d4: oneDecimalScore, d5: oneDecimalScore,
    d6: oneDecimalScore, d7: oneDecimalScore, d8: oneDecimalScore, d9: oneDecimalScore, d10: oneDecimalScore,
    transformation: oneDecimalScore, // mean(D1,D2) — "how much AI reshapes the work"
    displacement: oneDecimalScore, // replacement / contraction risk
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected = (value.d1 + value.d2) / 2;
    if (Math.abs(value.transformation - expected) > AIOIS_INDEX_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transformation'],
        message: `must equal mean(d1,d2) within ±0.05 (expected ${expected.toFixed(2)})`,
      });
    }
  });

export type Aiois10 = z.infer<typeof Aiois10Schema>;

/** One scored unit (occupation or task). */
export const ScoreEntrySchema = z
  .object({
    ai_risk: oneDecimalScore,
    rationale_ja: z.string(),
    confidence: z.number().min(0).max(1).nullish(),
    aiois: Aiois10Schema.nullish(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.aiois != null && value.ai_risk !== value.aiois.transformation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ai_risk'],
        message: `must equal aiois.transformation (${value.aiois.transformation})`,
      });
    }
  });

export type ScoreEntry = z.infer<typeof ScoreEntrySchema>;

/** Which model did the scoring. */
export const ScorerSchema = z
  .object({
    model: z.string(), // e.g., "claude-opus-4-7"
    model_provider: z.string(), // e.g., "anthropic"
    model_temperature: z.number().min(0).max(2).nullish(),
    scoring_method: z.string(), // e.g., "single-pass per occupation"
  })
  .strict();

export type Scorer = z.infer<typeof ScorerSchema>;

/** When and how this run executed. */
export const RunMetaSchema = z
  .object({
    run_date: z.string(), // ISO date YYYY-MM-DD
    run_id: z.string(), // human-readable identifier
    duration_minutes: z.number().min(0).nullish(),
    operator: z.string().nullish(), // GitHub username or similar
  })
  .strict();

export type RunMeta = z.infer<typeof RunMetaSchema>;

/** Source data the scoring was run against. */
export const InputMetaSchema = z
  .object({
    input_data_version: z.string(), // e.g., "ipd_v7.00"
    input_data_sha256: z.string().nullish(),
    occupation_count_scored: z.number().int().min(0),
    occupation_count_skipped: z.number().int().min(0),
  })
  .strict();

export type InputMeta = z.infer<typeof InputMetaSchema>;

/** Prompt / rubric used. */
export const PromptMetaSchema = z
  .object({
    prompt_version: z.string(),
    prompt_file: z.string(),
    prompt_sha256: z.string().nullish(),
    rubric_source: z.string(),
  })
  .strict();

export type PromptMeta = z.infer<typeof PromptMetaSchema>;

/** A complete AI scoring run record. */
export const ScoreRunSchema = z
  .object({
    schema_version: z.string().default('2.1'),
    scope: z.enum(['occupations', 'tasks']),
    scorer: ScorerSchema,
    run: RunMetaSchema,
    input: InputMetaSchema,
    prompt: PromptMetaSchema,
    anchors: z.record(z.string(), z.string()), // e.g., {"0-1": "Minimal: ...", ...}
    caveat: z.string(),
    scores: z.record(z.string(), ScoreEntrySchema), // key: occupation_id (or "<occ_id>:<task_id>") as string
  })
  .strict();

export type ScoreRun = z.infer<typeof ScoreRunSchema>;
