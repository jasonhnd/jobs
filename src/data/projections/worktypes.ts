import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Aiois10 } from '../schema/score-run.js';
import type { Indexes } from '../lib/indexes.js';
import { fsum } from '../lib/fsum.js';
import { bankerRound } from '../lib/banker-round.js';
import { nowIso } from '../../lib/now.js';
import { WorktypesDataSchema, type WorktypesData } from '../schema/worktypes.js';

export const FAMILY_CODES = [
  'CPB',
  'CPK',
  'CDB',
  'CDK',
  'RPB',
  'RPK',
  'RDB',
  'RDK',
] as const;

export type FamilyCode = typeof FAMILY_CODES[number];

type AxisId = 'a1' | 'a2' | 'a3';
type DimensionKey = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6';
type Pole = 'C' | 'R' | 'P' | 'D' | 'B' | 'K';

interface ActiveAioisRow {
  id: number;
  aiois: Aiois10;
}

interface AxisRow extends ActiveAioisRow {
  scores: Record<AxisId, number>;
}

interface SmoothingAdjustment {
  occupationId: number;
  from: FamilyCode;
  to: FamilyCode;
  axis: AxisId;
  distance: number;
}

export interface WorktypesBuildResult {
  files: string[];
  occupations: number;
  families: number;
  adjustments: number;
}

const AXES: AxisId[] = ['a1', 'a2', 'a3'];
const DIMENSIONS: DimensionKey[] = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
const EXPOSED_POLES = new Set(['R', 'D', 'K']);
const MIN_FAMILY_PCT = 3;
const MAX_FAMILY_PCT = 35;
const HIGH_TRANSFORMATION_WATCH_THRESHOLD = 7.0;
const EPS = 1e-12;

const FAMILY_IDS: Record<FamilyCode, string> = {
  CPB: 'fureai-creator',
  CPK: 'yorisoi-guide',
  CDB: 'monozukuri-designer',
  CDK: 'ai-ninin-sankyaku',
  RPB: 'soba-supporter',
  RPK: 'dantori-caretaker',
  RDB: 'genba-runner',
  RDK: 'tedobashi-jouzu',
};

const MARGIN_VALUES = ['2-1', '3-0'] as const;

function activeAioisRows(indexes: Indexes): ActiveAioisRow[] {
  const rows: ActiveAioisRow[] = [];
  const sortedIds = [...indexes.canonicalScoreByOcc.keys()].sort((a, b) => a - b);
  for (const id of sortedIds) {
    const aiois = indexes.canonicalScoreByOcc.get(id)?.aiois;
    if (!aiois) continue;
    rows.push({ id, aiois });
  }
  return rows;
}

function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('[worktypes] cannot compute median of empty values');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function dimensionStats(rows: readonly ActiveAioisRow[]): Record<DimensionKey, { mean: number; stdev: number }> {
  const stats = {} as Record<DimensionKey, { mean: number; stdev: number }>;
  for (const dim of DIMENSIONS) {
    const values = rows.map((row) => row.aiois[dim]);
    const mean = fsum(values) / values.length;
    const variance = fsum(values.map((value) => (value - mean) ** 2)) / values.length;
    stats[dim] = {
      mean,
      stdev: Math.sqrt(variance),
    };
  }
  return stats;
}

function axisRows(rows: readonly ActiveAioisRow[]): AxisRow[] {
  const stats = dimensionStats(rows);
  const normalize = (aiois: Aiois10, dim: DimensionKey): number => {
    const stat = stats[dim];
    if (stat.stdev === 0) return 0;
    return (aiois[dim] - stat.mean) / stat.stdev;
  };

  return rows.map((row) => {
    const n = (dim: DimensionKey) => normalize(row.aiois, dim);
    return {
      ...row,
      scores: {
        a1: n('d6') - n('d2'),
        a2: n('d5') + 0.5 * n('d4') - n('d1'),
        a3: n('d3') - (n('d1') + n('d4') + n('d6')) / 3,
      },
    };
  });
}

export function computeWorktypeThresholds(rows: readonly AxisRow[]): Record<AxisId, number> {
  return {
    a1: median(rows.map((row) => row.scores.a1)),
    a2: median(rows.map((row) => row.scores.a2)),
    a3: median(rows.map((row) => row.scores.a3)),
  };
}

function tieBreakPole(axis: AxisId, aiois: Aiois10): Pole {
  if (axis === 'a1') {
    return aiois.d6 >= aiois.d2 ? 'C' : 'R';
  }
  if (axis === 'a2') {
    return Math.max(aiois.d5, aiois.d4) >= aiois.d1 ? 'P' : 'D';
  }
  return aiois.d3 >= Math.max(aiois.d1, aiois.d4, aiois.d6) ? 'B' : 'K';
}

