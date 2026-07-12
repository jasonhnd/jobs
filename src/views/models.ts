/**
 * Pure data model for /models. Input is score history already loaded into the
 * graph; this module only groups, aggregates, and calls the shared drift core.
 */
import { computeDriftReport, riskBand, type AioisScore, type Band, type DriftReport, type DriftRow } from '@/graph/aiois-drift';
import type { KnowledgeGraph, ScoreHistoryEntry } from '@/graph';
import { formatModelDisplay } from '@/site/score-attribution';

type BatchKey = string;

export interface AioisDimensionMeta {
  readonly code: string;
  readonly ja: string;
}

export interface DimensionDriftRow {
  readonly pair: string;
  readonly dimension: string;
  readonly dimensionJa: string;
  readonly baselineMean: number;
  readonly candidateMean: number;
  readonly drift: number;
  readonly meanAbsDrift: number;
  readonly n: number;
}

export interface ModelsChart {
  readonly svg: string;
  readonly fallback: string;
}

export interface ModelsCharts {
  readonly histogram: ModelsChart;
  readonly scatter: ModelsChart;
  readonly inlineHtmlBytes: number;
}

export interface BatchSummary {
  readonly key: BatchKey;
  readonly model: string;
  readonly modelDisplay: string;
  readonly date: string;
  readonly coverage: number;
  readonly total: number;
  readonly aioisCoverage: number;
  readonly isCanonical: boolean;
  readonly meanTransformation: number;
  readonly meanDisplacement: number | null;
  readonly dimMeans: readonly number[] | null;
}

export interface DriftPairSummary {
  readonly key: string;
  readonly base: BatchSummary;
  readonly candidate: BatchSummary;
  readonly report: DriftReport;
  readonly dimensionRows: readonly DimensionDriftRow[];
  readonly tendencyNotes: readonly string[];
}

export interface ModelsPageModel {
  readonly batches: readonly BatchSummary[];
  readonly canonical: BatchSummary;
  readonly driftPairs: readonly DriftPairSummary[];
  readonly largestDivergences: readonly DriftRow[];
  readonly latestPair: DriftPairSummary | null;
  readonly charts: ModelsCharts | null;
}

export interface ModelsPageInput {
  readonly historyByOcc: ReadonlyMap<number, readonly ScoreHistoryEntry[]>;
  readonly titlesByOcc: ReadonlyMap<number, string>;
  readonly totalOccupations: number;
  readonly aioisDimensions: readonly AioisDimensionMeta[];
}

function batchKey(model: string, date: string): BatchKey {
  return `${date}::${model}`;
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : 0;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function dimsArray(entry: ScoreHistoryEntry): readonly number[] | null {
  if (entry.dims == null) return null;
  return [
    entry.dims.d1, entry.dims.d2, entry.dims.d3, entry.dims.d4, entry.dims.d5,
    entry.dims.d6, entry.dims.d7, entry.dims.d8, entry.dims.d9, entry.dims.d10,
  ];
}

function chooseCanonical(batches: readonly Omit<BatchSummary, 'isCanonical'>[]): BatchKey {
  const sorted = [...batches].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    Number(b.aioisCoverage > 0) - Number(a.aioisCoverage > 0) ||
    b.coverage - a.coverage ||
    a.model.localeCompare(b.model),
  );
  return sorted[0]?.key ?? '';
}

function toAioisScoreMap(
  historyByOcc: ReadonlyMap<number, readonly ScoreHistoryEntry[]>,
  key: BatchKey,
): Map<number, AioisScore> {
  const out = new Map<number, AioisScore>();
  for (const [id, history] of historyByOcc) {
    const entry = history.find((h) => batchKey(h.model, h.date) === key);
    if (!entry || entry.displacement == null) continue;
    const dims = dimsArray(entry);
    if (dims == null) continue;
    out.set(id, {
      aiRisk: entry.transformation,
      displacement: entry.displacement,
      dims,
      confidence: entry.confidence,
    });
  }
  return out;
}

