/**
 * src/templates/OccFaq.ts — variant FAQ template for the occupation
 * detail page (`/{id}`).
 *
 * Why a second FAQ template instead of reusing src/templates/FaqSection?
 * Two FAQ surfaces ship distinct DOM today:
 *
 *  1. FaqSection (genre-hub / interests / skills-hub / compare-hub /
 *     rankings hubs) renders bare `<details>` items as direct children
 *     of `<section>`, with the answer wrapped in `<div class="faq-a">`.
 *
 *  2. OccFaq (this template, and [sector].astro until it migrates)
 *     renders `<details class="faq-item">` items inside a wrapping
 *     `<div class="faq-list">`, with the answer wrapped in
 *     `<div class="faq-answer">`.
 *
 * Variant 1 and 2 also drive different CSS rulesets on the live site.
 * Unifying the DOM is a future styling concern — for now the two
 * variants stay separate so the migration can ship byte-for-byte
 * baseline-equivalent.
 *
 * Extracted from src/pages/[id].astro (`renderOccFaq`).
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** Question/answer tuple — same shape as FaqSection.FaqItem but kept
 *  local to avoid cross-template coupling. Convergence is a future
 *  styling decision, not a typing decision today. */
export type OccFaqItem = readonly [question: string, answer: string];

export function renderOccFaq(faqItems: ReadonlyArray<OccFaqItem>): SafeHtml {
  if (faqItems.length === 0) return '' as SafeHtml;

  let items = '';
  for (const [q, a] of faqItems) {
    const className = q.includes('AIでなくなる') ? 'faq-item faq-ai-replacement' : 'faq-item';
    items +=
      `<details class="${className}"><summary>${escapeHtml(q)}</summary>` +
      `<div class="faq-answer">${escapeHtml(a)}</div></details>`;
  }

  return (
    `<section class="faq" aria-label="よくある質問">` +
    `<h2>よくある質問</h2>` +
    `<div class="faq-list">${items}</div>` +
    `</section>`
  ) as SafeHtml;
}
