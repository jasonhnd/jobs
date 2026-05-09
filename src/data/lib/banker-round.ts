/**
 * Banker's rounding (round half to even) over the EXACT stored IEEE 754 double.
 *
 * Why this is non-trivial:
 *   `Number.prototype.toFixed` uses round-half-away-from-zero (e.g. 52.25 → "52.3"),
 *   which loses 1 ULP of accuracy across a 552-record dataset and breaks
 *   reproducibility. `Math.round(x * 10^n) / 10^n` has the same problem and
 *   adds float-multiply error on top. We need:
 *     - Round half to even ONLY for genuine halfway cases (so 52.25 → 52.2,
 *       52.35 → 52.4 — both round to even tens digit).
 *     - For values that LOOK halfway but are actually slightly off (the FP
 *       residue case 0.15 storing as 0.14999...), round in the direction of
 *       the actual stored value.
 *
 * Algorithm:
 *   1. Render `x` with `toFixed(ndigits + 17)`. V8's toFixed produces the
 *      closest decimal string at that many places — and 17 extra digits is
 *      enough to disambiguate any IEEE 754 double.
 *   2. Look at the digit at position `ndigits + 1` and its tail.
 *      - <5: round down
 *      - >5: round up
 *      - =5 with non-zero tail: round up (FP value is just above halfway)
 *      - =5 with all-zero tail: GENUINE halfway → round to even
 *
 * Examples:
 *   bankerRound(0.15, 1)               → 0.1   (toFixed(20)='0.14999...445' → digit 2 is '4')
 *   bankerRound(0.05, 1)               → 0.1   (toFixed(20)='0.05000...278' → digit 2 is '5' with non-zero tail)
 *   bankerRound(52.25, 1)              → 52.2  (toFixed(20)='52.25000...000' → exact halfway, 522 even)
 *   bankerRound(66.55, 1)              → 66.5  (toFixed(20)='66.54999...715' → digit 2 is '4')
 *   bankerRound(61.85000000000001, 1)  → 61.9  (toFixed(20) shows tail above .5)
 */

/** Round `x` to `ndigits` decimal places using banker's rounding. */
export function bankerRound(x: number, ndigits: number): number {
  if (!Number.isFinite(x)) return x;
  if (ndigits < 0) ndigits = 0;

  const sign = x < 0 ? '-' : '';
  const absX = Math.abs(x);

  // 17 extra digits suffice to disambiguate any IEEE 754 double.
  const wide = absX.toFixed(ndigits + 17);
  const dot = wide.indexOf('.');

  // No fractional part — already an integer.
  if (dot === -1) return x;

  const intStr = wide.slice(0, dot);
  const fracStr = wide.slice(dot + 1);

  if (ndigits >= fracStr.length) {
    // toFixed already rounded to within our precision target.
    return Number(sign + wide);
  }

  const keep = fracStr.slice(0, ndigits);
  const decisive = fracStr.charAt(ndigits);
  const tail = fracStr.slice(ndigits + 1);

  // Determine rounding direction
  let roundUp: boolean;
  if (decisive < '5') {
    roundUp = false;
  } else if (decisive > '5') {
    roundUp = true;
  } else {
    // decisive === '5'
    const tailHasNonZero = /[1-9]/.test(tail);
    if (tailHasNonZero) {
      roundUp = true;
    } else {
      // Genuine halfway → round to even
      const lastKept = ndigits === 0 ? intStr.charAt(intStr.length - 1) : keep.charAt(keep.length - 1);
      const lastDigit = Number(lastKept);
      roundUp = lastDigit % 2 !== 0;
    }
  }

  // Build truncated value
  const truncatedStr = ndigits === 0 ? intStr : `${intStr}.${keep}`;
  const truncated = Number(`${sign}${truncatedStr}`);

  if (!roundUp) return truncated;

  // Round up: increment by one unit at position ndigits.
  // Use `toFixed` after addition to clean up FP residue.
  const unit = 10 ** -ndigits;
  const incremented = x >= 0 ? truncated + unit : truncated - unit;
  return Number(incremented.toFixed(ndigits));
}