function pairLabel(pair: Pick<DriftPairSummary, 'base' | 'candidate'>): string {
  return `${pair.base.modelDisplay}（${pair.base.date}）→ ${pair.candidate.modelDisplay}（${pair.candidate.date}）`;
}

export function buildDimensionDriftRows(
  pair: Pick<DriftPairSummary, 'base' | 'candidate' | 'report'>,
  baseScores: ReadonlyMap<number, AioisScore>,
  candidateScores: ReadonlyMap<number, AioisScore>,
  aioisDimensions: readonly AioisDimensionMeta[],
): readonly DimensionDriftRow[] {
  const commonIds = pair.report.rows.map((row) => row.id);
  return aioisDimensions.map((dim, idx): DimensionDriftRow => ({
    pair: pairLabel(pair),
    dimension: dim.code,
    dimensionJa: dim.ja,
    baselineMean: mean(commonIds.map((id) => baseScores.get(id)!.dims[idx]!)),
    candidateMean: mean(commonIds.map((id) => candidateScores.get(id)!.dims[idx]!)),
    drift: pair.report.dimDrift[idx]!,
    meanAbsDrift: pair.report.dimAbsDrift[idx]!,
    n: pair.report.comparedCount,
  })).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift) || a.dimension.localeCompare(b.dimension, 'en', { numeric: true }));
}

export function buildTendencyNotes(
  rows: readonly Pick<DimensionDriftRow, 'dimension' | 'dimensionJa' | 'drift'>[],
  baselineModel: string,
  candidateModel: string,
): readonly string[] {
  const mentionRows = [...rows]
    .filter((row) => Math.abs(row.drift) >= 0.5)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift) || a.dimension.localeCompare(b.dimension, 'en', { numeric: true }))
    .slice(0, 3);

  if (mentionRows.length === 0) {
    return ['このペアでは、平均差が0.50以上のD1〜D10はありません。'];
  }

  return mentionRows.map((row) => {
    const degree = Math.abs(row.drift) >= 0.75 ? '大きく' : 'やや';
    const direction = row.drift > 0 ? '重く' : '軽く';
    return `${candidateModel} は ${baselineModel} より「${row.dimensionJa}（${row.dimension}）」を${degree}${direction}見ています（${formatSigned(row.drift)}）。`;
  });
}

