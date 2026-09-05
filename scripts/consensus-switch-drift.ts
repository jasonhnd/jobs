#!/usr/bin/env bun
/**
 * consensus-switch-drift.ts — mms-6g local tool.
 *
 * Compares the previous canonical rule (latest AIOIS-10 vote) with the
 * published consensus median for every occupation. Not wired into build.
 *
 * Usage:
 *   bun scripts/consensus-switch-drift.ts [--out docs/CONSENSUS_SWITCH_DRIFT.md]
 */
import { writeFileSync } from 'node:fs';
import { buildIndexes } from '../src/data/lib/indexes.js';
import { riskBand } from '../src/data/lib/bands.js';
import { fmean } from '../src/data/lib/fsum.js';
import { pickConsensusScore, pickLatestScore } from '../src/graph/score-strategy.js';

export const DESIGN_MEAN_LATEST = 5.23;
export const DESIGN_MEAN_CONSENSUS = 4.68;
export const DESIGN_ABS_DELTA_GE_1 = 100;
export const DESIGN_BAND_CHANGES = 133;
const MEAN_TOLERANCE = 0.02;
const COUNT_TOLERANCE = 8;

export interface SwitchMover {
  readonly id: number;
  readonly title: string;
  readonly latest: number;
  readonly consensus: number;
  readonly delta: number;
  readonly latestBand: string;
  readonly consensusBand: string;
}

export interface SwitchDriftSummary {
  readonly occupationCount: number;
  readonly meanLatest: number;
  readonly meanConsensus: number;
  readonly meanAbsDelta: number;
  readonly absDeltaGe05: number;
  readonly absDeltaGe10: number;
  readonly bandChanges: number;
  readonly movers: readonly SwitchMover[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeSwitchDrift(
  indexes: Awaited<ReturnType<typeof buildIndexes>>['indexes'],
): SwitchDriftSummary {
  const latestVals: number[] = [];
  const consensusVals: number[] = [];
  const movers: SwitchMover[] = [];
  let absDeltaGe05 = 0;
  let absDeltaGe10 = 0;
  let bandChanges = 0;

  for (const [id, history] of indexes.historyByOcc) {
    const comparable = history.filter((entry) => entry.aiois != null);
    if (comparable.length === 0) continue;
    const latest = pickLatestScore(comparable);
    const consensus = pickConsensusScore(history);
    const latestT = latest.aiois!.transformation;
    const consensusT = consensus.transformation;
    const delta = latestT - consensusT;
    const abs = Math.abs(delta);
    latestVals.push(latestT);
    consensusVals.push(consensusT);
    if (abs >= 0.5) absDeltaGe05 += 1;
    if (abs >= 1.0) absDeltaGe10 += 1;
    const latestBand = riskBand(latestT)!;
    const consensusBand = riskBand(consensusT)!;
    if (latestBand !== consensusBand) bandChanges += 1;
    movers.push({
      id,
      title: indexes.occById.get(id)?.title_ja ?? `職業 ${id}`,
      latest: latestT,
      consensus: consensusT,
      delta,
      latestBand,
      consensusBand,
    });
  }

  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id - b.id);

  return {
    occupationCount: movers.length,
    meanLatest: round2(fmean(latestVals)),
    meanConsensus: round2(fmean(consensusVals)),
    meanAbsDelta: round2(fmean(movers.map((row) => Math.abs(row.delta)))),
    absDeltaGe05,
    absDeltaGe10,
    bandChanges,
    movers,
  };
}

export function assertMatchesDesign(summary: SwitchDriftSummary): void {
  const meanLatestGap = Math.abs(summary.meanLatest - DESIGN_MEAN_LATEST);
  const meanConsensusGap = Math.abs(summary.meanConsensus - DESIGN_MEAN_CONSENSUS);
  const ge1Gap = Math.abs(summary.absDeltaGe10 - DESIGN_ABS_DELTA_GE_1);
  const bandGap = Math.abs(summary.bandChanges - DESIGN_BAND_CHANGES);
  if (meanLatestGap > MEAN_TOLERANCE || meanConsensusGap > MEAN_TOLERANCE || ge1Gap > COUNT_TOLERANCE || bandGap > COUNT_TOLERANCE) {
    throw new Error(
      `consensus-switch-drift diverges from the design figures ` +
      `(mean ${DESIGN_MEAN_LATEST}→${DESIGN_MEAN_CONSENSUS}, |Δ|≥1.0=${DESIGN_ABS_DELTA_GE_1}, band=${DESIGN_BAND_CHANGES}): ` +
      `got mean ${summary.meanLatest}→${summary.meanConsensus}, |Δ|≥1.0=${summary.absDeltaGe10}, band=${summary.bandChanges}`,
    );
  }
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
}

export function renderSwitchDriftMarkdown(summary: SwitchDriftSummary): string {
  const top = summary.movers.slice(0, 20);
  const rows = top.map((row) =>
    `| ${row.id} | ${row.title} | ${row.latest.toFixed(2)} | ${row.consensus.toFixed(2)} | ${signed(row.delta)} | ${row.latestBand}→${row.consensusBand} |`,
  ).join('\n');
  return `# Consensus switch drift — latest vote vs published median

Status: mms-6g local report (not a scoring-runbook batch-vs-batch drift).
Date: generated from current \`data/scores/\` occupation history.
Rule: previous canonical = \`pickLatestScore()\` (newest AIOIS-10 vote). New canonical = \`pickConsensusScore()\` (median of comparable votes).

## Headline

| Metric | Latest vote | Consensus | Design |
|---|---:|---:|---|
| Occupations compared | ${summary.occupationCount} | ${summary.occupationCount} | 556 |
| Mean Transformation | ${summary.meanLatest.toFixed(2)} | ${summary.meanConsensus.toFixed(2)} | 5.23 → 4.68 |
| mean \\|Δ\\| | ${summary.meanAbsDelta.toFixed(2)} | — | — |
| \\|Δ\\| ≥ 0.5 | ${summary.absDeltaGe05} | — | — |
| \\|Δ\\| ≥ 1.0 | ${summary.absDeltaGe10} | — | 100 |
| riskBand changes | ${summary.bandChanges} | — | 133 |

## Top 20 movers by \\|latest − consensus\\|

| id | 職業 | latest T | consensus T | Δ | band |
|---|---|---:|---:|---:|---|
${rows}

Δ is latest − consensus (positive = newest model scores higher than the published median).
`;
}

async function main(): Promise<void> {
  const outFlag = process.argv.indexOf('--out');
  const outPath = outFlag >= 0 ? process.argv[outFlag + 1] : undefined;
  const { indexes, errors } = await buildIndexes();
  if (errors.length > 0) {
    throw new Error(`consensus-switch-drift: index errors: ${errors.join('; ')}`);
  }
  const summary = computeSwitchDrift(indexes);
  assertMatchesDesign(summary);
  const markdown = renderSwitchDriftMarkdown(summary);
  if (outPath) writeFileSync(outPath, markdown);
  else process.stdout.write(markdown);
}

if (import.meta.main) {
  await main();
}
