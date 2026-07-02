#!/usr/bin/env bun
/**
 * aiois-drift-report.ts — Issue #9 AIOIS-10 drift report
 * (docs/SCORING_RUNBOOK.md Phase 6).
 *
 * Compares a baseline AIOIS-10 batch to a candidate batch on their COMMON ids
 * and writes the runbook-required markdown report: mean transformation /
 * displacement drift, D1–D10 average drift, band movement, top moves, rank
 * changes, and the manual-review list.
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / vercel.json.
 *
 * Usage:
 *   bun scripts/aiois-drift-report.ts \
 *     --baseline data/scores/occupations_claude-opus-4-8_2026-05-30.json \
 *     --candidate .cache/scoring/issue-9/pilot/occupations_claude-fable-5_2026-06-13_pilot.json \
 *     --out .cache/scoring/issue-9/pilot/drift_claude-opus-4-8_vs_claude-fable-5_2026-06-13.md \
 *     [--rank-threshold N] [--low-confidence 0.7]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ───── Pure, testable core ─────

export type Band = 'low' | 'mid' | 'high';

/** ai_risk band — matches bands.ts riskBand (decimal-safe): < 4.0 low / < 7.0 mid / ≥ 7.0 high. */
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

/** Rank ids by a score map, 1 = highest score; ties → lower id first. */
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

// ───── Markdown rendering ─────

const f1 = (n: number): string => n.toFixed(1);
const f2s = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

function rowLine(r: DriftRow): string {
  return (
    `| ${r.id} | ${r.title} | ${f1(r.baseT)} → ${f1(r.candT)} (${f2s(r.dT)}) ` +
    `| ${f1(r.baseD)} → ${f1(r.candD)} (${f2s(r.dD)}) | ${r.baseBand}→${r.candBand} ` +
    `| ${r.baseRank}→${r.candRank} | ${r.confidence ?? '–'} | ${r.flags.join(', ') || '–'} |`
  );
}

const ROW_HEADER =
  '| id | 職業 | T (base→cand) | D (base→cand) | band | rank | conf | flags |\n' +
  '|---|---|---|---|---|---|---|---|';

export interface DriftMeta {
  readonly baseModel: string;
  readonly baseDate: string;
  readonly candModel: string;
  readonly candDate: string;
  readonly rankThreshold: number;
}

export function renderDriftMarkdown(rep: DriftReport, meta: DriftMeta): string {
  const dims = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'];
  const section = (title: string, rows: readonly DriftRow[]): string =>
    rows.length ? `## ${title}\n\n${ROW_HEADER}\n${rows.map(rowLine).join('\n')}\n` : `## ${title}\n\n(該当なし)\n`;

  return `# AIOIS-10 drift report — ${meta.baseModel} (${meta.baseDate}) vs ${meta.candModel} (${meta.candDate})

> Drift は「モデル差」と「方式差（baseline D2–D10: vector engine / candidate: semantic judgment）」の合成である
> （docs/SCORING_RUNBOOK.md §Execution mechanism）。

## Summary

- Compared ids (common set): **${rep.comparedCount}**
- Mean transformation drift: **${f2s(rep.meanDriftT)}** (mean |drift| ${rep.meanAbsDriftT.toFixed(2)})
- Mean displacement drift: **${f2s(rep.meanDriftD)}** (mean |drift| ${rep.meanAbsDriftD.toFixed(2)})
- Band crossings: **${rep.bandCrossCount} / ${rep.comparedCount}**
- Manual review candidates: **${rep.manualReview.length}**（rank threshold ≥ ${meta.rankThreshold}）

## D1–D10 平均 drift（candidate − baseline）

| dim | signed mean | mean abs |
|---|---|---|
${dims.map((d, k) => `| ${d} | ${f2s(rep.dimDrift[k]!)} | ${rep.dimAbsDrift[k]!.toFixed(2)} |`).join('\n')}

## Band movement（baseline 行 → candidate 列）

| base\\cand | low | mid | high |
|---|---|---|---|
| low | ${rep.bandMatrix.low.low} | ${rep.bandMatrix.low.mid} | ${rep.bandMatrix.low.high} |
| mid | ${rep.bandMatrix.mid.low} | ${rep.bandMatrix.mid.mid} | ${rep.bandMatrix.mid.high} |
| high | ${rep.bandMatrix.high.low} | ${rep.bandMatrix.high.mid} | ${rep.bandMatrix.high.high} |

${section(`Top ${TOP_T_COUNT} upward moves（transformation）`, rep.topUpT)}
${section(`Top ${TOP_T_COUNT} downward moves（transformation）`, rep.topDownT)}
${section(`Top ${TOP_RANK_COUNT} rank changes`, rep.topRankShifts)}
${section(`Top ${TOP_D_COUNT} displacement upward moves`, rep.topUpD)}
${section(`Top ${TOP_D_COUNT} displacement downward moves`, rep.topDownD)}
${section('Manual review list（runbook 基準該当）', rep.manualReview)}
## 全件一覧

${ROW_HEADER}
${rep.rows.map(rowLine).join('\n')}
`;
}

