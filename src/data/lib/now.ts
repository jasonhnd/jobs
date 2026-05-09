/**
 * now.ts — single source of truth for the `generated_at` timestamp baked
 * into projection outputs.
 *
 * Why this file exists:
 *   Each of the 8 projections (featured, holland, labels, profile5, search,
 *   sectors, transfer_paths, treemap) used to declare its own copy of
 *   `nowIso()` — verbatim — and call `new Date()` independently. That meant:
 *   (a) every build had 8 nearly-identical functions, and
 *   (b) a build that straddled a second boundary could stamp different
 *       projections with different timestamps, weakening reproducibility.
 *
 * This util fixes both: one definition, one cached value per process.
 *
 * Determinism override:
 *   When `BUILD_DATA_TIMESTAMP` is set (e.g. exported by CI from
 *   `git log -1 --format=%cI`), the env value is returned as-is. This makes
 *   `npm run build:data` byte-reproducible for a given source state and
 *   commit, which is what enables a future `git diff --quiet -- public/data.*`
 *   drift guard if/when public/data.* is brought back under version control.
 *
 * Format: ISO 8601 UTC with seconds resolution and a literal `+00:00`
 * offset, e.g. "2026-05-09T01:29:25+00:00".
 */

let cached: string | null = null;

function compute(): string {
  const override = process.env.BUILD_DATA_TIMESTAMP;
  if (override) return override;

  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

export function nowIso(): string {
  if (cached === null) cached = compute();
  return cached;
}

/**
 * Test-only: reset the cache. Should not be called by production code.
 * Kept as a separate exported function (vs. exposing the variable) so any
 * caller is forced to be explicit.
 */
export function _resetNowIsoCache(): void {
  cached = null;
}
