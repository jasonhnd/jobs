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
 *   2026-06-03  same-date tie-break: prefer the AIOIS-10 entry over a legacy
 *               single-axis one (deterministic, not filename-order dependent).
 *               No-op on current data (the two score runs have distinct dates).
 */

export interface ScoreHistEntry {
  model: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  ai_risk: number;
  rationale_ja: string;
  confidence?: number | null;
  /** AIOIS-10 profile (10 dims + 2 indices) when present; null/undefined for legacy batches. */
  aiois?: import('./types.js').Aiois10 | null;
}

/**
 * Select the canonical current score from a per-occupation score history.
 *
 * Returns: the entry with the latest `date`. Caller guarantees non-empty.
 * Throws if the history is empty.
 */
export function pickLatestScore<T extends { date: string; aiois?: unknown }>(history: T[]): T {
  if (history.length === 0) {
    throw new Error('pickLatestScore called with empty history');
  }
  let chosen = history[0]!;
  for (let i = 1; i < history.length; i += 1) {
    const entry = history[i]!;
    if (entry.date > chosen.date) {
      // Strictly newer run wins.
      chosen = entry;
    } else if (entry.date === chosen.date) {
      // Same-date tie — deterministic, not filename-order dependent: prefer
      // the AIOIS-10 entry (the current scoring standard) over a legacy
      // single-axis one. If both (or neither) carry an AIOIS-10 profile, keep
      // the later in-input-order entry (the historic behaviour).
      const entryIsAiois = entry.aiois != null;
      const chosenIsAiois = chosen.aiois != null;
      if (entryIsAiois || !chosenIsAiois) {
        chosen = entry;
      }
    }
  }
  return chosen;
}
