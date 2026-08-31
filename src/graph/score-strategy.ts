/**
 * Score selection strategies — per docs/DATA_ARCHITECTURE.md §7.4.
 *
 * Centralizes the rule for "which historical score is current".
 *
 * Canonical: `pickConsensusScore` (mms-6b) — median of comparable AIOIS-10
 * votes. `pickLatestScore` remains for 最新観測 / /models / score_history.
 *
 * CHANGELOG of pickConsensusScore:
 *   2026-08-31  mms-6a — comparable → 1 vote/model → 6-month window
 *               (anchor = newest vote date, no clock APIs) → floor 5
 *               expired fill → independent medians → rationale ±0.3.
 *   2026-08-31  mms-6b — wired as the public canonical score; SCORE_PANEL
 *               metadata; toCanonicalScoreEntry for projection drop-in.
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

export const CONSENSUS_WINDOW_MONTHS = 6;
export const CONSENSUS_FLOOR_VOTES = 5;

const DIM_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as const;
type DimKey = (typeof DIM_KEYS)[number];

export interface ConsensusDims {
  readonly d1: number; readonly d2: number; readonly d3: number; readonly d4: number;
  readonly d5: number; readonly d6: number; readonly d7: number; readonly d8: number;
  readonly d9: number; readonly d10: number;
}

export interface ConsensusPanelVote {
  readonly model: string;
  readonly date: string;
  readonly transformation: number;
}

export interface ConsensusScore {
  readonly transformation: number;
  readonly displacement: number;
  readonly dims: ConsensusDims;
  /** Panel votes, `date` ascending (then `model` ascending). */
  readonly panel: readonly ConsensusPanelVote[];
  readonly usedExpiredVotes: boolean;
  readonly rationaleEntry: ScoreHistEntry;
  readonly latest: ScoreHistEntry;
  readonly latestDelta: number;
}

/** Site-wide panel metadata baked into `SCORE_PANEL` at build time. */
export interface ScorePanelMeta {
  readonly voteCount: number;
  readonly latestRunDate: string;
  readonly windowMonths: number;
  readonly floorVotes: number;
  readonly usedExpiredVotes: boolean;
}

export function scorePanelMeta(c: ConsensusScore): ScorePanelMeta {
  return {
    voteCount: c.panel.length,
    latestRunDate: c.latest.date,
    windowMonths: CONSENSUS_WINDOW_MONTHS,
    floorVotes: CONSENSUS_FLOOR_VOTES,
    usedExpiredVotes: c.usedExpiredVotes,
  };
}

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month]!;
}

/**
 * Subtract `n` calendar months from a YYYY-MM-DD string.
 * End-of-month days clamp (2026-03-31 minus 6 months → 2025-09-30).
 * No clock APIs — build-deterministic.
 */
export function subtractMonths(isoDate: string, n: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const total = year * 12 + (month - 1) - n;
  const outYear = Math.floor(total / 12);
  const outMonth = (total % 12) + 1;
  const outDay = Math.min(day, daysInMonth(outYear, outMonth));
  return `${outYear}-${pad2(outMonth)}-${pad2(outDay)}`;
}

function median(values: readonly number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor((n - 1) / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid]! + sorted[mid + 1]!) / 2;
}

function oneVotePerModel(entries: readonly ScoreHistEntry[]): ScoreHistEntry[] {
  const byModel = new Map<string, ScoreHistEntry>();
  for (const entry of entries) {
    const prev = byModel.get(entry.model);
    // Latest date wins; same-date keeps the later-in-input entry.
    if (!prev || entry.date >= prev.date) byModel.set(entry.model, entry);
  }
  return [...byModel.values()];
}

const RATIONALE_TOLERANCE = 0.3;

function preferNewerThenModel(a: ScoreHistEntry, b: ScoreHistEntry): boolean {
  return a.date > b.date || (a.date === b.date && a.model < b.model);
}

function selectRationale(
  panel: readonly ScoreHistEntry[],
  transformation: number,
): ScoreHistEntry {
  const within = panel.filter(
    (e) => Math.abs(e.aiois!.transformation - transformation) <= RATIONALE_TOLERANCE,
  );
  if (within.length > 0) {
    let best = within[0]!;
    for (let i = 1; i < within.length; i += 1) {
      if (preferNewerThenModel(within[i]!, best)) best = within[i]!;
    }
    return best;
  }
  let best = panel[0]!;
  let bestDist = Math.abs(best.aiois!.transformation - transformation);
  for (let i = 1; i < panel.length; i += 1) {
    const entry = panel[i]!;
    const dist = Math.abs(entry.aiois!.transformation - transformation);
    if (dist < bestDist || (dist === bestDist && preferNewerThenModel(entry, best))) {
      best = entry;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Median consensus of comparable AIOIS-10 votes. See docs/CONSENSUS_SCORE.md.
 *
 * `pickLatestScore` stays for the 最新観測 row and /models. This function
 * does not round (display-layer banker rounding is unchanged).
 */
export function pickConsensusScore(history: readonly ScoreHistEntry[]): ConsensusScore {
  if (history.length === 0) {
    throw new Error('pickConsensusScore called with empty history');
  }
  const comparable = history.filter((e) => e.aiois != null);
  if (comparable.length === 0) {
    throw new Error('pickConsensusScore called with no comparable (aiois) scores');
  }

  const latest = pickLatestScore(comparable);
  const votes = oneVotePerModel(comparable);
  const anchor = votes.reduce((max, e) => (e.date > max ? e.date : max), votes[0]!.date);
  const cutoff = subtractMonths(anchor, CONSENSUS_WINDOW_MONTHS);
  const inWindow: ScoreHistEntry[] = [];
  const expired: ScoreHistEntry[] = [];
  for (const entry of votes) {
    if (entry.date >= cutoff) inWindow.push(entry);
    else expired.push(entry);
  }
  expired.sort((a, b) => b.date.localeCompare(a.date) || a.model.localeCompare(b.model));

  let usedExpiredVotes = false;
  const panelEntries = inWindow.slice();
  if (panelEntries.length < CONSENSUS_FLOOR_VOTES && expired.length > 0) {
    const fill = expired.slice(0, CONSENSUS_FLOOR_VOTES - panelEntries.length);
    panelEntries.push(...fill);
    usedExpiredVotes = fill.length > 0;
  }
  panelEntries.sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));

  const transformation = median(panelEntries.map((e) => e.aiois!.transformation));
  const displacement = median(panelEntries.map((e) => e.aiois!.displacement));
  const dims = {} as { -readonly [K in DimKey]: number };
  for (const key of DIM_KEYS) {
    dims[key] = median(panelEntries.map((e) => e.aiois![key]));
  }

  const rationaleEntry = selectRationale(panelEntries, transformation);
  const latestDelta = latest.aiois!.transformation - transformation;

  return {
    transformation,
    displacement,
    dims,
    panel: panelEntries.map((e) => ({
      model: e.model,
      date: e.date,
      transformation: e.aiois!.transformation,
    })),
    usedExpiredVotes,
    rationaleEntry,
    latest,
    latestDelta,
  };
}

/** Flatten a consensus result into the ScoreHistEntry shape projections already consume. */
export function toCanonicalScoreEntry(c: ConsensusScore): ScoreHistEntry {
  return {
    model: c.rationaleEntry.model,
    date: c.latest.date,
    ai_risk: c.transformation,
    rationale_ja: c.rationaleEntry.rationale_ja,
    confidence: c.rationaleEntry.confidence,
    aiois: {
      ...c.dims,
      transformation: c.transformation,
      displacement: c.displacement,
    },
  };
}
