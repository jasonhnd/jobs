/**
 * Sector taxonomy schema — per docs/DATA_ARCHITECTURE.md §6.11.
 *
 * Two source files at `data/sectors/`:
 *
 *   sectors.ja-en.json — sector definitions (id, ja, en, hue, mhlw_seed_codes).
 *                        Single source of truth for what sectors exist and
 *                        which MHLW codes each one auto-claims.
 *
 *   overrides.json     — per-occupation manual overrides:
 *                           { "<occ_id>": "<sector_id>" }
 *                        Used only for occupations whose mhlw_main does not
 *                        uniquely match a sector. Multi-match or no-match
 *                        cases land in dist/data.review_queue.json and the
 *                        operator resolves them by editing this file.
 *
 * Resolution rule (sector-resolver.ts, Track B-2 PR 6):
 *   1. If overrides has the occ_id → that sector_id wins (provenance: 'override').
 *   2. Else match occ.mhlw_main against every sector's seed_codes (glob match):
 *      - exactly 1 sector matches → that sector wins (provenance: 'auto').
 *      - 0 matches               → '_uncategorized' + review_queue entry
 *                                    (provenance: 'unmatched').
 *      - >1 matches              → first match wins, but flagged in
 *                                    review_queue (provenance: 'auto-ambiguous').
 *   3. If occ has no mhlw_main at all → '_uncategorized' (provenance: 'no-mhlw').
 *
 * Seed code grammar (matched against full mhlw_main string like "12_072-06"):
 *   - Exact match:   "12_072-06"
 *   - Trailing star: "12_*"            (any code starting with "12_")
 *   - Prefix slash:  "12_072*"          (any code starting with "12_072")
 *   - Multiple seeds OR'd together inside one sector.
 *
 * Migrated from data/schema/sector.py.
 */
import { z } from 'zod';

/**
 * Visual tint band — used by treemap as a *fallback* color hint when the
 * specific occupation's ai_risk is not yet known. Real per-tile color in the
 * treemap always comes from ai_risk; this is just the sector's "default mood".
 *   - safe : low-risk territory (e.g., 医療, 介護)
 *   - mid  : sand / mixed         (e.g., 事務, 販売)
 *   - warm : leaning automatable  (e.g., 軽作業, メンテ)
 *   - risk : highest-risk default (rarely used)
 */
export const HueBandSchema = z.enum(['safe', 'mid', 'warm', 'risk']);

export type HueBand = z.infer<typeof HueBandSchema>;

/** One sector in the taxonomy. */
export const SectorDefSchema = z
  .object({
    /** Stable slug, never changes (e.g., "iryo", "kaigo"). URL-safe, lowercase, ASCII. */
    id: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z][a-z0-9_]*$/),
    /** Display label JA — may evolve, do not break links. */
    ja: z.string().min(1).max(24),
    /** Display label EN — may evolve, do not break links. */
    en: z.string().min(1).max(48),
    hue: HueBandSchema,
    /** 1-line internal description for editor reference. */
    description_ja: z.string().nullish(),
    /**
     * List of glob patterns matched against occupation.classifications.mhlw_main.
     * Order does not affect resolution unless multi-match — first match wins (then flagged).
     */
    mhlw_seed_codes: z.array(z.string()).default([]),
  })
  .strict();

export type SectorDef = z.infer<typeof SectorDefSchema>;

/** Top-level structure of `data/sectors/sectors.ja-en.json`. */
export const SectorsFileSchema = z
  .object({
    schema_version: z.string().default('1.0'),
    description: z.string(),
    sectors: z.array(SectorDefSchema).min(1).max(32),
  })
  .strict();

export type SectorsFile = z.infer<typeof SectorsFileSchema>;

/**
 * Top-level structure of `data/sectors/overrides.json`.
 *
 * Maps padded occupation id (string) → sector_id (string).
 * Padded id format `0001`-`9999` matches the on-disk file naming so manual
 * edits can be done by glancing at the occupations directory.
 */
export const SectorOverridesSchema = z
  .object({
    schema_version: z.string().default('1.0'),
    description: z.string(),
    overrides: z.record(z.string(), z.string()).default({}),
  })
  .strict();

export type SectorOverrides = z.infer<typeof SectorOverridesSchema>;
