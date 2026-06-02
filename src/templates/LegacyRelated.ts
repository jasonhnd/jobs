/**
 * src/templates/LegacyRelated.ts — legacy fallback "類似する職業"
 * section, used only when the Transfer block doesn't render.
 *
 * Extracted from src/pages/[id].astro. The Transfer template
 * is the preferred "related occupations" surface (with similarity
 * scores + AI risk chips); this template is the fallback for the
 * ~50 occupations whose transfer_paths.json entry is empty.
 *
 * Layout:
 *   <section class="related" aria-label="類似する職業">
 *     <h2>類似する職業</h2>
 *     <ul>
 *       <li><a class="r-name" href="/{id}">{name}</a>
 *           <span class="r-risk">AI 影響 {N/10|—}</span></li>
 *       …
 *     </ul>
 *   </section>
 *
 * Empty `related` array OR `suppress` flag set → empty SafeHtml
 * (no `<section>` shipped). The suppress flag lets the page-side
 * adapter pass the Transfer block's presence in: "if Transfer
 * rendered something, suppress LegacyRelated."
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** One related-occupation row. */
export interface LegacyRelatedItem {
  readonly id: number;
  readonly nameJa: string;
  readonly aiRisk: number | null;
}

export interface LegacyRelatedInput {
  readonly related: ReadonlyArray<LegacyRelatedItem>;
  /** When true, the template returns empty — used when a richer
   *  Transfer block is already covering the related-jobs surface. */
  readonly suppress: boolean;
}

const H2 = '類似する職業';
const REL_PATH = '/';

export function renderLegacyRelated(input: LegacyRelatedInput): SafeHtml {
  if (input.suppress || input.related.length === 0) return '' as SafeHtml;

  let items = '';
  for (const r of input.related) {
    const name = r.nameJa || `#${r.id}`;
    const riskStr = r.aiRisk !== null ? `${r.aiRisk}/10` : '—';
    items +=
      `<li>` +
      `<a class="r-name" href="${REL_PATH}${r.id}">${escapeHtml(name)}</a>` +
      `<span class="r-risk">AI 影響 ${escapeHtml(riskStr)}</span>` +
      `</li>`;
    items += '\n          ';
  }
  // Strip trailing joiner whitespace so the closing </ul> sits on
  // its own line with the legacy indentation.
  items = items.replace(/\n {10}$/, '');

  return (
    `<section class="related" aria-label="${escapeHtml(H2)}">\n` +
    `        <h2>${escapeHtml(H2)}</h2>\n` +
    `        <ul>\n` +
    `          ${items}\n` +
    `        </ul>\n` +
    `      </section>`
  ) as SafeHtml;
}
