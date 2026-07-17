/**
 * src/views/escape-routes.ts — RA-136 (Sprint 4.2)
 *
 * "Escape route" suggestion: given a high-AI-risk job, surface a handful
 * of low-risk jobs the user could plausibly migrate toward. Used at the
 * bottom of:
 *   - /rankings/<high-risk slug> (uses TOP 1 as source)
 *   - /compare/<pair> when both sides are AI-impact ≥ 7
 *
 * Pure data + HTML string assembly (no DOM, no I/O). Caller passes the
 * full Occupation[] (typically loadOccupationsFromGraph(graph)).
 */
import type { Occupation } from './ranking/config.js';
import { occupationPath } from '../lib/urls.js';

/**
 * AI 影響度 threshold for "safe" jobs surfaced as escape routes.
 * Used by both the candidate filter and the rendered lede so a future
 * tuning change only needs to update this single value.
 */
const SAFE_AI_RISK_THRESHOLD = 4;

/**
 * Minimal shape we need from the "source" job. Lets callers pass either
 * an Occupation (rankings detail page) or a CompareSide-shaped object
 * (compare detail page) without needing a full Occupation construction.
 */
export interface EscapeRouteSource {
  id: number;
  ai_risk: number | null;
  sector_id: string | null;
}

export interface EscapeRouteCandidate {
  /** Occupation numeric id — used to build /<id> link. */
  id: number;
  nameJa: string;
  /** AI 影響度 0-10 (always ≤ SAFE_AI_RISK_THRESHOLD by construction). */
  aiRisk: number;
  sectorJa: string;
  /** Short reason string for the card (Japanese). */
  reason: string;
}

/**
 * Suggest up to `topN` low-AI-risk jobs the user could plausibly migrate
 * to from `fromJob`.
 *
 * Scoring:
 *   sameSector * 2 + (10 - |risk_diff|) + workersScore
 *   where workersScore = min(5, workers / 100_000)
 *
 * Filter: ai_risk ≤ 4, excludes the source job itself, skips rows with
 * missing ai_risk (we can't score them as "safe").
 */
export function suggestEscapeRoutes(
  fromJob: EscapeRouteSource,
  allJobs: ReadonlyArray<Occupation>,
  topN = 6,
): EscapeRouteCandidate[] {
  const fromRisk = fromJob.ai_risk ?? 10;
  const scored = allJobs
    .filter((j) => j.id !== fromJob.id && j.ai_risk !== null && j.ai_risk <= SAFE_AI_RISK_THRESHOLD)
    .map((j) => {
      const risk = j.ai_risk as number;
      const sameSector = j.sector_id === fromJob.sector_id ? 1 : 0;
      const riskDiff = Math.abs(risk - fromRisk);
      const workersScore = Math.min(5, (j.workers ?? 0) / 100_000);
      const score = sameSector * 2 + (10 - riskDiff) + workersScore;
      const reason = sameSector
        ? '同セクター'
        : risk <= 3
          ? 'AI 影響度が低い職業'
          : '関連分野';
      return {
        id: j.id,
        nameJa: j.title_ja ?? `#${j.id}`,
        aiRisk: risk,
        sectorJa: j.sector_ja ?? '',
        reason,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return scored.map(({ score: _score, ...rest }) => rest);
}

/**
 * Render the escape-routes <section> HTML. Returns '' when there are no
 * candidates so the caller can blindly inject the string.
 */
export function renderEscapeRouteSection(
  fromJobName: string,
  candidates: ReadonlyArray<EscapeRouteCandidate>,
): string {
  if (candidates.length === 0) return '';
  const cards = candidates
    .map(
      (c) =>
        `<li class="escape-card">` +
        `<a href="${occupationPath(c.id)}">` +
        `<span class="ec-name">${escapeHtml(c.nameJa)}</span>` +
        `<span class="ec-meta">` +
        `<span class="risk-pill low">AI ${c.aiRisk}/10</span>` +
        (c.sectorJa
          ? `<span class="ec-sector">${escapeHtml(c.sectorJa)}</span>`
          : '') +
        `</span>` +
        `<span class="ec-reason">${escapeHtml(c.reason)}</span>` +
        `</a>` +
        `</li>`,
    )
    .join('');
  return (
    `<section class="escape-routes" aria-labelledby="escape-h2">` +
    `<h2 id="escape-h2">この職業から AI 影響度の低い領域へ</h2>` +
    `<p class="escape-lede">「${escapeHtml(fromJobName)}」の現状に不安を感じているなら、ここから移れる可能性のある AI 影響度 ${SAFE_AI_RISK_THRESHOLD} 以下の職業：</p>` +
    `<ul class="escape-cards">${cards}</ul>` +
    `</section>`
  );
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] ?? c,
  );
}