function poleForAxis(axis: AxisId, row: AxisRow, thresholds: Record<AxisId, number>): Pole {
  const score = row.scores[axis];
  const threshold = thresholds[axis];
  if (score === threshold) return tieBreakPole(axis, row.aiois);
  if (axis === 'a1') return score > threshold ? 'C' : 'R';
  if (axis === 'a2') return score > threshold ? 'P' : 'D';
  return score > threshold ? 'B' : 'K';
}

function familyCodeFor(row: AxisRow, thresholds: Record<AxisId, number>): FamilyCode {
  return `${poleForAxis('a1', row, thresholds)}${poleForAxis('a2', row, thresholds)}${poleForAxis('a3', row, thresholds)}` as FamilyCode;
}

function emptyCounts(): Record<FamilyCode, number> {
  return {
    CPB: 0,
    CPK: 0,
    CDB: 0,
    CDK: 0,
    RPB: 0,
    RPK: 0,
    RDB: 0,
    RDK: 0,
  };
}

function countAssignments(assignments: ReadonlyMap<number, FamilyCode>): Record<FamilyCode, number> {
  const counts = emptyCounts();
  for (const code of assignments.values()) {
    counts[code] += 1;
  }
  return counts;
}

function pct(count: number, total: number): number {
  return bankerRound((count / total) * 100, 1);
}

function distributionFromCounts(
  counts: Record<FamilyCode, number>,
  total: number,
): Record<FamilyCode, { count: number; pct: number }> {
  const out = {} as Record<FamilyCode, { count: number; pct: number }>;
  for (const code of FAMILY_CODES) {
    out[code] = {
      count: counts[code],
      pct: pct(counts[code], total),
    };
  }
  return out;
}

function exposureFor(code: FamilyCode): number {
  return [...code].filter((pole) => EXPOSED_POLES.has(pole)).length;
}

function differingAxis(from: FamilyCode, to: FamilyCode): AxisId | null {
  let diff = -1;
  for (let i = 0; i < 3; i += 1) {
    if (from[i] === to[i]) continue;
    if (diff !== -1) return null;
    diff = i;
  }
  if (diff === -1) return null;
  return AXES[diff]!;
}

