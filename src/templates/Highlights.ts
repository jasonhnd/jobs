/**
 * src/templates/Highlights.ts — shared "key highlights" bullet list.
 *
 * Replaces 3 identical `renderHighlights` copies under src/data/lib/
 * (genre-hub, interests, skills-hub). All produced byte-equivalent
 * markup; this is the single source of truth they now re-export.
 *
 * Layout: `<div class="highlights"><ul><li>…</li>…</ul></div>`
 *
 * Defense-in-depth: highlight strings interpolate data-driven values
 * (top occupation names, dominant sector text, config copy). The
 * 5-char escape pass guarantees the XSS contract regardless of
 * upstream changes — see the test fixtures for the regression cases.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

export function renderHighlights(items: ReadonlyArray<string>): SafeHtml {
  if (items.length === 0) return '' as SafeHtml;
  let lis = '';
  for (const h of items) {
    lis += `<li>${escapeHtml(h)}</li>`;
  }
  return (`<div class="highlights"><ul>${lis}</ul></div>`) as SafeHtml;
}