export function transformationHistogramBins(values: readonly number[]): readonly number[] {
  const bins = Array.from({ length: 20 }, () => 0);
  for (const value of values) {
    const clamped = Math.max(0, Math.min(10, value));
    const idx = Math.min(19, Math.floor(clamped / 0.5));
    bins[idx]! += 1;
  }
  return bins;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function chartTitleId(key: string, suffix: string): string {
  return `models-${key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${suffix}`;
}

function highBandShare(values: readonly number[]): number {
  return values.length ? values.filter((v) => riskBand(v) === 'high').length / values.length : 0;
}

export function renderTransformationHistogram(pair: DriftPairSummary): ModelsChart {
  const baseValues = pair.report.rows.map((row) => row.baseT);
  const candidateValues = pair.report.rows.map((row) => row.candT);
  const baseBins = transformationHistogramBins(baseValues);
  const candidateBins = transformationHistogramBins(candidateValues);
  const maxCount = Math.max(1, ...baseBins, ...candidateBins);
  const width = 960;
  const height = 300;
  const left = 46;
  const right = 18;
  const top = 34;
  const bottom = 42;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const binW = plotW / 20;
  const titleId = chartTitleId(pair.key, 'hist-title');
  const descId = chartTitleId(pair.key, 'hist-desc');
  const bars = baseBins.map((baseCount, i) => {
    const candCount = candidateBins[i]!;
    const x = left + i * binW;
    const baseH = (baseCount / maxCount) * plotH;
    const candH = (candCount / maxCount) * plotH;
    return `<rect x="${(x + 1).toFixed(1)}" y="${(top + plotH - baseH).toFixed(1)}" width="${(binW / 2 - 1).toFixed(1)}" height="${baseH.toFixed(1)}" fill="var(--fg2)" opacity=".48"></rect>` +
      `<rect x="${(x + binW / 2).toFixed(1)}" y="${(top + plotH - candH).toFixed(1)}" width="${(binW / 2 - 1).toFixed(1)}" height="${candH.toFixed(1)}" fill="var(--accent)" opacity=".72"></rect>`;
  }).join('');
  const grid = [0, 0.5, 1].map((ratio) => {
    const y = top + plotH - ratio * plotH;
    const label = Math.round(ratio * maxCount);
    return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"></line>` +
      `<text x="${left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--fg2)">${label}</text>`;
  }).join('');
  const fallback = `${pair.base.modelDisplay} 平均 ${mean(baseValues).toFixed(2)}、中央値 ${median(baseValues).toFixed(2)}、高帯 ${(highBandShare(baseValues) * 100).toFixed(1)}%。` +
    `${pair.candidate.modelDisplay} 平均 ${mean(candidateValues).toFixed(2)}、中央値 ${median(candidateValues).toFixed(2)}、高帯 ${(highBandShare(candidateValues) * 100).toFixed(1)}%。`;

  return {
    svg: `<svg class="models-svg" role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<title id="${titleId}">最新2バッチのAI影響度分布</title>` +
      `<desc id="${descId}">${escapeHtml(pair.base.modelDisplay)}と${escapeHtml(pair.candidate.modelDisplay)}の変化の大きさを0.0〜10.0、0.5刻みの20ビンで比較します。</desc>` +
      `<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="var(--bg2)"></rect>` +
      grid + bars +
      `<line x1="${left}" y1="${top + plotH}" x2="${width - right}" y2="${top + plotH}" stroke="var(--fg2)" stroke-width="1.2"></line>` +
      `<text x="${left}" y="${height - 14}" font-size="12" fill="var(--fg2)">0</text>` +
      `<text x="${left + plotW / 2}" y="${height - 14}" text-anchor="middle" font-size="12" fill="var(--fg2)">変化の大きさ</text>` +
      `<text x="${width - right}" y="${height - 14}" text-anchor="end" font-size="12" fill="var(--fg2)">10</text>` +
      `<rect x="${left}" y="14" width="12" height="12" fill="var(--fg2)" opacity=".48"></rect><text x="${left + 18}" y="24" font-size="12" fill="var(--fg)">${escapeHtml(pair.base.modelDisplay)}</text>` +
      `<rect x="${left + 210}" y="14" width="12" height="12" fill="var(--accent)" opacity=".72"></rect><text x="${left + 228}" y="24" font-size="12" fill="var(--fg)">${escapeHtml(pair.candidate.modelDisplay)}</text>` +
      `</svg>`,
    fallback,
  };
}

export function renderBeforeAfterScatter(pair: DriftPairSummary): ModelsChart {
  const width = 960;
  const height = 420;
  const left = 54;
  const right = 126;
  const top = 30;
  const bottom = 52;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const titleId = chartTitleId(pair.key, 'scatter-title');
  const descId = chartTitleId(pair.key, 'scatter-desc');
  const x = (v: number) => Math.round(left + (Math.max(0, Math.min(10, v)) / 10) * plotW);
  const y = (v: number) => Math.round(top + plotH - (Math.max(0, Math.min(10, v)) / 10) * plotH);
  const colorForBand: Record<Band, string> = {
    low: 'var(--green-deep)',
    mid: 'var(--accent)',
    high: 'var(--risk-3)',
  };
  const points = (['low', 'mid', 'high'] as const).map((band) => {
    const d = pair.report.rows
      .filter((row) => row.candBand === band)
      .map((row) => `M${x(row.baseT)} ${y(row.candT)}h0`)
      .join('');
    return d
      ? `<path d="${d}" stroke="${colorForBand[band]}" stroke-width="6" stroke-linecap="round" opacity=".72"></path>`
      : '';
  }).join('');
  const ticks = [0, 2.5, 5, 7.5, 10].map((tick) => {
    const tx = x(tick);
    const ty = y(tick);
    return `<line x1="${tx}" y1="${top}" x2="${tx}" y2="${top + plotH}" stroke="var(--border)" stroke-width="1"></line>` +
      `<line x1="${left}" y1="${ty}" x2="${left + plotW}" y2="${ty}" stroke="var(--border)" stroke-width="1"></line>` +
      `<text x="${tx}" y="${height - 28}" text-anchor="middle" font-size="11" fill="var(--fg2)">${tick}</text>` +
      `<text x="${left - 10}" y="${ty + 4}" text-anchor="end" font-size="11" fill="var(--fg2)">${tick}</text>`;
  }).join('');
  const meanDrift = pair.report.meanDriftT;
  const fallback = `共通職業 ${pair.report.comparedCount} 件、変化の大きさの平均差 ${formatSigned(meanDrift)}、帯をまたいだ職業 ${pair.report.bandCrossCount} 件。`;

  return {
    svg: `<svg class="models-svg" role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<title id="${titleId}">最新2バッチの前後散布図</title>` +
      `<desc id="${descId}">横軸は${escapeHtml(pair.base.modelDisplay)}の変化の大きさ、縦軸は${escapeHtml(pair.candidate.modelDisplay)}の変化の大きさです。両軸は0〜10固定で、点の色は今回の帯を示します。</desc>` +
      `<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="var(--bg2)"></rect>` +
      ticks +
      `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top}" stroke="var(--fg2)" stroke-width="1.5" stroke-dasharray="5 5"></line>` +
      points +
      `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="var(--fg2)" stroke-width="1.2"></line>` +
      `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="var(--fg2)" stroke-width="1.2"></line>` +
      `<text x="${left + plotW / 2}" y="${height - 8}" text-anchor="middle" font-size="12" fill="var(--fg2)">前回バッチ</text>` +
      `<text x="16" y="${top + plotH / 2}" transform="rotate(-90 16 ${top + plotH / 2})" text-anchor="middle" font-size="12" fill="var(--fg2)">今回バッチ</text>` +
      `<text x="${left + plotW + 26}" y="68" font-size="12" fill="var(--fg)">今回の帯</text>` +
      `<circle cx="${left + plotW + 34}" cy="92" r="5" fill="${colorForBand.low}"></circle><text x="${left + plotW + 48}" y="96" font-size="12" fill="var(--fg2)">低</text>` +
      `<circle cx="${left + plotW + 34}" cy="116" r="5" fill="${colorForBand.mid}"></circle><text x="${left + plotW + 48}" y="120" font-size="12" fill="var(--fg2)">中</text>` +
      `<circle cx="${left + plotW + 34}" cy="140" r="5" fill="${colorForBand.high}"></circle><text x="${left + plotW + 48}" y="144" font-size="12" fill="var(--fg2)">高</text>` +
      `</svg>`,
    fallback,
  };
}

function buildCharts(pair: DriftPairSummary | null): ModelsCharts | null {
  if (!pair) return null;
  const histogram = renderTransformationHistogram(pair);
  const scatter = renderBeforeAfterScatter(pair);
  const inlineHtmlBytes = new TextEncoder().encode(histogram.svg + histogram.fallback + scatter.svg + scatter.fallback).length;
  return { histogram, scatter, inlineHtmlBytes };
}

export function buildModelsPageModel(input: ModelsPageInput): ModelsPageModel {
  const grouped = new Map<BatchKey, ScoreHistoryEntry[]>();
  for (const history of input.historyByOcc.values()) {
    for (const entry of history) {
      const key = batchKey(entry.model, entry.date);
      let bucket = grouped.get(key);
      if (!bucket) {
        bucket = [];
        grouped.set(key, bucket);
      }
      bucket.push(entry);
    }
  }

  const baseSummaries = [...grouped.entries()].map(([key, entries]) => {
    const first = entries[0]!;
    const aioisEntries = entries.filter((entry) => entry.displacement != null && entry.dims != null);
    const dimMeans = aioisEntries.length
      ? input.aioisDimensions.map((_, idx) => mean(aioisEntries.map((entry) => dimsArray(entry)![idx]!)))
      : null;
    return {
      key,
      model: first.model,
      modelDisplay: formatModelDisplay(first.model),
      date: first.date,
      coverage: entries.length,
      total: input.totalOccupations,
      aioisCoverage: aioisEntries.length,
      meanTransformation: mean(entries.map((entry) => entry.transformation)),
      meanDisplacement: aioisEntries.length ? mean(aioisEntries.map((entry) => entry.displacement!)) : null,
      dimMeans,
    } satisfies Omit<BatchSummary, 'isCanonical'>;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model));

  const canonicalKey = chooseCanonical(baseSummaries);
  const batches: BatchSummary[] = baseSummaries.map((batch) => ({
    ...batch,
    isCanonical: batch.key === canonicalKey,
  }));
  const canonical = batches.find((batch) => batch.isCanonical) ?? batches[batches.length - 1];
  if (!canonical) {
    throw new Error('/models requires at least one score batch');
  }

  const aioisBatches = batches.filter((batch) => batch.aioisCoverage > 0);
  const driftPairs: DriftPairSummary[] = [];
  for (let i = 1; i < aioisBatches.length; i += 1) {
    const base = aioisBatches[i - 1]!;
    const candidate = aioisBatches[i]!;
    const baseScores = toAioisScoreMap(input.historyByOcc, base.key);
    const candidateScores = toAioisScoreMap(input.historyByOcc, candidate.key);
    const commonCount = [...candidateScores.keys()].filter((id) => baseScores.has(id)).length;
    const report = computeDriftReport(baseScores, candidateScores, input.titlesByOcc, {
      rankThreshold: commonCount >= 100 ? 50 : 10,
      lowConfidence: 0.7,
    });
    driftPairs.push({
      key: `${base.key}__${candidate.key}`,
      base,
      candidate,
      report,
      dimensionRows: [],
      tendencyNotes: [],
    });
    const added = driftPairs[driftPairs.length - 1]!;
    const dimensionRows = buildDimensionDriftRows(added, baseScores, candidateScores, input.aioisDimensions);
    driftPairs[driftPairs.length - 1] = {
      ...added,
      dimensionRows,
      tendencyNotes: buildTendencyNotes(dimensionRows, base.modelDisplay, candidate.modelDisplay),
    };
  }

  const latestPair = driftPairs[driftPairs.length - 1] ?? null;
  const largestDivergences = latestPair
    ? [...latestPair.report.rows]
      .sort((a, b) => Math.abs(b.dT) - Math.abs(a.dT) || a.id - b.id)
      .slice(0, 20)
    : [];

  return {
    batches,
    canonical,
    driftPairs,
    largestDivergences,
    latestPair,
    charts: buildCharts(latestPair),
  };
}

export function buildModelsPageModelFromGraph(
  graph: KnowledgeGraph,
  totalOccupations: number,
  aioisDimensions: readonly AioisDimensionMeta[],
): ModelsPageModel {
  const historyByOcc = new Map<number, readonly ScoreHistoryEntry[]>();
  const titlesByOcc = new Map<number, string>();
  for (const [id, occupation] of graph.occupations) {
    titlesByOcc.set(Number(id), occupation.titleJa);
    const history = graph.scoreHistoryByOcc.get(id);
    if (history) historyByOcc.set(Number(id), history);
  }
  return buildModelsPageModel({ historyByOcc, titlesByOcc, totalOccupations, aioisDimensions });
}

export function formatSigned(n: number, digits = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
}

export function formatFixed(n: number | null, digits = 2): string {
  return n == null ? '—' : n.toFixed(digits);
}
