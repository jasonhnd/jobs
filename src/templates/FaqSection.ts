/**
 * src/templates/FaqSection.ts — first shared Layer 4 template.
 *
 * Replaces 5 identical `renderFaqHtml` copies under src/data/lib/
 * (compare-hub, genre-hub, interests, ranking-renderers, skills-hub).
 * All five produced byte-equivalent HTML strings; this is the single
 * source of truth they now re-export.
 *
 * Output: `<section class="faq">` with `<details>/<summary>/<div class="faq-a">`
 * triples for each Q/A pair. JSON-LD FAQPage entities on the consumer
 * pages reference the same Q/A pairs separately — keep this template
 * focused on visible markup.
 *
 * Note: src/pages/sectors/[sector].astro intentionally renders a
 * DIFFERENT FAQ DOM (`<details class="faq-item">` + `<div class="faq-list">`
 * wrapper + class="faq-answer"). It stays separate until sector page
 * extraction in a later step.
 *
 * Uses the central html`` tag from src/lib/safe-html so the typed
 * SafeHtml flows through to the `<Fragment set:html>` boundary.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

export type FaqItem = readonly [question: string, answer: string];

/**
 * Render a FAQ section from a list of Q/A pairs. Returns empty SafeHtml
 * when the list is empty (no empty `<section>` shipped).
 *
 * Both q and a are escaped with the 5-char HTML map; downstream
 * consumers can pipe the result into `<Fragment set:html={result}>`
 * with the TypeScript brand verifying that they're feeding a typed
 * SafeHtml value, not a raw concat.
 *
 * Implementation note — direct string concat rather than wrapping the
 * outer `<section>` in `html\`...\``: the html`` tag re-escapes every
 * interpolated string (TS brand is type-only at runtime), which would
 * turn the assembled <details>...</details> into visible markup-as-
 * text. The `escapeHtml` calls below already make q + a safe; the
 * surrounding tags are static literals authored in this file.
 */
export function renderFaqSection(faqItems: ReadonlyArray<FaqItem>): SafeHtml {
  if (faqItems.length === 0) return '' as SafeHtml;

  let details = '';
  for (const [q, a] of faqItems) {
    details +=
      `<details><summary>${escapeHtml(q)}</summary>` +
      `<div class="faq-a">${escapeHtml(a)}</div></details>`;
  }

  return (
    `<section class="faq" aria-label="よくある質問">` +
    `<h2>よくある質問</h2>` +
    `${details}` +
    `</section>`
  ) as SafeHtml;
}
