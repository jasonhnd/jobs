import { riskBand, type RiskBand } from '../../src/data/lib/bands.js';
import { displayScore } from '../../src/data/lib/banker-round.js';
import { fmean } from '../../src/data/lib/fsum.js';
import type { ScoreHistEntry } from '../../src/graph/score-strategy.js';
import { LATEST_OBSERVATION_THRESHOLD } from '../../src/site/consensus-copy.js';

export interface DriftMover {
  readonly id: number;
  readonly title: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly beforeBand: RiskBand;
  readonly afterBand: RiskBand;
  readonly showsLatestLine: boolean;
}

export interface DriftBandCounts {
  readonly low: number;
  readonly mid: number;
  readonly high: number;
}

export interface DriftSummary {
  readonly occupationCount: number;
  readonly skippedOccupationIds: readonly number[];
  readonly meanBefore: number;
  readonly meanAfter: number;
  readonly absDeltaGe05: number;
  readonly absDeltaGe10: number;
  readonly bandBefore: DriftBandCounts;
  readonly bandAfter: DriftBandCounts;
  readonly bandChanges: number;
  readonly latestLineCount: number;
  readonly movers: readonly DriftMover[];
}

interface DriftScores {
  readonly beforeUnrounded: number;
  readonly afterUnrounded: number;
  readonly latestT: number;
}

interface DriftStrategy<T extends DriftScores> {
  readonly comparableOf: (history: readonly ScoreHistEntry[]) => ScoreHistEntry[];
  readonly selectScores: (comparable: ScoreHistEntry[], withoutIncoming: ScoreHistEntry[]) => T;
  // Preserve each tool's historical aggregate basis. Deltas and bands always
  // use displayScore; the latest-line threshold always uses unrounded values.
  readonly meanBasis: 'displayed' | 'unrounded';
}

interface DriftComputation<T extends DriftScores> {
  readonly summary: DriftSummary;
  // Only successful occupations, in traversal order, for tool-specific means.
  readonly selectedScores: readonly T[];
}

export function driftMean(values: readonly number[]): number {
  return Math.round(fmean(values) * 100) / 100;
}

/** Shared traversal and statistics; score eligibility/selection stay with callers. */
export function computeDrift<T extends DriftScores>(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistEntry[]>,
  incomingModel: string,
  titles: ReadonlyMap<number, string>,
  strategy: DriftStrategy<T>,
): DriftComputation<T> {
  const beforeVals: number[] = [];
  const afterVals: number[] = [];
  const selectedScores: T[] = [];
  const movers: DriftMover[] = [];
  const skippedOccupationIds: number[] = [];
  const bandBefore = { low: 0, mid: 0, high: 0 };
  const bandAfter = { low: 0, mid: 0, high: 0 };
  let absDeltaGe05 = 0;
  let absDeltaGe10 = 0;
  let bandChanges = 0;
  let latestLineCount = 0;

  for (const [id, history] of historyByOcc) {
    const comparable = strategy.comparableOf(history);
    if (comparable.length === 0) {
      skippedOccupationIds.push(id);
      continue;
    }
    const withoutIncoming = comparable.filter((entry) => entry.model !== incomingModel);
    if (withoutIncoming.length === 0) {
      skippedOccupationIds.push(id);
      continue;
    }

    let scores: T;
    try {
      scores = strategy.selectScores(comparable, withoutIncoming);
    } catch {
      skippedOccupationIds.push(id);
      continue;
    }

    const { beforeUnrounded, afterUnrounded, latestT } = scores;
    const before = displayScore(beforeUnrounded);
    const after = displayScore(afterUnrounded);
    const delta = after - before;
    const abs = Math.abs(delta);
    const beforeBand = riskBand(before);
    const afterBand = riskBand(after);
    if (beforeBand === null || afterBand === null) {
      skippedOccupationIds.push(id);
      continue;
    }

    beforeVals.push(strategy.meanBasis === 'displayed' ? before : beforeUnrounded);
    afterVals.push(strategy.meanBasis === 'displayed' ? after : afterUnrounded);
    selectedScores.push(scores);
    if (abs >= 0.5) absDeltaGe05 += 1;
    if (abs >= 1.0) absDeltaGe10 += 1;
    bandBefore[beforeBand] += 1;
    bandAfter[afterBand] += 1;
    if (beforeBand !== afterBand) bandChanges += 1;
    const showsLatestLine = Math.abs(latestT - afterUnrounded) >= LATEST_OBSERVATION_THRESHOLD;
    if (showsLatestLine) latestLineCount += 1;
    movers.push({
      id,
      title: titles.get(id) ?? `職業 ${id}`,
      before,
      after,
      delta,
      beforeBand,
      afterBand,
      showsLatestLine,
    });
  }

  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id - b.id);

  return {
    summary: {
      occupationCount: movers.length,
      skippedOccupationIds: skippedOccupationIds.sort((a, b) => a - b),
      meanBefore: driftMean(beforeVals),
      meanAfter: driftMean(afterVals),
      absDeltaGe05,
      absDeltaGe10,
      bandBefore,
      bandAfter,
      bandChanges,
      latestLineCount,
      movers,
    },
    selectedScores,
  };
}
