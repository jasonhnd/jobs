/**
 * src/templates/AiRiskDetail.ts — long-form AI risk rationale block.
 *
 * Extracted from src/pages/ja/[id].astro (`renderAiRiskDetail`). Renders
 * the "Why AI risk N" section that appears below the metric row on an
 * occupation detail page when the long-form rationale + task breakdown
 * is available.
 *
 * Layout:
 *   <section class="ai-risk-detail">
 *     <h2>なぜ AI 影響度 N/10 か</h2>
 *     <p class="ai-rationale-long">{long text}</p>
 *     <div class="ai-task-grid">
 *       <div class="ai-task-block">
 *         <h3>AI に置き換わりやすい業務</h3>
 *         <ul>{displaceable items}</ul>
 *       </div>
 *       <div class="ai-task-block">
 *         <h3>人が残る業務</h3>
 *         <ul>{resilient items}</ul>
 *       </div>
 *     </div>
 *     [optional]
 *     <p class="ai-horizon"><strong>5-10 年展望:</strong> {horizon}</p>
 *   </section>
 *
 * Returns empty SafeHtml when `rationaleLongJa` is missing — the rest
 * of the block doesn't render in isolation. Today's projection emits
 * null for these enrichment fields on all 556 occupations, so the
 * block is empty in production; the template is wired so future
 * rationale runs flow straight in without touching the page.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

export interface AiRiskDetailInput {
  /** Integer 0-10 score; displayed as "N/10" in the headline. Null
   *  renders as em-dash; doesn't gate the block. */
  readonly aiRisk: number | null;
  /** Long-form Japanese rationale. Absence (null/empty) gates the
   *  entire block — the rest of the fields don't render alone. */
  readonly rationaleLongJa: string | null;
  /** Tasks AI is likely to replace. Empty array → empty <ul>. */
  readonly displaceableTasksJa: readonly string[];
  /** Tasks that remain human-led. Empty array → empty <ul>. */
  readonly resilientTasksJa: readonly string[];
  /** 5-10 year outlook paragraph. Absence omits the trailing <p>. */
  readonly horizon5yJa: string | null;
}

export function renderAiRiskDetail(input: AiRiskDetailInput): SafeHtml {
  const { aiRisk, rationaleLongJa, displaceableTasksJa, resilientTasksJa, horizon5yJa } = input;
  if (!rationaleLongJa) return '' as SafeHtml;

  const scoreDisp = aiRisk !== null ? `${aiRisk}/10` : '—';
  let dispLis = '';
  for (const t of displaceableTasksJa) dispLis += `<li>${escapeHtml(t)}</li>`;
  let resiLis = '';
  for (const t of resilientTasksJa) resiLis += `<li>${escapeHtml(t)}</li>`;
  const horizonHtml = horizon5yJa
    ? `<p class="ai-horizon"><strong>5-10 年展望:</strong> ${escapeHtml(horizon5yJa)}</p>`
    : '';

  return (`<section class="ai-risk-detail" aria-labelledby="ai-risk-detail-h2">
        <h2 id="ai-risk-detail-h2">なぜ AI 影響度 ${escapeHtml(scoreDisp)} か</h2>
        <p class="ai-rationale-long">${escapeHtml(rationaleLongJa)}</p>
        <div class="ai-task-grid">
          <div class="ai-task-block">
            <h3>AI に置き換わりやすい業務</h3>
            <ul>${dispLis}</ul>
          </div>
          <div class="ai-task-block">
            <h3>人が残る業務</h3>
            <ul>${resiLis}</ul>
          </div>
        </div>
        ${horizonHtml}
      </section>`) as SafeHtml;
}
