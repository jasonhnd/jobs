/**
 * ScoreRun v2.0 schema — per docs/DATA_ARCHITECTURE.md §2.3.1.
 *
 * Source data file: data/scores/<scope>_<model-slug>_<run-date>.json
 *   - scope ∈ {occupations, tasks}
 *   - one file per scoring run, NEVER overwritten or deleted
 *
 * Migration from v1.0 (data/ai_scores_<date>.json):
 *   - Old fields r/j/e → new ai_risk/rationale_ja/rationale_en
 *   - Missing metadata fields:
 *       - Optional[str] fields: "<unknown - migrated from v1.0>"
 *       - Optional[float/int] fields: null
 *
 * Migrated from data/schema/score_run.py.
 */
import { z } from 'zod';

/** One scored unit (occupation or task). */
export const ScoreEntrySchema = z
  .object({
    ai_risk: z.number().int().min(0).max(10),
    rationale_ja: z.string(),
    rationale_en: z.string(),
    confidence: z.number().min(0).max(1).nullish(),
  })
  .strict();

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
    schema_version: z.string().default('2.0'),
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
