/**
 * src/templates/ScoreHistoryComparison.ts — per-occupation multi-model
 * score history table for the detail page.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { formatModelDisplay, modelSlug } from '../site/score-attribution.js';

export interface ScoreHistoryComparisonEntry {
  readonly model: string;
  readonly date: string;
  readonly transformation: number;
  readonly displacement: number | null;
  readonly dims: Record<string, number> | null;
}

const H2 = 'AI 影響スコアの履歴';

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '±0';
  const body = formatScore(Math.abs(rounded));
  return rounded > 0 ? `+${body}` : `-${body}`;
}

function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

function isCurrentEntry(
  entry: ScoreHistoryComparisonEntry,
  current: ScoreHistoryComparisonEntry,
): boolean {
  return entry.date === current.date && entry.model === current.model;
}

function modelHref(entry: ScoreHistoryComparisonEntry): string {
  return `/models/${modelSlug(entry.model)}`;
}

function pickCurrentHistoryEntry(
  history: ReadonlyArray<ScoreHistoryComparisonEntry>,
): ScoreHistoryComparisonEntry {
  let chosen = history[0]!;
  for (let i = 1; i < history.length; i += 1) {
    const entry = history[i]!;
    if (entry.date > chosen.date) {
      chosen = entry;
    } else if (entry.date === chosen.date) {
      const entryIsAiois = entry.dims != null;
      const chosenIsAiois = chosen.dims != null;
      if (entryIsAiois || !chosenIsAiois) {
        chosen = entry;
      }
    }
  }
  return chosen;
}

export function renderScoreHistoryComparison(
  history: ReadonlyArray<ScoreHistoryComparisonEntry>,
): SafeHtml {
  if (history.length === 0) return '' as SafeHtml;

  const current = pickCurrentHistoryEntry(history);
  const currentScore = current.transformation;
  const sorted = [...history].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.model.localeCompare(b.model);
  });
  const older = sorted.filter((entry) => !isCurrentEntry(entry, current));

  let rows = '';
  for (const entry of older) {
    rows +=
      `<tr>` +
      `<td class="sh-model"><a href="${escapeHtml(modelHref(entry))}">${escapeHtml(formatModelDisplay(entry.model))}</a></td>` +
      `<td>${escapeHtml(formatDate(entry.date))}</td>` +
      `<td class="sh-num">${escapeHtml(formatScore(entry.transformation))}<span>/10</span></td>` +
      `<td class="sh-delta">${escapeHtml(formatDelta(entry.transformation - currentScore))}</td>` +
      `</tr>`;
  }
  const details = older.length > 0
    ? (
      `<details class="score-history-details">` +
      `<summary>過去のモデル履歴 ${older.length}件</summary>` +
      `<div class="score-history-table-wrap" tabindex="0" aria-label="過去のスコア履歴の表を横にスクロール">` +
      `<table class="score-history-table">` +
      `<thead><tr><th scope="col">モデル</th><th scope="col">採点日</th><th scope="col">変化の大きさ</th><th scope="col">現行との差</th></tr></thead>` +
      `<tbody>${rows}</tbody>` +
      `</table>` +
      `</div>` +
      `</details>`
    )
    : '';

  return (
    `<section class="score-history" aria-labelledby="score-history-h2">` +
    `<h2 id="score-history-h2">${escapeHtml(H2)}</h2>` +
    `<p class="score-history-note">AI 影響スコアは、異なるAIモデルが異なる日付で同じ基準にもとづき評価した結果です。` +
    `<a href="/models">モデル比較を見る</a></p>` +
    `<div class="score-history-current" aria-label="現行スコア">` +
    `<div>` +
    `<span class="score-history-current-label">現行スコア</span>` +
    `<a class="score-history-current-model" href="${escapeHtml(modelHref(current))}">${escapeHtml(formatModelDisplay(current.model))}</a>` +
    `<span class="score-history-current-date">${escapeHtml(formatDate(current.date))}</span>` +
    `</div>` +
    `<strong>${escapeHtml(formatScore(current.transformation))}<span>/10</span></strong>` +
    `</div>` +
    details +
    `</section>`
  ) as SafeHtml;
}
