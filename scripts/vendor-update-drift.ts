#!/usr/bin/env bun
/**
 * vendor-update-drift.ts — mms-8.34 local tool.
 *
 * Compares the published 3-vendor flagship mean without an incoming model
 * against the mean with that model in the panel (the vendor's previous
 * flagship still sits in `before`). Not wired into build / gates / CI.
 *
 * Usage:
 *   bun scripts/vendor-update-drift.ts --model <incoming-model-id> \
 *     [--out docs/VENDOR_UPDATE_DRIFT_<model>_<date>.md]
 */
import { writeFileSync } from 'node:fs';
import { buildIndexes } from '../src/data/lib/indexes.js';
import {
  pickFlagshipMeanScore,
  pickLatestScore,
  type ScoreHistEntry,
} from '../src/graph/score-strategy.js';
import { computeDrift, type DriftMover, type DriftBandCounts } from './lib/drift-core.js';
import { formatVendorDisplay, isWhitelistedVendor } from '../src/site/score-attribution.js';

export interface VendorUpdateMover extends DriftMover {}

export interface VendorUpdateBandCounts extends DriftBandCounts {}

export interface VendorSwap {
  readonly provider: string;
  readonly oldModel: string | null;
  readonly oldDate: string | null;
  readonly incomingModel: string;
  readonly incomingDate: string;
}

export interface VendorUpdateDriftSummary {
  readonly occupationCount: number;
  readonly skippedOccupationIds: readonly number[];
  readonly incomingModel: string;
  readonly incomingDate: string;
  readonly generatedAt: string;
  readonly swap: VendorSwap;
  readonly meanBefore: number;
  readonly meanAfter: number;
  readonly absDeltaGe05: number;
  readonly absDeltaGe10: number;
  readonly bandBefore: VendorUpdateBandCounts;
  readonly bandAfter: VendorUpdateBandCounts;
  readonly bandChanges: number;
  readonly latestLineCount: number;
  readonly movers: readonly VendorUpdateMover[];
}

function comparableOf(history: readonly ScoreHistEntry[]): ScoreHistEntry[] {
  return history.filter((entry) => entry.aiois != null && entry.backfill !== true);
}

/**
 * Resolve the vendor swap for `incomingModel` across the occupation histories.
 * Throws if the model has no comparable batch or its provider is off the whitelist.
 */
export function resolveVendorSwap(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistEntry[]>,
  incomingModel: string,
): VendorSwap {
  const incomingEntries: ScoreHistEntry[] = [];
  for (const history of historyByOcc.values()) {
    for (const entry of comparableOf(history)) {
      if (entry.model === incomingModel) incomingEntries.push(entry);
    }
  }
  if (incomingEntries.length === 0) {
    throw new Error(`vendor-update-drift: no comparable batch for model ${incomingModel}`);
  }
  const providers = new Set(incomingEntries.map((entry) => entry.provider));
  if (providers.size !== 1) {
    throw new Error(
      `vendor-update-drift: model ${incomingModel} has mixed providers (${[...providers].join(', ')})`,
    );
  }
  const provider = incomingEntries[0]!.provider;
  if (!isWhitelistedVendor(provider)) {
    throw new Error(`vendor-update-drift: vendor ${provider} is not whitelisted`);
  }
  let incomingDate = incomingEntries[0]!.date;
  for (const entry of incomingEntries) {
    if (entry.date > incomingDate) incomingDate = entry.date;
  }

  let oldModel: string | null = null;
  let oldDate: string | null = null;
  for (const history of historyByOcc.values()) {
    for (const entry of comparableOf(history)) {
      if (entry.provider !== provider || entry.model === incomingModel) continue;
      if (oldDate === null || entry.date > oldDate || (entry.date === oldDate && entry.model > (oldModel ?? ''))) {
        oldModel = entry.model;
        oldDate = entry.date;
      }
    }
  }

  return { provider, oldModel, oldDate, incomingModel, incomingDate };
}

export function formatVendorSwappedLine(swap: VendorSwap): string {
  const vendor = formatVendorDisplay(swap.provider);
  const oldRef = swap.oldModel && swap.oldDate ? `${swap.oldModel}@${swap.oldDate}` : '—';
  return `vendor swapped: ${vendor} ${oldRef} → ${swap.incomingModel}@${swap.incomingDate}`;
}

