/**
 * Score selection strategies — per docs/DATA_ARCHITECTURE.md §7.4.
 *
 * Centralizes the rule for "which historical score is current".
 *
 * Current strategy: latest by run_date.
 * Future-proofing: when multiple model providers diverge on quality, this is the
 * single place to swap in a "model priority" or "ensemble" strategy without
 * touching projection code.
 *
 * CHANGELOG of pickLatestScore:
 *   2026-05-04  initial — strict max(date) per occupation
 */

export interface ScoreHistEntry {
  model: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  ai_risk: number;
  rationale_ja: string;
  rationale_en: string;
  confidence?: number | null;
}

/**
 * Select the canonical current score from a per-occupation score history.
 *
 * Returns: the entry with the latest `date`. Caller guarantees non-empty.
 * Throws if the history is empty.
 */
export function pickLatestScore<T extends { date: string }>(history: T[]): T {
  if (history.length === 0) {
    throw new Error('pickLatestScore called with empty history');
  }
  // Ties broken by last-in-input-order (later entries override earlier ones with
  // appended history).
  let chosen = history[0]!;
  for (let i = 1; i < history.length; i += 1) {
    const entry = history[i]!;
    if (entry.date >= chosen.date) {
      chosen = entry;
    }
  }
  return chosen;
}
