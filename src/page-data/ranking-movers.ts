/**
 * Build-time movers for the /rankings hub.
 *
 * This module owns score-batch file loading and keeps the actual diff math in
 * scripts/aiois-drift-report.ts, so the public page uses the same core as the
 * scoring drift report.
 */
import { join } from 'node:path';

import { computeDriftReport, type AioisScore, type DriftRow } from '../../scripts/aiois-drift-report.js';
import { ScoreRunSchema, type ScoreRun } from '../data/schema/score-run.js';
import { pickLatestScore } from '../graph/score-strategy.js';
import type { KnowledgeGraph } from '../graph/types.js';
import { strictLoadDir } from '../lib/strict-load.js';

const AIOIS_DIM_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as const;
const DEFAULT_TOP_N = 5;

export interface ComparableAioisBatch {
  readonly model: string;
  readonly date: string;
  readonly runId: string;
  readonly scoreCount: number;
  readonly scores: ReadonlyMap<number, AioisScore>;
}

export interface RankingMover {
  readonly id: number;
  readonly name: string;
  readonly base: number;
  readonly current: number;
  readonly delta: number;
  readonly familyCode: string | null;
}

export interface RankingMovers {
  readonly meta: {
    readonly baseline: Omit<ComparableAioisBatch, 'scores'>;
    readonly candidate: Omit<ComparableAioisBatch, 'scores'>;
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
  readonly rankThreshold?: number;
  readonly lowConfidence?: number;
  readonly familyById?: ReadonlyMap<number, string>;
}

export function toComparableAioisBatch(run: ScoreRun): ComparableAioisBatch | null {
  if (run.scope !== 'occupations') return null;

  const scores = new Map<number, AioisScore>();
  for (const [idRaw, entry] of Object.entries(run.scores)) {
    const id = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(id) || entry.aiois == null) continue;
    scores.set(id, {
      aiRisk: entry.ai_risk,
      displacement: entry.aiois.displacement,
      dims: AIOIS_DIM_KEYS.map((key) => entry.aiois![key]),
      confidence: entry.confidence ?? null,
    });
  }

  if (scores.size === 0) return null;
  return {
    model: run.scorer.model,
    date: run.run.run_date,
    runId: run.run.run_id,
    scoreCount: scores.size,
    scores,
  };
}

export function selectLatestComparableAioisPair(
  runs: readonly ScoreRun[],
): { baseline: ComparableAioisBatch; candidate: ComparableAioisBatch } {
  const batches = runs
    .map((run, index) => ({ batch: toComparableAioisBatch(run), index }))
    .filter((item): item is { batch: ComparableAioisBatch; index: number } => item.batch !== null)
    .sort((a, b) => a.batch.date.localeCompare(b.batch.date) || a.index - b.index);

  if (batches.length < 2) {
    throw new Error(
      `[ranking-movers] expected at least two comparable AIOIS-10 occupation batches, found ${batches.length}.`,
    );
  }

  const baseline = batches[batches.length - 2]!.batch;
  const candidate = batches[batches.length - 1]!.batch;
  return { baseline, candidate };
}

export function assertCandidateMatchesPickLatestScore(
  candidate: ComparableAioisBatch,
  runs: readonly ScoreRun[],
): void {
  for (const id of candidate.scores.keys()) {
    const history = runs
      .filter((run) => run.scope === 'occupations' && run.scores[String(id)] !== undefined)
      .map((run) => {
        const entry = run.scores[String(id)]!;
        return {
          date: run.run.run_date,
          model: run.scorer.model,
          aiois: entry.aiois ?? null,
        };
      });
    const pick = pickLatestScore(history);
    if (pick.date !== candidate.date || pick.model !== candidate.model) {
      throw new Error(
        `[ranking-movers] latest comparable AIOIS batch ${candidate.model} (${candidate.date}) ` +
        `does not match pickLatestScore for occupation ${id}: ${pick.model} (${pick.date}).`,
      );
    }
  }
}

function compactBatchMeta(batch: ComparableAioisBatch): Omit<ComparableAioisBatch, 'scores'> {
  return {
    model: batch.model,
    date: batch.date,
    runId: batch.runId,
    scoreCount: batch.scoreCount,
  };
}

function asMover(
  row: DriftRow,
  metric: 'transformation' | 'displacement',
  familyById: ReadonlyMap<number, string>,
): RankingMover {
  if (metric === 'transformation') {
    return {
      id: row.id,
      name: row.title,
      base: row.baseT,
      current: row.candT,
      delta: row.dT,
      familyCode: familyById.get(row.id) ?? null,
    };
  }
  return {
    id: row.id,
    name: row.title,
    base: row.baseD,
    current: row.candD,
    delta: row.dD,
    familyCode: familyById.get(row.id) ?? null,
  };
}

export function buildRankingMoversFromPair(
  baseline: ComparableAioisBatch,
  candidate: ComparableAioisBatch,
  titles: ReadonlyMap<number, string>,
  options: RankingMoversOptions = {},
): RankingMovers {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const familyById = options.familyById ?? new Map<number, string>();
  const report = computeDriftReport(baseline.scores, candidate.scores, titles, {
    rankThreshold: options.rankThreshold ?? 50,
    lowConfidence: options.lowConfidence ?? 0.7,
  });

  return {
    meta: {
      baseline: compactBatchMeta(baseline),
      candidate: compactBatchMeta(candidate),
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

export function buildRankingMoversFromRuns(
  runs: readonly ScoreRun[],
  titles: ReadonlyMap<number, string>,
  options: RankingMoversOptions = {},
): RankingMovers {
  const { baseline, candidate } = selectLatestComparableAioisPair(runs);
  assertCandidateMatchesPickLatestScore(candidate, runs);
  return buildRankingMoversFromPair(baseline, candidate, titles, options);
}

export function loadRankingMovers(
  graph: KnowledgeGraph,
  options: Omit<RankingMoversOptions, 'familyById'> = {},
): RankingMovers {
  const runs = strictLoadDir(
    join(process.cwd(), 'data', 'scores'),
    (name) => name.endsWith('.json') && !name.startsWith('.'),
    ScoreRunSchema,
    'ranking-movers.scores',
  ).items as ScoreRun[];

  const titles = new Map<number, string>();
  const familyById = new Map<number, string>();
  for (const [id, occ] of graph.occupations) {
    const numericId = Number(id);
    titles.set(numericId, occ.titleJa);
    const sectorId = graph.sectorOf(id);
    if (sectorId !== null) familyById.set(numericId, String(sectorId));
  }

  return buildRankingMoversFromRuns(runs, titles, { ...options, familyById });
}
