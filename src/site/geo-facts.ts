import { fmean, fsum } from '../data/lib/fsum.js';
import { bankerRound } from '../data/lib/banker-round.js';
import { riskBand } from '../data/lib/bands.js';
import { formatModelDisplay } from './score-attribution.js';
import { z } from 'zod';

export interface GeoAttribution {
  readonly modelId: string;
  readonly modelDisplay: string;
  readonly runDate: string;
  readonly standardLabel: string;
}

export const GeoTreemapRowSchema = z
  .object({
    id: z.number().int(),
    name_ja: z.string(),
    salary: z.number().nullable().optional(),
    ai_risk: z.number().nullable(),
    workers: z.number().nullable(),
    recruit_ratio: z.number().nullable().optional(),
    demand_band: z.string().nullable().optional(),
    sector_id: z.string().nullable(),
    sector_ja: z.string().nullable(),
  })
  .passthrough();

export const GeoTreemapRowsSchema = z.array(GeoTreemapRowSchema);

export type GeoTreemapRow = z.infer<typeof GeoTreemapRowSchema>;

export interface GeoScoreEntry {
  readonly ai_risk: number;
  readonly confidence?: number | null;
  readonly aiois?: {
    readonly transformation?: number | null;
    readonly displacement?: number | null;
  } | null;
}

export interface GeoScoreRunLike {
  readonly scope: string;
  readonly scorer: {
    readonly model: string;
  };
  readonly run: {
    readonly run_date: string;
  };
  readonly scores: Record<string, GeoScoreEntry>;
}

export interface GeoBand {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly sharePct: number;
}

export interface GeoBatchAttribution {
  readonly modelId: string;
  readonly modelDisplay: string;
  readonly runDate: string;
}

export interface GeoOccupationSummary {
  readonly id: number;
  readonly nameJa: string;
  readonly aiImpact: number;
  /** 1 = highest AI impact, deterministic tie-break by workforce then id. */
  readonly aiImpactRank: number;
  readonly displacementRisk: number | null;
  readonly salaryMan: number | null;
  readonly workers: number | null;
  readonly recruitRatio: number | null;
  readonly demandBand: string | null;
  readonly sectorJa: string | null;
}

export interface GeoSectorSummary {
  readonly id: string;
  readonly nameJa: string;
  readonly occupationCount: number;
  readonly meanAiImpactRaw: number;
  readonly meanAiImpact: number;
  readonly totalWorkforce: number;
}

export interface GeoFacts {
  readonly attribution: GeoAttribution;
  readonly predecessor: GeoBatchAttribution | null;
  readonly predecessorComparedCount: number;
  readonly occupationCount: number;
  readonly totalWorkforce: number;
  /** Unrounded active-batch mean; presentation layers choose their precision. */
  readonly meanAiImpactRaw: number;
  readonly meanAiImpact: number;
  readonly medianAiImpact: number;
  /** Unrounded active-batch mean; presentation layers choose their precision. */
  readonly meanDisplacementRiskRaw: number;
  readonly meanDisplacementRisk: number;
  /** Active mean Transformation minus the immediately preceding batch mean. */
  readonly meanAiImpactDeltaFromPredecessor: number | null;
  readonly fiveBandDistribution: readonly GeoBand[];
  readonly highImpactThreshold: 5;
  readonly highImpactCount: number;
  /** Sum(salary in man-yen * workers), converted to trillion yen. */
  readonly highImpactAnnualWagesTrillion: number;
  readonly lowRiskCount: number;
  readonly midRiskCount: number;
  readonly highRiskCount: number;
  readonly highRiskOccupationSharePct: number;
  readonly highRiskWorkforce: number;
  readonly highRiskWorkforceSharePct: number;
  readonly largestOccupation: GeoOccupationSummary;
  readonly highestImpactOccupation: GeoOccupationSummary;
  readonly lowestImpactOccupation: GeoOccupationSummary;
  readonly occupations: readonly GeoOccupationSummary[];
  readonly topImpactOccupations: readonly GeoOccupationSummary[];
  readonly bottomImpactOccupations: readonly GeoOccupationSummary[];
  readonly sectorsByMeanImpact: readonly GeoSectorSummary[];
}

export interface GeoOccupationGroupSummary {
  readonly occupationCount: number;
  readonly totalWorkforce: number;
  readonly meanAiImpact: number | null;
  readonly firstOccupation: GeoOccupationSummary | null;
  readonly largestOccupation: GeoOccupationSummary | null;
  readonly highestImpactOccupation: GeoOccupationSummary | null;
  readonly lowestImpactOccupation: GeoOccupationSummary | null;
}

