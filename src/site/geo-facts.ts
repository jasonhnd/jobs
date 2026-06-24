import { fmean, fsum } from '../data/lib/fsum.js';
import { bankerRound } from '../data/lib/banker-round.js';
import { riskBand } from '../data/lib/bands.js';
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
  readonly occupationCount: number;
  readonly totalWorkforce: number;
  readonly meanAiImpact: number;
  readonly medianAiImpact: number;
  readonly meanDisplacementRisk: number;
  readonly fiveBandDistribution: readonly GeoBand[];
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

const FIVE_BANDS = [
  { key: '0-2', label: '0-2', min: 0, maxExclusive: 3 },
  { key: '3-4', label: '3-4', min: 3, maxExclusive: 5 },
  { key: '5-6', label: '5-6', min: 5, maxExclusive: 7 },
  { key: '7-8', label: '7-8', min: 7, maxExclusive: 9 },
  { key: '9-10', label: '9-10', min: 9, maxExclusive: 11 },
] as const;

function round2(n: number): number {
  return bankerRound(n, 2);
}

function roundPct(n: number, total: number): number {
  if (total === 0) return 0;
  return bankerRound((n / total) * 100, 1);
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

export function computeGeoFacts(
  rows: readonly GeoTreemapRow[],
  scoresById: ReadonlyMap<number, GeoScoreEntry>,
  attribution: GeoAttribution,
): GeoFacts {
  const scoredRows = rows.filter((row) => typeof row.ai_risk === 'number');
  if (scoredRows.length === 0) throw new Error('geo-facts: treemap has no scored rows');

  const risks = scoredRows.map((row) => row.ai_risk as number);
  const totalWorkforce = fsum(rows.map((row) => row.workers ?? 0));
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

  const fiveBandDistribution = FIVE_BANDS.map((band) => {
    const count = risks.filter((r) => r >= band.min && r < band.maxExclusive).length;
    return {
      key: band.key,
      label: band.label,
      count,
      sharePct: roundPct(count, risks.length),
    };
  });

  const lowRiskCount = scoredRows.filter((row) => riskBand(row.ai_risk) === 'low').length;
  const midRiskCount = scoredRows.filter((row) => riskBand(row.ai_risk) === 'mid').length;
  const highRiskCount = highRiskRows.length;

  const byImpactDesc = [...scoredRows].sort((a, b) =>
    (b.ai_risk! - a.ai_risk!) ||
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    (a.id - b.id),
  );
  const rankById = new Map<number, number>();
  byImpactDesc.forEach((row, index) => rankById.set(row.id, index + 1));
  const byImpactAsc = [...scoredRows].sort((a, b) =>
    (a.ai_risk! - b.ai_risk!) ||
    ((b.workers ?? 0) - (a.workers ?? 0)) ||
    (a.id - b.id),
  );
  const byWorkforceDesc = [...rows].sort((a, b) =>
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
    occupationCount: scoredRows.length,
    totalWorkforce: bankerRound(totalWorkforce, 0),
    meanAiImpact: round2(fmean(risks)),
    medianAiImpact: round2(median(risks)),
    meanDisplacementRisk: round2(fmean(displacementValues)),
    fiveBandDistribution,
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
