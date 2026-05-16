/**
 * Compensated floating-point summation (Neumaier).
 *
 * ─── Location decision (Phase D/E follow-up, 2026-05-16) ──────────────────
 * Stays in `src/data/lib/`. Pure numerical utility consumed by:
 *   - `src/data/projections/{profile5,sectors,transfer_paths}.ts`
 *     (original consumers — projection output byte-stability)
 *   - `src/graph/profile5.ts` (added 2026-05-16 when profile5 algorithm
 *     migrated to the graph layer)
 * Sibling to banker-round.ts under the same "byte-identical Python
 * parity" rationale — Neumaier compensated sum matches Python's
 * `math.fsum`, keeping derived numerical output stable regardless of
 * float accumulation order. Both projection and graph consumers MUST
 * agree on the summation rule, hence one shared source.
 *
 * ─── Original docstring ───────────────────────────────────────────────────
 *
 * Naive left-to-right addition accumulates rounding error proportional to the
 * spread of the inputs. Neumaier-style compensated summation tracks a running
 * error term so the final result is the closest representable double to the
 * true sum. Example:
 *
 *   xs = [2.898, 2.673, 2.878, 3.021]
 *   naive (reduce):    11.469999999999999  (closest double to 11.47, just below)
 *   Neumaier (fsum):   11.47               (the next-closer representable double,
 *                                            equal to the previous + 1 ULP)
 *
 * Used by every projection that averages floats (profile5, sectors mean_ai_risk,
 * etc.) so identical input data always produces identical output bytes,
 * independent of input order or accumulation strategy.
 *
 * Reference: Neumaier (1974), "Rundungsfehleranalyse einiger Verfahren zur
 *            Summation endlicher Summen" (Improved Kahan summation).
 */

/** Sum all values in `xs` using Neumaier-style compensated summation. */
export function fsum(xs: readonly number[]): number {
  let sum = 0;
  let c = 0; // running compensation for lost low-order bits
  for (const x of xs) {
    const t = sum + x;
    if (Math.abs(sum) >= Math.abs(x)) {
      c += (sum - t) + x;
    } else {
      c += (x - t) + sum;
    }
    sum = t;
  }
  return sum + c;
}

/** Mean (arithmetic average) using compensated summation. Returns NaN on empty. */
export function fmean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  return fsum(xs) / xs.length;
}