export function findGeoOccupation(
  facts: GeoFacts,
  occupationId: number,
): GeoOccupationSummary | null {
  return facts.occupations.find((occupation) => occupation.id === occupationId) ?? null;
}

const FIVE_BANDS = [
  { key: '0-2', label: '0-2' },
  { key: '3-4', label: '3-4' },
  { key: '5-6', label: '5-6' },
  { key: '7-8', label: '7-8' },
  { key: '9-10', label: '9-10' },
] as const;

const HIGH_IMPACT_THRESHOLD = 5 as const;

function round2(n: number): number {
  return bankerRound(n, 2);
}

function roundPct(n: number, total: number): number {
  if (total === 0) return 0;
  return bankerRound((n / total) * 100, 1);
}

/**
 * Apportion whole percentages with the Hamilton/largest-remainder method.
 * Ties resolve by band order, so non-empty distributions always sum to 100
 * without hand-written exceptions for tiny bands.
 */
function apportionWholePercent(counts: readonly number[]): number[] {
  const total = fsum(counts);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((count) => (count / total) * 100);
  const result = raw.map(Math.floor);
  const remaining = 100 - fsum(result);
  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => (b.remainder - a.remainder) || (a.index - b.index));
  for (let i = 0; i < remaining; i += 1) {
    result[order[i]!.index]! += 1;
  }
  return result;
}

function fiveBandIndex(score: number): number {
  const rounded = Math.max(0, Math.min(10, Math.round(score)));
  if (rounded <= 2) return 0;
  if (rounded <= 4) return 1;
  if (rounded <= 6) return 2;
  if (rounded <= 8) return 3;
  return 4;
}

function transformation(entry: GeoScoreEntry): number {
  return entry.aiois?.transformation ?? entry.ai_risk;
}

