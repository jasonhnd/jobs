/**
 * src/lib/format-paragraphs.ts — turn newline-separated Japanese
 * prose into a series of escaped `<p>…</p>` blocks.
 *
 * Extracted from src/pages/ja/[id].astro (`formatParagraphs`). Three
 * call-sites today (ctx / longHow / longCond paragraphs); the
 * function is generic enough that any text-to-paragraphs surface
 * can pull from here.
 *
 * Algorithm:
 *   1. Normalize `\n　` (full-width space at line start) → `\n\n`
 *      so MHLW jobtag prose that uses full-width indents converts
 *      to proper paragraph breaks.
 *   2. Normalize CRLF → LF.
 *   3. Split on blank-line runs (`/\n\s*\n+/`).
 *   4. Trim each chunk; drop empty ones.
 *   5. Wrap each chunk in `<p>…</p>` with HTML escaping.
 *
 * Empty / null input → empty SafeHtml.
 *
 * The legacy [id].astro implementation joined chunks with
 * `'\n        '` (newline + 8 spaces) so the rendered HTML
 * was indented to match the surrounding template literal block.
 * Preserved verbatim for byte-equivalent SEO baseline.
 */

import { escapeHtml, type SafeHtml } from './safe-html.js';

/** Joiner used between `<p>` blocks. 8 spaces of indent matches
 *  the page's template-literal indentation; pinned by SEO baseline. */
const PARAGRAPH_JOINER = '\n        ';

export function formatParagraphs(text: string | null | undefined): SafeHtml {
  if (!text) return '' as SafeHtml;
  const normalized = text.replace(/\n　/g, '\n\n').replace(/\r\n/g, '\n');
  const chunks = normalized
    .split(/\n\s*\n+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    return (`<p>${escapeHtml(text.trim())}</p>`) as SafeHtml;
  }
  return chunks.map((c) => `<p>${escapeHtml(c)}</p>`).join(PARAGRAPH_JOINER) as SafeHtml;
}
