/**
 * score-format.ts — the one place a per-occupation AI-impact score becomes
 * display text.
 *
 * The public value is a mean of several models' scores, so it arrives as a
 * full-precision float: 6.233333333333334, 5.8999999999999995,
 * 4.6000000000000005. `displayScore()` (banker's rounding to one decimal) is
 * the repo's convention and `views/occupation-display.ts` has always used it —
 * but twelve other call sites interpolated the raw number instead, which put
 * strings like `6.233333333333334/10` into visible copy AND into JSON-LD.
 *
 * Templates may not import `src/data/lib` (check-architecture), which is why
 * this wrapper lives in `src/lib` where both templates and views can reach it.
 */
import { displayScore } from '../data/lib/banker-round.js';
import { RISK_BAND_WORD, riskBandWord, riskClass } from './risk.js';

/** What a missing score renders as, matching occupation-display.ts. */
export const EMDASH = '—';

/**
 * `6.5/10`, or an em dash when the score is missing.
 *
 * Rounding is banker's, one decimal — the same function the occupation page,
 * its JSON-LD and its SEO strings already use, so a score reads identically
 * wherever it appears.
 */
export function formatRiskScore(risk: number | null | undefined): string {
  if (risk == null || !Number.isFinite(risk)) return EMDASH;
  return `${displayScore(risk)}/10`;
}

/** The rounded number alone, for callers that supply their own separator. */
export function formatRiskValue(risk: number | null | undefined): string {
  if (risk == null || !Number.isFinite(risk)) return EMDASH;
  return String(displayScore(risk));
}

/**
 * A mean AI-impact score as fixed one-decimal text (`4.0`, `4.7`), with the
 * same banker's rounding as displayScore — `toFixed(1)` rounds half away from
 * zero, so a mean of 4.25 printed 4.3 next to rows that print 4.2 (#864).
 */
export function formatScoreFixed1(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return EMDASH;
  return displayScore(score).toFixed(1);
}

/**
 * Visible score label: `8.1/10 変化 大きい`. A missing score stays the em
 * dash, with no band word. The word follows the displayed value.
 */
export function formatRiskScoreLabel(risk: number | null | undefined): string {
  const score = formatRiskScore(risk);
  if (score === EMDASH) return score;
  const word = riskBandWord(risk);
  return word ? `${score} ${word}` : score;
}

/**
 * A mean that is already the displayed one-decimal value, fixed to one
 * decimal the way hub FAQs print it: `4.0/10 変化 中くらい`.
 */
export function formatShownMeanLabel(shown: number): string {
  return `${shown.toFixed(1)}/10 ${RISK_BAND_WORD[riskClass(shown)]}`;
}
