/**
 * Label dictionary schema — per docs/DATA_ARCHITECTURE.md §2.5.
 *
 * Source data file: data/labels/<dimension>.ja-en.json
 *   - dimension ∈ {skills, knowledge, abilities, work_characteristics,
 *                  work_activities, interests, work_values}
 *
 * Each file: shared global labels for all 556 occupations (avoid storing 556 times).
 *
 * Migrated from data/schema/labels.py.
 */
import { z } from 'zod';

/** One label: JA name (from IPD 細目) + EN name (from O*NET) + optional metadata. */
export const LabelEntrySchema = z
  .object({
    ja: z.string(),
    en: z.string(),
    onet_id: z.string().nullish(), // O*NET reference if applicable, e.g., "1.A.1.a.1"
    note: z.string().nullish(),
  })
  .strict();

export type LabelEntry = z.infer<typeof LabelEntrySchema>;

/** Top-level structure of one labels file (e.g., skills.ja-en.json). */
export const LabelsFileSchema = z
  .object({
    dimension: z.string(), // e.g., "skills"
    source: z.string(), // e.g., "O*NET 28.x + IPD 細目 v7.00"
    license: z.string(),
    count: z.number().int().min(1),
    labels: z.record(z.string(), LabelEntrySchema), // key → entry
  })
  .strict();

export type LabelsFile = z.infer<typeof LabelsFileSchema>;
