/**
 * StatsLegacy schema — per docs/DATA_ARCHITECTURE.md §5.2.
 *
 * Source data file: data/stats_legacy/<padded>.json (one per occupation).
 * Independent from OccupationSchema (§1 separation principle).
 * File absence = no stats (e.g., 4 new IPD occupations 581-584).
 * Field null within present file = partial data.
 *
 * Migrated from data/schema/stats_legacy.py.
 */
import { z } from 'zod';

/**
 * Six labor-market statistics for one occupation.
 *
 * Sources (per §2.2):
 *   salary_man_yen / monthly_hours / average_age → 賃金構造基本統計調査
 *   workers → 労働力調査
 *   recruit_wage_man_yen / recruit_ratio → ハローワーク求人統計
 *
 * All converged into jobtag.mhlw.go.jp page; this file freezes the scrape.
 */
export const StatsLegacySchema = z
  .object({
    id: z.number().int().min(1).max(999),
    schema_version: z.string().default('1.0'),
    source: z.string(), // e.g., "jobtag_scrape_2026-04-25"

    salary_man_yen: z.number().min(0).nullish(), // 万円/year
    workers: z.number().int().min(0).nullish(), // 人
    monthly_hours: z.number().int().min(0).nullish(), // 時間/month
    average_age: z.number().min(0).max(100).nullish(), // 歳
    recruit_wage_man_yen: z.number().min(0).nullish(), // 万円/month
    recruit_ratio: z.number().min(0).nullish(), // 倍 (effective opening ratio)
  })
  .strict();

export type StatsLegacy = z.infer<typeof StatsLegacySchema>;
