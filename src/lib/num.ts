/**
 * src/lib/num.ts — shared numeric helpers used by the Layer 4 templates
 * and Layer 5 pages.
 *
 * Consolidates two helpers that were duplicated across hub families:
 *
 *   fmtInt   — formatter for nullable integer counts. Six identical
 *              copies (compare-hub, genre-hub, interests, rankings,
 *              skills-hub + [id].astro). null/undefined → '—',
 *              everything else → en-US grouped integer.
 *
 *   safeMean — sum-then-divide reducer for nullable numeric arrays.
 *              Three identical copies (genre-hub, interests, skills-hub).
 *              Filters out null/undefined entries; returns 0 when the
 *              filtered list is empty (template-safe default).
 *
 * Out of scope:
 *   - rankings.safeMean and sector-meta.safeMean use different
 *     signatures (item-array + key / getter). Keep those local.
 *   - og-helpers.fmtNumber is a Vercel-Edge-tuned variant that always
 *     formats (no null branch) and never truncates. Keep separate.
 */

/**
 * Format a nullable integer count for display. Truncates to an integer
 * before grouping (so 12_345.7 → '12,345') and renders an em-dash for
 * missing data so the surrounding layout doesn't collapse.
 */
export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Math.trunc(n).toLocaleString('en-US');
}

/**
 * Arithmetic mean of an array, skipping null/undefined entries. Returns
 * 0 for an empty / all-null list — template-safe default that keeps the
 * rendering path uncomplicated.
 */
export function safeMean(values: ReadonlyArray<number | null | undefined>): number {
  const filtered = values.filter((v): v is number => typeof v === 'number');
  if (filtered.length === 0) return 0;
  return filtered.reduce((s, v) => s + v, 0) / filtered.length;
}