function scoreMapFromRun(run: GeoScoreRunLike): Map<number, GeoScoreEntry> {
  const out = new Map<number, GeoScoreEntry>();
  for (const [idRaw, entry] of Object.entries(run.scores)) {
    const id = Number.parseInt(idRaw, 10);
    if (Number.isFinite(id)) out.set(id, entry);
  }
  return out;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function scoreFor(
  row: GeoTreemapRow,
  scoresById: ReadonlyMap<number, GeoScoreEntry>,
  rankById: ReadonlyMap<number, number>,
): GeoOccupationSummary {
  const score = scoresById.get(row.id);
  return {
    id: row.id,
    nameJa: row.name_ja,
    aiImpact: row.ai_risk ?? score?.ai_risk ?? NaN,
    aiImpactRank: rankById.get(row.id) ?? 0,
    displacementRisk: score?.aiois?.displacement ?? null,
    salaryMan: row.salary ?? null,
    workers: row.workers,
    recruitRatio: row.recruit_ratio ?? null,
    demandBand: row.demand_band ?? null,
    sectorJa: row.sector_ja,
  };
}

function requireOne<T>(items: readonly T[], label: string): T {
  const first = items[0];
  if (first === undefined) throw new Error(`geo-facts: no ${label}`);
  return first;
}

/** Canonical whole-catalogue AI-impact ranking comparator. */
export function compareAiImpactDesc(a: GeoTreemapRow, b: GeoTreemapRow): number {
  return (
    (b.ai_risk! - a.ai_risk!) ||
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    (a.id - b.id)
  );
}

export function pickLatestGeoScoreRun<T extends GeoScoreRunLike>(runs: Iterable<T>): T {
  const candidates = [...runs].filter((run) => run.scope === 'occupations');
  if (candidates.length === 0) {
    throw new Error('geo-facts: no occupations score run');
  }
  let chosen = candidates[0]!;
  for (let i = 1; i < candidates.length; i += 1) {
    const entry = candidates[i]!;
    const entryHasAiois = Object.values(entry.scores).some((s) => s.aiois != null);
    const chosenHasAiois = Object.values(chosen.scores).some((s) => s.aiois != null);
    if (
      entry.run.run_date > chosen.run.run_date ||
      (entry.run.run_date === chosen.run.run_date && (entryHasAiois || !chosenHasAiois))
    ) {
      chosen = entry;
    }
  }
  return chosen;
}

function pickPredecessorGeoScoreRun<T extends GeoScoreRunLike>(
  activeRun: T,
  runs: readonly T[],
): T | null {
  const candidates = runs.filter((run) =>
    run.scope === 'occupations' && run.run.run_date < activeRun.run.run_date,
  );
  return candidates.length === 0 ? null : pickLatestGeoScoreRun(candidates);
}

export function computeGeoFacts(
  rows: readonly GeoTreemapRow[],
  scoreRuns: Iterable<GeoScoreRunLike>,
): GeoFacts {
  const runs = [...scoreRuns];
  const activeRun = pickLatestGeoScoreRun(runs);
  const predecessorRun = pickPredecessorGeoScoreRun(activeRun, runs);
  const scoresById = scoreMapFromRun(activeRun);
  const attribution: GeoAttribution = {
    modelId: activeRun.scorer.model,
    modelDisplay: formatModelDisplay(activeRun.scorer.model),
    runDate: activeRun.run.run_date,
    standardLabel: 'AIOIS-10',
  };
  // The treemap carries labor metadata. Scores always come from the selected
  // active run so a stale per-row ai_risk cannot create a mixed-batch aggregate.
  const scoredRows = rows.flatMap((row) => {
    const score = scoresById.get(row.id);
    return score ? [{ ...row, ai_risk: transformation(score) }] : [];
  });
  if (scoredRows.length === 0) throw new Error('geo-facts: treemap has no scored rows');

  const risks = scoredRows.map((row) => row.ai_risk as number);
  const totalWorkforce = fsum(scoredRows.map((row) => row.workers ?? 0));
  const highImpactRows = scoredRows.filter((row) => row.ai_risk! >= HIGH_IMPACT_THRESHOLD);
  const highImpactAnnualWagesTrillion = fsum(highImpactRows.map((row) =>
    (row.salary ?? 0) * (row.workers ?? 0),
  )) / 1e8;
  const highRiskRows = scoredRows.filter((row) => riskBand(row.ai_risk) === 'high');
  const highRiskWorkforce = fsum(highRiskRows.map((row) => row.workers ?? 0));

  const displacementValues = scoredRows
    .map((row) => scoresById.get(row.id)?.aiois?.displacement)
    .filter((v): v is number => typeof v === 'number');
  if (displacementValues.length !== scoredRows.length) {
    throw new Error(
      `geo-facts: expected displacement for ${scoredRows.length} scored rows, got ${displacementValues.length}`,
    );
  }

  const fiveBandCounts = FIVE_BANDS.map((_, index) =>
    risks.filter((risk) => fiveBandIndex(risk) === index).length,
  );
  const fiveBandShares = apportionWholePercent(fiveBandCounts);
  const fiveBandDistribution = FIVE_BANDS.map((band, index) => {
    const count = fiveBandCounts[index]!;
    return {
      key: band.key,
      label: band.label,
      count,
      sharePct: fiveBandShares[index]!,
    };
  });

  const predecessorScores = predecessorRun ? scoreMapFromRun(predecessorRun) : null;
  const predecessorDeltas = predecessorScores
    ? [...scoresById.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([id, score]) => {
        const previous = predecessorScores.get(id);
        return previous ? [transformation(score) - transformation(previous)] : [];
      })
    : [];
  const meanAiImpactRaw = fmean(risks);
  const meanDisplacementRiskRaw = fmean(displacementValues);

  const lowRiskCount = scoredRows.filter((row) => riskBand(row.ai_risk) === 'low').length;
  const midRiskCount = scoredRows.filter((row) => riskBand(row.ai_risk) === 'mid').length;
  const highRiskCount = highRiskRows.length;

  const byImpactDesc = [...scoredRows].sort(compareAiImpactDesc);
  const rankById = new Map<number, number>();
  byImpactDesc.forEach((row, index) => rankById.set(row.id, index + 1));
  const byImpactAsc = [...scoredRows].sort((a, b) =>
    (a.ai_risk! - b.ai_risk!) ||
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    (a.id - b.id),
  );
  const byWorkforceDesc = [...scoredRows].sort((a, b) =>
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    ((b.ai_risk ?? 0) - (a.ai_risk ?? 0)) ||
    (a.id - b.id),
  );
  const occupations = [...scoredRows]
    .sort((a, b) => a.id - b.id)
    .map((row) => scoreFor(row, scoresById, rankById));

  const sectors = new Map<string, {
    nameJa: string;
    risks: number[];
    workforce: number[];
  }>();
  for (const row of scoredRows) {
    if (!row.sector_id || !row.sector_ja || typeof row.ai_risk !== 'number') continue;
    const current = sectors.get(row.sector_id) ?? { nameJa: row.sector_ja, risks: [], workforce: [] };
    current.risks.push(row.ai_risk);
    current.workforce.push(row.workers ?? 0);
    sectors.set(row.sector_id, current);
  }
  const sectorsByMeanImpact = [...sectors.entries()]
    .map(([id, sector]) => {
      const meanAiImpactRaw = fmean(sector.risks);
      return {
        id,
        nameJa: sector.nameJa,
        occupationCount: sector.risks.length,
        meanAiImpactRaw,
        meanAiImpact: round2(meanAiImpactRaw),
        totalWorkforce: bankerRound(fsum(sector.workforce), 0),
      };
    })
    .sort((a, b) => (b.meanAiImpact - a.meanAiImpact) || a.id.localeCompare(b.id));

  return {
    attribution,
    predecessor: predecessorRun ? {
      modelId: predecessorRun.scorer.model,
      modelDisplay: formatModelDisplay(predecessorRun.scorer.model),
      runDate: predecessorRun.run.run_date,
    } : null,
    predecessorComparedCount: predecessorDeltas.length,
    occupationCount: scoredRows.length,
    totalWorkforce: bankerRound(totalWorkforce, 0),
    meanAiImpactRaw,
    meanAiImpact: round2(meanAiImpactRaw),
    medianAiImpact: round2(median(risks)),
    meanDisplacementRiskRaw,
    meanDisplacementRisk: round2(meanDisplacementRiskRaw),
    meanAiImpactDeltaFromPredecessor:
      predecessorDeltas.length > 0 ? fmean(predecessorDeltas) : null,
    fiveBandDistribution,
    highImpactThreshold: HIGH_IMPACT_THRESHOLD,
    highImpactCount: highImpactRows.length,
    highImpactAnnualWagesTrillion,
    lowRiskCount,
    midRiskCount,
    highRiskCount,
    highRiskOccupationSharePct: roundPct(highRiskCount, scoredRows.length),
    highRiskWorkforce: bankerRound(highRiskWorkforce, 0),
    highRiskWorkforceSharePct: roundPct(highRiskWorkforce, totalWorkforce),
    largestOccupation: scoreFor(requireOne(byWorkforceDesc, 'largest occupation'), scoresById, rankById),
    highestImpactOccupation: scoreFor(requireOne(byImpactDesc, 'highest-impact occupation'), scoresById, rankById),
    lowestImpactOccupation: scoreFor(requireOne(byImpactAsc, 'lowest-impact occupation'), scoresById, rankById),
    occupations,
    topImpactOccupations: byImpactDesc.slice(0, 20).map((row) => scoreFor(row, scoresById, rankById)),
    bottomImpactOccupations: byImpactAsc.slice(0, 20).map((row) => scoreFor(row, scoresById, rankById)),
    sectorsByMeanImpact,
  };
}

export function summarizeGeoOccupationIds(
  facts: GeoFacts,
  ids: Iterable<number>,
): GeoOccupationGroupSummary {
  const byId = new Map(facts.occupations.map((occupation) => [occupation.id, occupation]));
  const seen = new Set<number>();
  const occupations: GeoOccupationSummary[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const occupation = byId.get(id);
    if (occupation) occupations.push(occupation);
  }

  if (occupations.length === 0) {
    return {
      occupationCount: 0,
      totalWorkforce: 0,
      meanAiImpact: null,
      firstOccupation: null,
      largestOccupation: null,
      highestImpactOccupation: null,
      lowestImpactOccupation: null,
    };
  }

  const byImpactDesc = [...occupations].sort((a, b) =>
    (b.aiImpact - a.aiImpact) ||
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    (a.id - b.id),
  );
  const byImpactAsc = [...occupations].sort((a, b) =>
    (a.aiImpact - b.aiImpact) ||
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    (a.id - b.id),
  );
  const byWorkforceDesc = [...occupations].sort((a, b) =>
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    (b.aiImpact - a.aiImpact) ||
    (a.id - b.id),
  );

  return {
    occupationCount: occupations.length,
    totalWorkforce: bankerRound(fsum(occupations.map((occupation) => occupation.workers ?? 0)), 0),
    meanAiImpact: round2(fmean(occupations.map((occupation) => occupation.aiImpact))),
    firstOccupation: occupations[0]!,
    largestOccupation: byWorkforceDesc[0]!,
    highestImpactOccupation: byImpactDesc[0]!,
    lowestImpactOccupation: byImpactAsc[0]!,
  };
}
