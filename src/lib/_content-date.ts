/**
 * Build-time site content date.
 *
 * This file is OVERWRITTEN by `bun src/data/build.ts` (run as part of
 * `npm run build:data` and the `build` chain). The value is the latest
 * AI-score `run_date` across all occupations — the freshest content the
 * site shows. Templates and pages that emit `dateModified` in their
 * structured data import `CONTENT_DATE` from here so the freshness signal
 * tracks the actual data rather than a hardcoded calendar date.
 *
 * Why a committed default instead of pure auto-generation:
 *   - `bun run typecheck` (or any IDE / editor) needs the symbol to resolve
 *     BEFORE `build:data` has had a chance to write it on a fresh checkout.
 *   - The committed default is overwritten in-place by build:data; the diff
 *     is empty when the computed date matches the committed one.
 *
 * Do NOT edit by hand — the next `build:data` will overwrite it.
 */
export const CONTENT_DATE = '2026-05-30';
