/**
 * Build-time score attribution (latest observation batch) and consensus
 * panel metadata.
 *
 * This file is OVERWRITTEN by `bun src/data/build.ts` (run as part of
 * `npm run build:data` and the `build` chain).
 *
 *   - `SCORE_ATTRIBUTION_DATA` is the newest AIOIS-10 occupation batch
 *     under `data/scores/` (最新観測 / /models / deep pages).
 *   - `SCORE_PANEL_DATA` is the vendor panel used by
 *     `pickFlagshipMeanScore()` (vendor count, newest run date, stale months / stale vendor count).
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
  modelId: 'grok-4.6',
  modelDisplay: 'Grok 4.6',
  runDate: '2026-09-07',
} as const;

export const SCORE_PANEL_DATA = {
  vendorCount: 3,
  latestRunDate: '2026-09-07',
  staleMonths: 6,
  staleVendorCount: 0,
} as const;
