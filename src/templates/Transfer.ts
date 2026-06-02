/**
 * src/templates/Transfer.ts — "similar jobs / career-transfer
 * candidates" card grid for the occupation detail page.
 *
 * Extracted from src/pages/[id].astro (`renderTransfer`).
 * Renders `<section class="transfer">` containing a grid of
 * `<a class="transfer-card">` links, each showing the candidate's
 * Japanese name, AI-risk score, and (optional) similarity %.
 *
 * Empty array → empty SafeHtml (no `<section>` shipped). Callers are
 * responsible for slicing to TOP_N before handing data in; the
 * template renders every candidate it receives.
 *
 * Name resolution (nameLookup ?? title_ja ?? '?') lives in the page
 * adapter, not here — keeps the template input flat and the fallback
 * policy at the page boundary where the lookup map is already built.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** One candidate row. `name` is pre-resolved by the caller. */
export interface TransferCard {
  /** Occupation id used to build the `/{id}` href. */
  readonly id: number;
  /** Display name in Japanese. Caller falls back to '?' upstream. */
  readonly name: string;
  /** Integer 0-10 score; null renders as em-dash. */
  readonly aiRisk: number | null | undefined;
  /** 0-1 cosine similarity; null/undefined omits the similarity chip. */
  readonly similarity: number | null | undefined;
}

const H2 = '似た仕事 / キャリア転換の候補';

export function renderTransfer(cards: ReadonlyArray<TransferCard>): SafeHtml {
  if (cards.length === 0) return '' as SafeHtml;

  let cardsHtml = '';
  for (const c of cards) {
    const href = `/${c.id}`;
    const riskStr = c.aiRisk !== null && c.aiRisk !== undefined ? `${c.aiRisk}/10` : '—';
    const riskLabel = `AI 影響 ${riskStr}`;
    const simLabel =
      c.similarity !== null && c.similarity !== undefined
        ? `類似度 ${Math.round(c.similarity * 100)}%`
        : '';
    const simHtml = simLabel
      ? `<span class="tc-similarity">${escapeHtml(simLabel)}</span>`
      : '';
    cardsHtml +=
      `<a class="transfer-card" href="${href}">` +
      `<span class="tc-name">${escapeHtml(c.name)}</span>` +
      `<span class="tc-meta">` +
      `<span class="tc-risk">${escapeHtml(riskLabel)}</span>` +
      `${simHtml}` +
      `</span>` +
      `</a>`;
  }

  return (
    `<section class="transfer" aria-label="${escapeHtml(H2)}">` +
    `<h2>${escapeHtml(H2)}</h2>` +
    `<div class="transfer-grid">${cardsHtml}</div>` +
    `</section>`
  ) as SafeHtml;
}
