#!/usr/bin/env bun
/**
 * flagship-switch-drift.ts — mms-8.16 local tool.
 *
 * Compares the published 5-vote median (history without the incoming batch)
 * with the vendor-flagship mean (full history). Not wired into build.
 *
 * Usage:
 *   bun scripts/flagship-switch-drift.ts [--incoming <model-id>] [--out docs/FLAGSHIP_SWITCH_DRIFT.md]
 */
import { writeFileSync } from 'node:fs';
import { buildIndexes } from '../src/data/lib/indexes.js';
import { riskBand, type RiskBand } from '../src/data/lib/bands.js';
import { displayScore } from '../src/data/lib/banker-round.js';
import { fmean } from '../src/data/lib/fsum.js';
import {
  pickConsensusScore,
  pickFlagshipMeanScore,
  pickLatestScore,
  type ScoreHistEntry,
} from '../src/graph/score-strategy.js';
import { LATEST_OBSERVATION_THRESHOLD } from '../src/site/consensus-copy.js';

export const DEFAULT_INCOMING_MODEL = 'claude-fable-5-1';

export interface FlagshipSwitchMover {
  readonly id: number;
  readonly title: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly beforeBand: RiskBand;
  readonly afterBand: RiskBand;
  readonly showsLatestLine: boolean;
}

export interface FlagshipSwitchBandCounts {
  readonly low: number;
  readonly mid: number;
  readonly high: number;
}

export interface FlagshipSwitchDriftSummary {
  readonly occupationCount: number;
  readonly incomingModel: string;
  readonly incomingDate: string | null;
  readonly generatedAt: string;
  readonly meanBefore: number;
  readonly meanAfter: number;
  readonly meanMedianWithIncoming: number;
  readonly absDeltaGe05: number;
  readonly absDeltaGe10: number;
  readonly bandBefore: FlagshipSwitchBandCounts;
  readonly bandAfter: FlagshipSwitchBandCounts;
  readonly bandChanges: number;
  readonly latestLineCount: number;
  readonly movers: readonly FlagshipSwitchMover[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function incomingDateOf(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistEntry[]>,
  incomingModel: string,
): string | null {
  let latest: string | null = null;
  for (const history of historyByOcc.values()) {
    for (const entry of history) {
      if (entry.model !== incomingModel) continue;
      if (latest === null || entry.date > latest) latest = entry.date;
    }
  }
  return latest;
}

function emptyBands(): { low: number; mid: number; high: number } {
  return { low: 0, mid: 0, high: 0 };
}

function bump(counts: { low: number; mid: number; high: number }, band: RiskBand): void {
  counts[band] += 1;
}

export function computeFlagshipSwitchDrift(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistEntry[]>,
  incomingModel: string,
  titles: ReadonlyMap<number, string>,
  generatedAt: string = new Date().toISOString().slice(0, 10),
): FlagshipSwitchDriftSummary {
  const beforeVals: number[] = [];
  const afterVals: number[] = [];
  const medianWithIncomingVals: number[] = [];
  const movers: FlagshipSwitchMover[] = [];
  const bandBefore = emptyBands();
  const bandAfter = emptyBands();
  let absDeltaGe05 = 0;
  let absDeltaGe10 = 0;
  let bandChanges = 0;
  let latestLineCount = 0;

  for (const [id, history] of historyByOcc) {
    const comparable = history.filter((entry) => entry.aiois != null);
    if (comparable.length === 0) continue;
    const withoutIncoming = comparable.filter((entry) => entry.model !== incomingModel);
    if (withoutIncoming.length === 0) continue;

    let beforeUnrounded: number;
    let afterUnrounded: number;
    let medianWithIncomingUnrounded: number;
    let latestT: number;
    try {
      beforeUnrounded = pickConsensusScore(withoutIncoming).transformation;
      afterUnrounded = pickFlagshipMeanScore(comparable).transformation;
      medianWithIncomingUnrounded = pickConsensusScore(comparable).transformation;
      latestT = pickLatestScore(comparable).aiois!.transformation;
    } catch {
      continue;
    }

    const before = displayScore(beforeUnrounded);
    const after = displayScore(afterUnrounded);
    const delta = after - before;
    const abs = Math.abs(delta);
    const beforeBand = riskBand(before);
    const afterBand = riskBand(after);
    if (beforeBand === null || afterBand === null) continue;

    beforeVals.push(before);
    afterVals.push(after);
    medianWithIncomingVals.push(displayScore(medianWithIncomingUnrounded));
    if (abs >= 0.5) absDeltaGe05 += 1;
    if (abs >= 1.0) absDeltaGe10 += 1;
    bump(bandBefore, beforeBand);
    bump(bandAfter, afterBand);
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
    occupationCount: movers.length,
    incomingModel,
    incomingDate: incomingDateOf(historyByOcc, incomingModel),
    generatedAt,
    meanBefore: round2(fmean(beforeVals)),
    meanAfter: round2(fmean(afterVals)),
    meanMedianWithIncoming: round2(fmean(medianWithIncomingVals)),
    absDeltaGe05,
    absDeltaGe10,
    bandBefore,
    bandAfter,
    bandChanges,
    latestLineCount,
    movers,
  };
}

function signed1(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
}

function bandCell(row: FlagshipSwitchMover): string {
  return `${row.beforeBand}→${row.afterBand}`;
}

function moverRows(rows: readonly FlagshipSwitchMover[]): string {
  return rows.map((row) =>
    `| ${row.id} | ${row.title} | ${row.before.toFixed(1)} | ${row.after.toFixed(1)} | ${signed1(row.delta)} | ${bandCell(row)} |`,
  ).join('\n');
}

export function renderFlagshipSwitchMarkdown(summary: FlagshipSwitchDriftSummary): string {
  const incomingRef = summary.incomingDate
    ? `${summary.incomingModel}@${summary.incomingDate}`
    : summary.incomingModel;
  const up = [...summary.movers].filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.id - b.id)
    .slice(0, 20);
  const down = [...summary.movers].filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.id - b.id)
    .slice(0, 20);
  const b = summary.bandBefore;
  const a = summary.bandAfter;
  return `# 旗艦平均への切替 drift（mms-8.28）

生成: ${summary.generatedAt} / incoming: ${incomingRef} / 旧規則: 5 票中央値（着地前）/ 新規則: 各社最新 run の平均

## Summary
| 項目 | 着地前（中央値） | 着地後（旗艦平均） |
|---|---:|---:|
| 全職業平均 | ${summary.meanBefore.toFixed(2)} | ${summary.meanAfter.toFixed(2)} |
| \\|Δ\\| ≥ 0.5 | — | ${summary.absDeltaGe05} |
| \\|Δ\\| ≥ 1.0 | — | ${summary.absDeltaGe10} |
| リスク帯 low / mid / high | ${b.low} / ${b.mid} / ${b.high} | ${a.low} / ${a.mid} / ${a.high}（変化 ${summary.bandChanges} 職業） |
| 最新観測行の表示 | — | ${summary.latestLineCount} 職業 |

（参考: 中央値に incoming を加えた場合の平均 = ${summary.meanMedianWithIncoming.toFixed(2)}）

## 上昇 Top 20

| id | 職業 | 前 | 後 | Δ | 帯 前→後 |
|---|---|---:|---:|---:|---|
${moverRows(up)}

## 下降 Top 20

| id | 職業 | 前 | 後 | Δ | 帯 前→後 |
|---|---|---:|---:|---:|---|
${moverRows(down)}
`;
}

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

