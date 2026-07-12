/**
 * Pure AIOIS-10 drift calculations shared by the local drift-report CLI and
 * static site views. Keep this module free of I/O so pages can import it.
 */

export type Band = 'low' | 'mid' | 'high';

/** ai_risk band: < 4.0 low / < 7.0 mid / >= 7.0 high. */
export const riskBand = (r: number): Band => (r < 4 ? 'low' : r < 7 ? 'mid' : 'high');

export interface AioisScore {
  /** Headline score (== aiois.transformation). */
  readonly aiRisk: number;
  readonly displacement: number;
  /** d1..d10 in order. */
  readonly dims: readonly number[];
  readonly confidence: number | null;
}

export interface DriftRow {
  readonly id: number;
  readonly title: string;
  readonly baseT: number;
  readonly candT: number;
  readonly dT: number;
  readonly baseD: number;
  readonly candD: number;
  readonly dD: number;
  readonly baseBand: Band;
  readonly candBand: Band;
  readonly baseRank: number;
  readonly candRank: number;
  readonly rankShift: number;
  readonly confidence: number | null;
  readonly flags: readonly string[];
}

export interface DriftReport {
  readonly rows: readonly DriftRow[];
  readonly comparedCount: number;
  readonly meanDriftT: number;
  readonly meanAbsDriftT: number;
  readonly meanDriftD: number;
  readonly meanAbsDriftD: number;
  readonly dimDrift: readonly number[];
  readonly dimAbsDrift: readonly number[];
  readonly bandMatrix: Readonly<Record<Band, Readonly<Record<Band, number>>>>;
  readonly bandCrossCount: number;
  readonly topUpT: readonly DriftRow[];
  readonly topDownT: readonly DriftRow[];
  readonly topRankShifts: readonly DriftRow[];
  readonly topUpD: readonly DriftRow[];
  readonly topDownD: readonly DriftRow[];
  readonly manualReview: readonly DriftRow[];
}

export interface DriftOptions {
  readonly rankThreshold: number;
  readonly lowConfidence: number;
}

const DRIFT_FLAG_THRESHOLD = 1.5;
const TOP_T_COUNT = 20;
const TOP_RANK_COUNT = 20;
const TOP_D_COUNT = 10;

/** Rank ids by a score map, 1 = highest score; ties -> lower id first. */
function rankByScore(ids: readonly number[], score: (id: number) => number): Map<number, number> {
  const sorted = [...ids].sort((a, b) => score(b) - score(a) || a - b);
  return new Map(sorted.map((id, i) => [id, i + 1]));
}

const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function computeDriftReport(
  baseline: ReadonlyMap<number, AioisScore>,
  candidate: ReadonlyMap<number, AioisScore>,
  titles: ReadonlyMap<number, string>,
  opts: DriftOptions,
): DriftReport {
  const common = [...candidate.keys()].filter((id) => baseline.has(id)).sort((a, b) => a - b);
  const baseRanks = rankByScore(common, (id) => baseline.get(id)!.aiRisk);
  const candRanks = rankByScore(common, (id) => candidate.get(id)!.aiRisk);

  const rows: DriftRow[] = common.map((id) => {
    const b = baseline.get(id)!;
    const c = candidate.get(id)!;
    const dT = c.aiRisk - b.aiRisk;
    const dD = c.displacement - b.displacement;
    const baseBand = riskBand(b.aiRisk);
    const candBand = riskBand(c.aiRisk);
    const baseRank = baseRanks.get(id)!;
    const candRank = candRanks.get(id)!;
    const rankShift = Math.abs(baseRank - candRank);
    const confidence = c.confidence;
    const flags: string[] = [];
    if (Math.abs(dT) >= DRIFT_FLAG_THRESHOLD) flags.push(`T-drift≥${DRIFT_FLAG_THRESHOLD}`);
    if (Math.abs(dD) >= DRIFT_FLAG_THRESHOLD) flags.push(`D-drift≥${DRIFT_FLAG_THRESHOLD}`);
    if (baseBand !== candBand) flags.push(`band:${baseBand}→${candBand}`);
    if (rankShift >= opts.rankThreshold) flags.push(`rank-shift≥${opts.rankThreshold}`);
    if (confidence != null && confidence < opts.lowConfidence) flags.push(`low-confidence<${opts.lowConfidence}`);
    return {
      id, title: titles.get(id) ?? `(id ${id})`,
      baseT: b.aiRisk, candT: c.aiRisk, dT,
      baseD: b.displacement, candD: c.displacement, dD,
      baseBand, candBand, baseRank, candRank, rankShift, confidence, flags,
    };
  });

  const dimCount = 10;
  const dimDrift = Array.from({ length: dimCount }, (_, k) =>
    mean(common.map((id) => candidate.get(id)!.dims[k]! - baseline.get(id)!.dims[k]!)),
  );
  const dimAbsDrift = Array.from({ length: dimCount }, (_, k) =>
    mean(common.map((id) => Math.abs(candidate.get(id)!.dims[k]! - baseline.get(id)!.dims[k]!))),
  );

  const bandMatrix: Record<Band, Record<Band, number>> = {
    low: { low: 0, mid: 0, high: 0 },
    mid: { low: 0, mid: 0, high: 0 },
    high: { low: 0, mid: 0, high: 0 },
  };
  rows.forEach((r) => {
    bandMatrix[r.baseBand][r.candBand] += 1;
  });
  const bandCrossCount = rows.filter((r) => r.baseBand !== r.candBand).length;

  const byDtDesc = (a: DriftRow, b: DriftRow): number => b.dT - a.dT || a.id - b.id;
  const byDdDesc = (a: DriftRow, b: DriftRow): number => b.dD - a.dD || a.id - b.id;

  return {
    rows,
    comparedCount: rows.length,
    meanDriftT: mean(rows.map((r) => r.dT)),
    meanAbsDriftT: mean(rows.map((r) => Math.abs(r.dT))),
    meanDriftD: mean(rows.map((r) => r.dD)),
    meanAbsDriftD: mean(rows.map((r) => Math.abs(r.dD))),
    dimDrift,
    dimAbsDrift,
    bandMatrix,
    bandCrossCount,
    topUpT: rows.filter((r) => r.dT > 0).sort(byDtDesc).slice(0, TOP_T_COUNT),
    topDownT: rows.filter((r) => r.dT < 0).sort((a, b) => a.dT - b.dT || a.id - b.id).slice(0, TOP_T_COUNT),
    topRankShifts: [...rows].sort((a, b) => b.rankShift - a.rankShift || a.id - b.id).slice(0, TOP_RANK_COUNT),
    topUpD: rows.filter((r) => r.dD > 0).sort(byDdDesc).slice(0, TOP_D_COUNT),
    topDownD: rows.filter((r) => r.dD < 0).sort((a, b) => a.dD - b.dD || a.id - b.id).slice(0, TOP_D_COUNT),
    manualReview: rows
      .filter((r) => r.flags.length > 0)
      .sort((a, b) => Math.abs(b.dT) - Math.abs(a.dT) || a.id - b.id),
  };
}
