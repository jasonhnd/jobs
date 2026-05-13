/**
 * src/templates/ProseSection.ts — render a generic prose section
 * (h2 + paragraphs) gated on the body text being non-empty.
 *
 * Extracted from src/pages/ja/[id].astro. Two call-sites today
 * (how-to-become / working-conditions). The body is run through
 * formatParagraphs so blank-line-separated text becomes a series
 * of `<p>…</p>` blocks.
 *
 * Empty bodyText → empty SafeHtml (no `<section>` shipped).
 *
 * Layout:
 *   <section class="{sectionClass}" aria-label="{h2}">
 *     <h2>{h2}</h2>
 *     {formattedParagraphs}
 *   </section>
 *
 * Indentation matches the legacy template-literal output so the
 * SEO baseline byte-compares clean — `<section>` and `<h2>` start
 * on the same column the page used to emit, and the paragraphs
 * carry the 8-space joiner from formatParagraphs.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { formatParagraphs } from '../lib/format-paragraphs.js';

export interface ProseSectionInput {
  /** Section heading (rendered inside <h2>). */
  readonly h2: string;
  /** CSS class for the <section> wrapper, e.g. "how-to-become". */
  readonly sectionClass: string;
  /** Multi-line body text. Empty/null → empty SafeHtml. */
  readonly bodyText: string | null | undefined;
}

export function renderProseSection(input: ProseSectionInput): SafeHtml {
  const { h2, sectionClass, bodyText } = input;
  if (!bodyText) return '' as SafeHtml;

  // formatParagraphs returns SafeHtml; direct string concat is safe
  // because every interpolated value is already escaped (h2 via
  // escapeHtml call, sectionClass + bodyText controlled by the
  // template literal).
  return (
    `<section class="${escapeHtml(sectionClass)}" aria-label="${escapeHtml(h2)}">\n` +
    `        <h2>${escapeHtml(h2)}</h2>\n` +
    `        ${formatParagraphs(bodyText)}\n` +
    `      </section>`
  ) as SafeHtml;
}