export function formatSwitchDriftSummaryLine(summary: FlagshipSwitchDriftSummary): string {
  return (
    `occupations=${summary.occupationCount} ` +
    `mean ${summary.meanBefore.toFixed(2)}→${summary.meanAfter.toFixed(2)} ` +
    `|Δ|≥0.5=${summary.absDeltaGe05} |Δ|≥1.0=${summary.absDeltaGe10} ` +
    `band ${summary.bandBefore.low}/${summary.bandBefore.mid}/${summary.bandBefore.high}→` +
    `${summary.bandAfter.low}/${summary.bandAfter.mid}/${summary.bandAfter.high} ` +
    `(${summary.bandChanges} changed)`
  );
}

async function main(): Promise<void> {
  const incomingModel = flagValue('--incoming') ?? DEFAULT_INCOMING_MODEL;
  const outPath = flagValue('--out');
  const { indexes, errors } = await buildIndexes();
  if (errors.length > 0) {
    throw new Error(`flagship-switch-drift: index errors: ${errors.map((e) => e.message).join('; ')}`);
  }
  const titles = new Map<number, string>();
  for (const [id, occ] of indexes.occById) titles.set(id, occ.title_ja);
  const summary = computeFlagshipSwitchDrift(indexes.historyByOcc, incomingModel, titles);
  console.log(formatSwitchDriftSummaryLine(summary));
  const markdown = renderFlagshipSwitchMarkdown(summary);
  if (outPath) writeFileSync(outPath, markdown);
  else process.stdout.write(markdown);
}

if (import.meta.main) {
  await main();
}
