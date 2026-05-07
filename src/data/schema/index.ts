/**
 * Zod schemas for source data validation.
 *
 * Migrated from data/schema/*.py per docs/MIGRATION_PLAN.md (Track B-1, PR 2).
 * One-to-one structural correspondence with the Pydantic schemas — keep them
 * in sync until the legacy Python schemas are deleted in Track D · PR 36.
 *
 * Import pattern:
 *   import { OccupationSchema, type Occupation } from '@/data/schema';
 *   const occ = OccupationSchema.parse(rawJson);  // throws on invalid
 */

export * from './occupation.js';
export * from './stats-legacy.js';
export * from './score-run.js';
export * from './labels.js';
export * from './sector.js';
export * from './translation.js';
