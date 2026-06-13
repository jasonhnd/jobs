/**
 * Build-time score attribution (active model + run date).
 *
 * This file is OVERWRITTEN by `bun src/data/build.ts` (run as part of
 * `npm run build:data` and the `build` chain). The values are derived from the
 * newest AIOIS-10 score batch under `data/scores/` — the model that produced
 * the scores the site currently shows, and that batch's run date.
 *
 * Why a committed default instead of pure auto-generation (same rationale as
 * src/lib/_content-date.ts):
 *   - `bun run typecheck` and any importer need the symbols to resolve BEFORE
 *     `build:data` has written them on a fresh checkout.
 *   - This module is intentionally fs-FREE so it is safe to bundle into the
 *     Vercel Edge runtime (the previous fs-reading version leaked node:fs into
 *     the middleware edge bundle and failed deploy). All fs work happens in
 *     build.ts; the runtime only sees these baked constants.
 *
 * Do NOT edit by hand — the next `build:data` will overwrite it.
 */
export const SCORE_ATTRIBUTION_DATA = {
  modelId: 'claude-fable-5',
  modelDisplay: 'Claude Fable 5',
  runDate: '2026-06-13',
} as const;
