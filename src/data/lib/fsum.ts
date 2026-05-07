/**
 * Compensated floating-point summation matching Python 3.12+ `sum()` semantics.
 *
 * Python's built-in `sum(iterable)` uses Neumaier-style compensated summation
 * for `float` inputs since CPython 3.12 (cpython/cpython#100425). This produces
 * a more accurate result than naive left-to-right addition for cases with
 * representational error in the inputs. Example:
 *
 *   xs = [2.898, 2.673, 2.878, 3.021]
 *   naive (reduce):    11.469999999999999  (closest double to 11.47, just below)
 *   Neumaier (sum()):  11.47               (which IS a representable double,
 *                                            equal to the previous + 1 ULP)
 *
 * To stay byte-equivalent with Python ETL output, projections that average
 * floats (profile5, sectors mean_ai_risk, etc.) must use this fsum, not the
 * stock `Array.prototype.reduce`.
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
