/**
 * Zod schemas for source data validation. Source of truth for what data files
 * under `data/` are allowed to look like; every file is validated through the
 * matching schema before any projection touches it.
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
export * from './worktypes.js';
