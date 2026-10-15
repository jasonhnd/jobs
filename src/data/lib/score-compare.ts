/**
 * Exact comparisons on AI-risk scores.
 *
 * Every vote is a one-decimal value (schema/score-run.ts), so every value the
 * site compares — a vote, a vendor mean, a difference of the two, a displayed
 * value — is a short rational. Raw IEEE arithmetic leaves residue on those
 * rationals (2.6 − 2.3 = 0.30000000000000027, 1.7 − 0.7 = 0.9999999999999999),
 * which flips a `<= 0.3` or `>= 1.0` check exactly on the documented boundary.
 * These helpers compare in integers instead.
 */
import { displayScore } from './banker-round.js';

/**
 * Integer units per score point for distance checks. A difference between
 * one-decimal votes and a mean of n of them is a multiple of 1/(10·n); a 1e-9
 * grid keeps every such value distinct while absorbing ~1e-15 residue.
 */
const SCORE_UNITS_PER_POINT = 1e9;

/** A score or score difference snapped to integer units (1e-9 point). */
export function scoreUnits(value: number): number {
  return Math.round(value * SCORE_UNITS_PER_POINT);
}

/** The displayed one-decimal value in integer tenths: 3.9667 → 40, 4.9667 → 50. */
export function displayTenths(score: number): number {
  return Math.round(displayScore(score) * 10);
}

/**
 * A value already on the one-decimal grid (a vote, a displayed value, or a
 * difference of those) in integer tenths: 4.1 − 4.4 = −0.3000000000000007 → −3.
 */
export function toTenths(value: number): number {
  return Math.round(value * 10);
}
