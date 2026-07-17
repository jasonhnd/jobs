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
export {
  computeDriftReport,
  riskBand,
  type AioisScore,
  type Band,
  type DriftOptions,
  type DriftReport,
  type DriftRow,
} from '../src/graph/aiois-drift.js';
import { computeDriftReport, type AioisScore, type DriftReport, type DriftRow } from '../src/graph/aiois-drift.js';
import {
  ScoringMethodIdSchema,
  type ScoringMethodId,
} from '../src/data/schema/score-run.js';

// ───── Markdown rendering ─────

const TOP_T_COUNT = 20;
const TOP_RANK_COUNT = 20;
const TOP_D_COUNT = 10;
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
  readonly baseMethodId: ScoringMethodId;
  readonly candMethodId: ScoringMethodId;
}

const METHOD_LABELS: Readonly<Record<ScoringMethodId, string>> = {
  'legacy-single-axis': 'legacy single-axis judgment',
  'aiois-vector-semantic-hybrid': 'AIOIS hybrid (D1 semantic judgment; D2–D10 vector engine)',
  'aiois-semantic-judgment': 'AIOIS semantic judgment (model-judged D1–D10)',
};

function methodologyNote(meta: DriftMeta): string {
  const baseLabel = METHOD_LABELS[meta.baseMethodId];
  const candLabel = METHOD_LABELS[meta.candMethodId];
  if (meta.baseMethodId === meta.candMethodId) {
    return (
      `> 評価方式: 両バッチとも ${baseLabel}。` +
      'この比較に評価方式の変更は含まれません。'
    );
  }
  return (
    `> 評価方式の変更: baseline は ${baseLabel}、candidate は ${candLabel}。\n` +
    '> Drift はモデル差と、このバッチ metadata に明記された方式差の合成です。'
  );
}

export function renderDriftMarkdown(rep: DriftReport, meta: DriftMeta): string {
  const dims = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'];
  const section = (title: string, rows: readonly DriftRow[]): string =>
    rows.length ? `## ${title}\n\n${ROW_HEADER}\n${rows.map(rowLine).join('\n')}\n` : `## ${title}\n\n(該当なし)\n`;

  return `# AIOIS-10 drift report — ${meta.baseModel} (${meta.baseDate}) vs ${meta.candModel} (${meta.candDate})

${methodologyNote(meta)}

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
  scorer?: { model?: string; scoring_method_id?: string };
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
  const parseMethodId = (value: unknown, label: string): ScoringMethodId => {
    const parsed = ScoringMethodIdSchema.safeParse(value);
    return parsed.success ? parsed.data : fail(`${label}: missing or invalid scorer.scoring_method_id`);
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

  const loadBatch = (
    path: string,
    label: string,
  ): { batch: RawBatch; scores: Map<number, AioisScore>; methodId: ScoringMethodId } => {
    const batch = JSON.parse(readFileSync(path, 'utf8')) as RawBatch;
    if (!batch.scores || !batch.run?.run_date || !batch.scorer?.model) fail(`${label}: missing scores/run/scorer`);
    const methodId = parseMethodId(batch.scorer?.scoring_method_id, label);
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
    return {
      batch,
      scores,
      methodId,
    };
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
    baseMethodId: base.methodId,
    candMethodId: cand.methodId,
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