function calibrateAssignments(
  rows: readonly AxisRow[],
  assignments: Map<number, FamilyCode>,
  thresholds: Record<AxisId, number>,
): {
  counts: Record<FamilyCode, number>;
  rawDistribution: Record<FamilyCode, { count: number; pct: number }>;
  adjustments: SmoothingAdjustment[];
  minCount: number;
  maxCount: number;
} {
  const total = rows.length;
  const minCount = Math.ceil((total * MIN_FAMILY_PCT) / 100);
  const maxCount = Math.floor((total * MAX_FAMILY_PCT) / 100);
  const rawCounts = countAssignments(assignments);
  const rawDistribution = distributionFromCounts(rawCounts, total);
  const counts = { ...rawCounts };
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const adjustments: SmoothingAdjustment[] = [];

  for (let pass = 0; pass < FAMILY_CODES.length; pass += 1) {
    const under = FAMILY_CODES
      .filter((code) => counts[code] < minCount)
      .sort((a, b) => counts[a] - counts[b] || a.localeCompare(b));
    if (under.length === 0) break;

    const target = under[0]!;
    const candidates = rows
      .map((row) => {
        const from = assignments.get(row.id)!;
        const axis = differingAxis(from, target);
        if (!axis) return null;
        return {
          row,
          from,
          axis,
          distance: Math.abs(row.scores[axis] - thresholds[axis]),
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
      .sort((a, b) => a.distance - b.distance || a.from.localeCompare(b.from) || a.row.id - b.row.id);

    let applied = false;
    for (let i = 0; i < candidates.length;) {
      const distance = candidates[i]!.distance;
      const group = [];
      while (i < candidates.length && Math.abs(candidates[i]!.distance - distance) <= EPS) {
        group.push(candidates[i]!);
        i += 1;
      }

      const donorCounts = new Map<FamilyCode, number>();
      for (const candidate of group) {
        donorCounts.set(candidate.from, (donorCounts.get(candidate.from) ?? 0) + 1);
      }
      const donorsCanSpare = [...donorCounts].every(([from, n]) => counts[from] - n >= minCount);
      if (!donorsCanSpare) continue;

      for (const candidate of group) {
        assignments.set(candidate.row.id, target);
        counts[candidate.from] -= 1;
        counts[target] += 1;
        adjustments.push({
          occupationId: candidate.row.id,
          from: candidate.from,
          to: target,
          axis: candidate.axis,
          distance: candidate.distance,
        });
      }
      applied = true;
      break;
    }

    if (!applied) {
      throw new Error(`[worktypes] unable to smooth underfloor family ${target}`);
    }

    for (const id of assignments.keys()) {
      if (!rowsById.has(id)) throw new Error(`[worktypes] internal error: unknown assignment id ${id}`);
    }
  }

  for (const code of FAMILY_CODES) {
    if (counts[code] < minCount || counts[code] > maxCount) {
      throw new Error(
        `[worktypes] family ${code} outside guardrails after calibration: count=${counts[code]} pct=${pct(counts[code], total)}`,
      );
    }
  }

  return { counts, rawDistribution, adjustments, minCount, maxCount };
}

function buildVariantMapping(): Record<FamilyCode, Record<string, string>> {
  const variants = {} as Record<FamilyCode, Record<string, string>>;
  for (const code of FAMILY_CODES) {
    const familyVariants: Record<string, string> = {};
    for (const a1 of MARGIN_VALUES) {
      for (const a2 of MARGIN_VALUES) {
        for (const a3 of MARGIN_VALUES) {
          const pattern = `${a1}/${a2}/${a3}`;
          const strongCount = [a1, a2, a3].filter((margin) => margin === '3-0').length;
          const suffix = strongCount === 0 ? 'balance' : strongCount === 3 ? 'sweep' : 'mixed';
          familyVariants[pattern] = `${code.toLowerCase()}-${suffix}`;
        }
      }
    }
    variants[code] = familyVariants;
  }
  return variants;
}

export function buildWorktypesPayload(
  indexes: Indexes,
  options: { generatedAt?: string } = {},
): WorktypesData {
  const activeRows = activeAioisRows(indexes);
  if (activeRows.length === 0) {
    throw new Error('[worktypes] no active AIOIS occupation rows found');
  }

  const rows = axisRows(activeRows);
  const thresholds = computeWorktypeThresholds(rows);
  const assignments = new Map<number, FamilyCode>();
  for (const row of rows) {
    assignments.set(row.id, familyCodeFor(row, thresholds));
  }

  const calibration = calibrateAssignments(rows, assignments, thresholds);
  const finalDistribution = distributionFromCounts(calibration.counts, rows.length);

  const families = {} as WorktypesData['families'];
  for (const code of FAMILY_CODES) {
    families[code] = {
      familyId: FAMILY_IDS[code],
      count: finalDistribution[code].count,
      pct: finalDistribution[code].pct,
    };
  }

  const occupations: WorktypesData['occupations'] = {};
  for (const row of rows) {
    const code = assignments.get(row.id)!;
    occupations[String(row.id)] = {
      code,
      familyId: FAMILY_IDS[code],
      exposure: exposureFor(code),
      rarityPct: finalDistribution[code].pct,
    };
  }

  const payload: WorktypesData = {
    schema_version: '1.0',
    generated_at: options.generatedAt ?? nowIso(),
    thresholds,
    families,
    variants: buildVariantMapping(),
    occupations,
    calibration: {
      normalization: 'z_score',
      threshold_method: 'population z-score AIOIS dimensions; median split over active AIOIS-scored occupations',
      tie_break_rule:
        'Exact median ties use the strongest raw axis dimension: A1 D6>=D2 => C else R; A2 max(D5,D4)>=D1 => P else D; A3 D3>=max(D1,D4,D6) => B else K.',
      high_transformation_watch_threshold: HIGH_TRANSFORMATION_WATCH_THRESHOLD,
      guardrails: {
        min_pct: MIN_FAMILY_PCT,
        max_pct: MAX_FAMILY_PCT,
        min_count: calibration.minCount,
        max_count: calibration.maxCount,
      },
      raw_distribution: calibration.rawDistribution,
      smoothing: {
        method:
          'nearest-boundary smoothing for underfloor families; move all occupations tied at the cutoff distance so identical axis scores are not split',
        adjustments: calibration.adjustments,
      },
      variant_rarity: {
        display: false,
        reason:
          'Variants are derived from quiz margin patterns, not occupation buckets; only family-level rarity is statistically grounded for display.',
      },
      question_count_recommendation: {
        mvp_questions: 9,
        note:
          'Nine questions support three deterministic margin buckets per family: all-lean balance, mixed, and all-sweep. A 12-question version is not required for MVP separation.',
      },
    },
  };

  return WorktypesDataSchema.parse(payload);
}

export async function buildWorktypes(
  indexes: Indexes,
  distRoot: string,
): Promise<WorktypesBuildResult> {
  const payload = buildWorktypesPayload(indexes);
  const outPath = join(distRoot, 'data.worktypes.json');
  await writeFile(outPath, JSON.stringify(payload) + '\n', 'utf-8');

  return {
    files: [outPath],
    occupations: Object.keys(payload.occupations).length,
    families: FAMILY_CODES.length,
    adjustments: payload.calibration.smoothing.adjustments.length,
  };
}