// ───── CLI wrapper (only runs when executed directly) ─────

interface RawBatch {
  scorer?: { model?: string };
  run?: { run_date?: string };
  scores?: Record<
    string,
    {
      ai_risk?: number;
      confidence?: number | null;
      aiois?: Record<string, number> | null;
    }
  >;
}

if (import.meta.main) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const OCC_DIR = join(ROOT, 'data', 'occupations');
  const fail = (m: string): never => {
    console.error(`[aiois-drift-report] FAIL — ${m}`);
    process.exit(1);
  };

  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) fail(`--${a.slice(2)} needs a value`);
    args[a.slice(2)] = v as string;
    i += 1;
  }

  const baselinePath = resolve(ROOT, args['baseline'] ?? fail('missing --baseline'));
  const candidatePath = resolve(ROOT, args['candidate'] ?? fail('missing --candidate'));
  const outPath = resolve(ROOT, args['out'] ?? fail('missing --out'));
  const lowConfidence = Number.parseFloat(args['low-confidence'] ?? '0.7');

  const loadBatch = (path: string, label: string): { batch: RawBatch; scores: Map<number, AioisScore> } => {
    const batch = JSON.parse(readFileSync(path, 'utf8')) as RawBatch;
    if (!batch.scores || !batch.run?.run_date || !batch.scorer?.model) fail(`${label}: missing scores/run/scorer`);
    const scores = new Map<number, AioisScore>();
    for (const [k, v] of Object.entries(batch.scores!)) {
      const a = v.aiois;
      if (a == null) continue; // legacy single-axis entries cannot join an AIOIS drift report
      if (typeof v.ai_risk !== 'number') fail(`${label}: id ${k} lacks ai_risk`);
      scores.set(Number.parseInt(k, 10), {
        aiRisk: v.ai_risk!,
        displacement: a.displacement!,
        dims: [a.d1!, a.d2!, a.d3!, a.d4!, a.d5!, a.d6!, a.d7!, a.d8!, a.d9!, a.d10!],
        confidence: v.confidence ?? null,
      });
    }
    return { batch, scores };
  };

  const base = loadBatch(baselinePath, 'baseline');
  const cand = loadBatch(candidatePath, 'candidate');

  const titles = new Map<number, string>();
  for (const f of readdirSync(OCC_DIR).filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join(OCC_DIR, f), 'utf8')) as Record<string, any>;
    titles.set(Number(raw.id), String(raw.title_ja ?? ''));
  }

  const comparedEstimate = [...cand.scores.keys()].filter((id) => base.scores.has(id)).length;
  const rankThreshold = Number.parseInt(args['rank-threshold'] ?? (comparedEstimate >= 100 ? '50' : '10'), 10);

  const report = computeDriftReport(base.scores, cand.scores, titles, { rankThreshold, lowConfidence });
  const md = renderDriftMarkdown(report, {
    baseModel: base.batch.scorer!.model!,
    baseDate: base.batch.run!.run_date!,
    candModel: cand.batch.scorer!.model!,
    candDate: cand.batch.run!.run_date!,
    rankThreshold,
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, md);

  console.log(`[aiois-drift-report] OK → ${outPath}`);
  console.log(
    `  compared=${report.comparedCount}  meanΔT=${f2s(report.meanDriftT)} (|${report.meanAbsDriftT.toFixed(2)}|)` +
      `  meanΔD=${f2s(report.meanDriftD)} (|${report.meanAbsDriftD.toFixed(2)}|)`,
  );
  console.log(`  band crossings=${report.bandCrossCount}  manual review=${report.manualReview.length} (rank≥${rankThreshold})`);
}
