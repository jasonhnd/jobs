/**
 * TranslationEN schema — per docs/DATA_ARCHITECTURE.md §2.4.
 *
 * Source data file: data/translations/<lang>/<padded>.json (one per occupation per language).
 * Language layer is independent from main occupation source — IPD upgrades and translation
 * re-runs decouple cleanly.
 *
 * Migrated from data/schema/translation.py.
 */
import { z } from 'zod';

/**
 * English translation for one occupation.
 *
 * Per §2.4 翻译范围:
 *   - title_en: from main JSON title_ja
 *   - summary_en: from description.summary_ja (or full description condensed)
 *   - aliases_en: from aliases_ja
 *   - tasks_en: parallel array to tasks[].description_ja
 *
 * Standard label translations (skills/knowledge dim names) are NOT here —
 * see ./labels.ts (data/labels/*.ja-en.json, §2.5).
 */
export const TranslationENSchema = z
  .object({
    id: z.number().int().min(1).max(999),
    translator: z.string(), // e.g., "claude-opus-4-7"
    translated_at: z.string(), // ISO date YYYY-MM-DD
    source_data_version: z.string(), // what version of main data was translated, e.g., "ipd_v7.00"

    title_en: z.string().nullish(),
    summary_en: z.string().nullish(),
    aliases_en: z.array(z.string()).default([]),
    /** Parallel to tasks[]; null entry = not translated. */
    tasks_en: z.array(z.string().nullable()).default([]),

    // ── v1.1.0: long-form description fields (mobile detail page §5.4 / §9.3) ──
    // Run by scripts/translate_descriptions.py. Each may be null if not yet
    // translated; mobile frontend shows i18n key `detail.long_text.ja_only`
    // placeholder when blank. Optional fields so back-compat with legacy files
    // that pre-date v1.1.0 still validate.
    what_it_is_en: z.string().nullish(),
    how_to_become_en: z.string().nullish(),
    working_conditions_en: z.string().nullish(),
  })
  .strict();

export type TranslationEN = z.infer<typeof TranslationENSchema>;