export function computeVendorUpdateDrift(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistEntry[]>,
  incomingModel: string,
  titles: ReadonlyMap<number, string>,
  generatedAt: string = new Date().toISOString().slice(0, 10),
): VendorUpdateDriftSummary {
  const swap = resolveVendorSwap(historyByOcc, incomingModel);
  const { summary } = computeDrift(historyByOcc, incomingModel, titles, {
    comparableOf,
    // Aggregate means use unrounded values; counts use displayed values (#631).
    meanBasis: 'unrounded',
    selectScores: (comparable, withoutIncoming) => ({
      beforeUnrounded: pickFlagshipMeanScore(withoutIncoming).transformation,
      afterUnrounded: pickFlagshipMeanScore(comparable).transformation,
      latestT: pickLatestScore(comparable).aiois!.transformation,
    }),
  });

  return {
    occupationCount: summary.occupationCount,
    skippedOccupationIds: summary.skippedOccupationIds,
    incomingModel,
    incomingDate: swap.incomingDate,
    generatedAt,
    swap,
    meanBefore: summary.meanBefore,
    meanAfter: summary.meanAfter,
    absDeltaGe05: summary.absDeltaGe05,
    absDeltaGe10: summary.absDeltaGe10,
    bandBefore: summary.bandBefore,
    bandAfter: summary.bandAfter,
    bandChanges: summary.bandChanges,
    latestLineCount: summary.latestLineCount,
    movers: summary.movers,
  };
}

function formatSkippedOccupations(ids: readonly number[]): string {
  return `Skipped occupations: ${ids.length}; IDs: ${ids.length > 0 ? ids.join(', ') : 'none'}.`;
}

function signed1(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
}

function bandCell(row: VendorUpdateMover): string {
  return `${row.beforeBand}→${row.afterBand}`;
}

function moverRows(rows: readonly VendorUpdateMover[]): string {
  return rows.map((row) =>
    `| ${row.id} | ${row.title} | ${row.before.toFixed(1)} | ${row.after.toFixed(1)} | ${signed1(row.delta)} | ${bandCell(row)} |`,
  ).join('\n');
}

export function renderVendorUpdateMarkdown(summary: VendorUpdateDriftSummary): string {
  const incomingRef = `${summary.incomingModel}@${summary.incomingDate}`;
  const up = [...summary.movers].filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.id - b.id)
    .slice(0, 20);
  const down = [...summary.movers].filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.id - b.id)
    .slice(0, 20);
  const b = summary.bandBefore;
  const a = summary.bandAfter;
  return `# 旗艦入れ替え drift（mms-8.34）

生成: ${summary.generatedAt} / incoming: ${incomingRef}
${formatVendorSwappedLine(summary.swap)}

## Summary
| 項目 | 着地前（旗艦平均） | 着地後（旗艦平均） |
|---|---:|---:|
| 全職業平均 | ${summary.meanBefore.toFixed(2)} | ${summary.meanAfter.toFixed(2)} |
| \\|Δ\\| ≥ 0.5 | — | ${summary.absDeltaGe05} |
| \\|Δ\\| ≥ 1.0 | — | ${summary.absDeltaGe10} |
| リスク帯 low / mid / high | ${b.low} / ${b.mid} / ${b.high} | ${a.low} / ${a.mid} / ${a.high}（変化 ${summary.bandChanges} 職業） |
| 最新観測行の表示 | — | ${summary.latestLineCount} 職業 |

## 上昇 Top 20

| id | 職業 | 前 | 後 | Δ | 帯 前→後 |
|---|---|---:|---:|---:|---|
${moverRows(up)}

## 下降 Top 20

| id | 職業 | 前 | 後 | Δ | 帯 前→後 |
|---|---|---:|---:|---:|---|
${moverRows(down)}

${formatSkippedOccupations(summary.skippedOccupationIds)}
`;
}

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) return undefined;
  return value;
}

export function formatVendorUpdateSummaryLine(summary: VendorUpdateDriftSummary): string {
  return (
    `occupations=${summary.occupationCount} ` +
    `mean ${summary.meanBefore.toFixed(2)}→${summary.meanAfter.toFixed(2)} ` +
    `|Δ|≥0.5=${summary.absDeltaGe05} |Δ|≥1.0=${summary.absDeltaGe10} ` +
    `band ${summary.bandBefore.low}/${summary.bandBefore.mid}/${summary.bandBefore.high}→` +
    `${summary.bandAfter.low}/${summary.bandAfter.mid}/${summary.bandAfter.high} ` +
    `(${summary.bandChanges} changed) ` +
    formatVendorSwappedLine(summary.swap) +
    ` ${formatSkippedOccupations(summary.skippedOccupationIds)}`
  );
}

async function main(): Promise<void> {
  const incomingModel = flagValue('--model');
  if (!incomingModel) {
    throw new Error('vendor-update-drift: --model <incoming-model-id> is required');
  }
  const outPath = flagValue('--out');
  const { indexes, errors } = await buildIndexes();
  if (errors.length > 0) {
    throw new Error(`vendor-update-drift: index errors: ${errors.map((e) => e.message).join('; ')}`);
  }
  const titles = new Map<number, string>();
  for (const [id, occ] of indexes.occById) titles.set(id, occ.title_ja);
  const summary = computeVendorUpdateDrift(indexes.historyByOcc, incomingModel, titles);
  console.log(formatVendorUpdateSummaryLine(summary));
  const markdown = renderVendorUpdateMarkdown(summary);
  if (outPath) writeFileSync(outPath, markdown);
  else process.stdout.write(markdown);
}

if (import.meta.main) {
  await main();
}
