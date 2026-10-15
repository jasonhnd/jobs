/**
 * Build-time movers for the /rankings hub (今月の急上昇・急降下) and the home
 * 今月の変動 module.
 *
 * A mover is a change in the PUBLISHED score — the vendor-flagship mean that
 * every occupation page shows (`pickFlagshipMeanScore`) — from just before the
 * latest score batch landed to now (owner decision 2026-10-07, option A,
 * #863). "Before" is the public value computed from runs dated before the
 * latest batch date; "after" is today's public value. Both sides are the
 * one-decimal values the site displays, so a listed delta always equals
 * current − base as printed.
 *
 * The diff math is the shared core in src/graph/aiois-drift.ts.
 */
import { displayScore } from '../data/lib/banker-round.js';
import { toTenths } from '../data/lib/score-compare.js';
import { computeDriftReport, type AioisScore, type DriftRow } from '../graph/aiois-drift.js';
import { asScoreHist } from '../graph/loader.js';
import {
  tryPickFlagshipMeanScore,
  type ConsensusDims,
  type FlagshipMeanScore,
  type ScoreHistEntry,
} from '../graph/score-strategy.js';
import type { KnowledgeGraph } from '../graph/types.js';

const DIM_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as const satisfies readonly (keyof ConsensusDims)[];
const DEFAULT_TOP_N = 5;

/** The newest score batch date (non-backfill, AIOIS-10) and the models scored on it. */
export interface LandedBatch {
  readonly date: string;
  readonly models: readonly string[];
}

export interface RankingMover {
  readonly id: number;
  readonly name: string;
  /** Displayed public value before the latest batch landed. */
  readonly base: number;
  /** Displayed public value now. */
  readonly current: number;
  /** current − base, in tenths. */
  readonly delta: number;
  readonly familyCode: string | null;
}

export interface RankingMovers {
  readonly meta: {
    readonly landed: LandedBatch;
    readonly comparedCount: number;
    readonly meanDriftT: number;
    readonly meanDriftD: number;
  };
  readonly transformation: {
    readonly up: readonly RankingMover[];
    readonly down: readonly RankingMover[];
  };
  readonly displacement: {
    readonly up: readonly RankingMover[];
    readonly down: readonly RankingMover[];
  };
}

export interface RankingMoversOptions {
  readonly topN?: number;
  readonly familyById?: ReadonlyMap<number, string>;
}

type ScoreHistoryByOcc = ReadonlyMap<number, readonly ScoreHistEntry[]>;

function isComparable(entry: ScoreHistEntry): boolean {
  return entry.aiois != null && entry.backfill !== true;
}

export function latestLandedBatch(historyByOcc: ScoreHistoryByOcc): LandedBatch {
  let date = '';
  const models = new Set<string>();
  for (const history of historyByOcc.values()) {
    for (const entry of history) {
      if (!isComparable(entry) || entry.date < date) continue;
      if (entry.date > date) {
        date = entry.date;
        models.clear();
      }
      models.add(entry.model);
    }
  }
  if (date === '') {
    throw new Error('[ranking-movers] no comparable, non-backfill AIOIS-10 occupation score found.');
  }
  return { date, models: [...models].sort() };
}

function displayedPublicScore(flagship: FlagshipMeanScore): AioisScore {
  return {
    aiRisk: displayScore(flagship.transformation),
    displacement: displayScore(flagship.displacement),
    dims: DIM_KEYS.map((key) => displayScore(flagship.dims[key])),
    confidence: null,
  };
}

function asMover(
  row: DriftRow,
  metric: 'transformation' | 'displacement',
  familyById: ReadonlyMap<number, string>,
): RankingMover {
  const isT = metric === 'transformation';
  return {
    id: row.id,
    name: row.title,
    base: isT ? row.baseT : row.baseD,
    current: isT ? row.candT : row.candD,
    delta: toTenths(isT ? row.dT : row.dD) / 10,
    familyCode: familyById.get(row.id) ?? null,
  };
}

export function buildRankingMoversFromHistory(
  historyByOcc: ScoreHistoryByOcc,
  titles: ReadonlyMap<number, string>,
  options: RankingMoversOptions = {},
): RankingMovers {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const familyById = options.familyById ?? new Map<number, string>();
  const landed = latestLandedBatch(historyByOcc);

  const before = new Map<number, AioisScore>();
  const after = new Map<number, AioisScore>();
  for (const [id, history] of historyByOcc) {
    const previous = tryPickFlagshipMeanScore(history.filter((entry) => entry.date < landed.date));
    const current = tryPickFlagshipMeanScore(history);
    if (!previous || !current) continue;
    before.set(id, displayedPublicScore(previous));
    after.set(id, displayedPublicScore(current));
  }
  if (before.size === 0) {
    throw new Error(
      `[ranking-movers] no occupation has a published score from before the latest batch (${landed.date}).`,
    );
  }

  const report = computeDriftReport(before, after, titles, { rankThreshold: 50, lowConfidence: 0.7 });
  return {
    meta: {
      landed,
      comparedCount: report.comparedCount,
      meanDriftT: report.meanDriftT,
      meanDriftD: report.meanDriftD,
    },
    transformation: {
      up: report.topUpT.slice(0, topN).map((row) => asMover(row, 'transformation', familyById)),
      down: report.topDownT.slice(0, topN).map((row) => asMover(row, 'transformation', familyById)),
    },
    displacement: {
      up: report.topUpD.slice(0, topN).map((row) => asMover(row, 'displacement', familyById)),
      down: report.topDownD.slice(0, topN).map((row) => asMover(row, 'displacement', familyById)),
    },
  };
}

export function loadRankingMovers(
  graph: KnowledgeGraph,
  options: Omit<RankingMoversOptions, 'familyById'> = {},
): RankingMovers {
  const historyByOcc = new Map<number, ScoreHistEntry[]>();
  const titles = new Map<number, string>();
  const familyById = new Map<number, string>();
  for (const [id, occ] of graph.occupations) {
    const numericId = Number(id);
    historyByOcc.set(numericId, asScoreHist(graph.scoreHistoryByOcc.get(id) ?? []));
    titles.set(numericId, occ.titleJa);
    const sectorId = graph.sectorOf(id);
    if (sectorId !== null) familyById.set(numericId, String(sectorId));
  }

  return buildRankingMoversFromHistory(historyByOcc, titles, { ...options, familyById });
}
