/**
 * src/templates/ScoreHistoryComparison.ts — per-occupation multi-model
 * score history comparison for the detail page.
 *
 * The highlighted card is the consensus value (C-facing, no model name).
 * Individual votes — with model names and dates — live in the fold
 * (決定 7 の深層).
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { formatModelDisplay, runSlug } from '../site/score-attribution.js';
import {
  CONSENSUS_AGING_NOTE,
  CONSENSUS_HEADLINE_LABEL,
  SCORE_HISTORY_DETAILS_ID,
  formatConsensusScore,
} from '../site/consensus-copy.js';

export interface ScoreHistoryComparisonEntry {
  readonly model: string;
  readonly date: string;
  readonly transformation: number;
  readonly displacement: number | null;
  readonly dims: Record<string, number> | null;
}

export interface ScoreHistoryComparisonOptions {
  readonly consensusTransformation: number;
  readonly voteCount: number;
  readonly latestRunDate: string;
  readonly usedExpiredVotes: boolean;
}

const H2 = 'モデル比較';

function formatScore(value: number): string {
  return formatConsensusScore(value);
}

function formatDelta(value: number): string {
  const rounded = formatConsensusScore(Math.abs(value));
  if (rounded === '0') return '±0';
  return value > 0 ? `+${rounded}` : `-${rounded}`;
}

function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

function modelHref(entry: ScoreHistoryComparisonEntry): string {
  return `/models/${runSlug({ model: entry.model, runDate: entry.date })}`;
}

export function renderScoreHistoryComparison(
  history: ReadonlyArray<ScoreHistoryComparisonEntry>,
  options: ScoreHistoryComparisonOptions,
): SafeHtml {
  if (history.length === 0) return '' as SafeHtml;

  const sorted = [...history].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.model.localeCompare(b.model);
  });

  let items = '';
  for (const entry of sorted) {
    // A batch with no `dims` predates AIOIS-10: its number is a single-axis
    // `ai_risk`, not a `transformation = mean(d1,d2)`. Labelling it 変化指数 and
    // subtracting it from the consensus AIOIS score was arithmetic across two
    // incompatible standards (issue #216). Keep the row visible as history,
    // but drop the delta.
    const isLegacy = entry.dims == null;
    const scoreRow = isLegacy
      ? `<div><dt>旧方式スコア</dt><dd class="sh-num">${escapeHtml(formatScore(entry.transformation))}<span>/10</span></dd></div>` +
        `<div><dt>総合との差</dt><dd>AIOIS-10 導入前のため比較対象外</dd></div>`
      : `<div><dt>変化指数</dt><dd class="sh-num">${escapeHtml(formatScore(entry.transformation))}<span>/10</span></dd></div>` +
        `<div><dt>総合との差</dt><dd class="sh-delta">${escapeHtml(formatDelta(entry.transformation - options.consensusTransformation))}</dd></div>`;
    items +=
      `<li class="score-history-item">` +
      `<div class="score-history-item-model">` +
      `<span>モデル</span>` +
      `<a href="${escapeHtml(modelHref(entry))}">${escapeHtml(formatModelDisplay(entry.model))}</a>` +
      `</div>` +
      `<dl class="score-history-item-facts">` +
      `<div><dt>採点日</dt><dd>${escapeHtml(formatDate(entry.date))}</dd></div>` +
      scoreRow +
      `</dl>` +
      `</li>`;
  }

  const aging = options.usedExpiredVotes
    ? `<p class="score-history-aging">${escapeHtml(CONSENSUS_AGING_NOTE)}</p>`
    : '';

  const details =
    `<details class="score-history-details" id="${SCORE_HISTORY_DETAILS_ID}">` +
    `<summary>モデル別の票を表示（${sorted.length}件）</summary>` +
    aging +
    `<ol class="score-history-list">${items}</ol>` +
    `</details>`;

  const hasLegacy = history.some((entry) => entry.dims == null);
  const note = hasLegacy
    ? 'AI 影響スコアは、異なるAIモデルが異なる日付で評価した結果です。AIOIS-10 導入前の旧方式スコアは基準が異なるため、総合値とは比較できません。'
    : 'AI 影響スコアは、異なるAIモデルが異なる日付で同じ基準にもとづき評価した結果です。';

  return (
    `<section class="score-history" aria-labelledby="score-history-h2">` +
    `<h2 id="score-history-h2">${escapeHtml(H2)}</h2>` +
    `<p class="score-history-note">${escapeHtml(note)}` +
    `<a href="/models">全モデルを見る</a></p>` +
    `<div class="score-history-current" aria-label="${escapeHtml(CONSENSUS_HEADLINE_LABEL)}">` +
    `<div>` +
    `<span class="score-history-current-label">${escapeHtml(CONSENSUS_HEADLINE_LABEL)}</span>` +
    `<span class="score-history-current-date">${options.voteCount}票 · 最新採点 ${escapeHtml(formatDate(options.latestRunDate))}</span>` +
    `</div>` +
    `<strong>${escapeHtml(formatScore(options.consensusTransformation))}<span>/10</span></strong>` +
    `</div>` +
    details +
    `</section>`
  ) as SafeHtml;
}
