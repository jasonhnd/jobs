/**
 * src/templates/OrgsCerts.ts — related orgs + certs paired block.
 *
 * Extracted from src/pages/ja/[id].astro (`renderOrgsCerts`). Renders
 * two parallel sub-blocks side-by-side:
 *
 *   - 関連業界団体: a list of external organisation links
 *   - 関連資格: a flat list of certification names
 *
 * Either block can be empty independently. When BOTH are empty the
 * template returns empty SafeHtml so the surrounding `<section>` is
 * never shipped with no content.
 *
 * Narrow input rather than the page-local Rec — keeps the template
 * pinning loose so other surfaces (e.g. a future profession-comparison
 * card) can render the same block.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

export interface OrgEntry {
  /** Japanese display name. Falsy values cause the entry to be dropped. */
  readonly nameJa: string | null;
  /** External URL. `null` collapses to `#` (a no-op anchor) — matches legacy. */
  readonly url: string | null;
}

export interface OrgsCertsInput {
  /** Industry associations / related orgs. Each opens in a new tab. */
  readonly orgs: readonly OrgEntry[];
  /** Certification names — rendered as plain `<li>` items, no link. */
  readonly certs: readonly string[];
}

export function renderOrgsCerts(input: OrgsCertsInput): SafeHtml {
  const { orgs, certs } = input;
  // Legacy semantics: the outer <section> is shipped IFF either of the
  // arrays is non-empty AT INPUT. Entries are then filtered (orgs with
  // null nameJa drop out), which can leave an empty <ul> inside one of
  // the blocks — preserved for byte-equivalence with the previous
  // [id].astro `renderOrgsCerts`.
  if (orgs.length === 0 && certs.length === 0) return '' as SafeHtml;

  let orgBlock = '';
  if (orgs.length > 0) {
    let items = '';
    for (const o of orgs) {
      if (!o.nameJa) continue;
      items +=
        `<li><a href="${escapeHtml(o.url ?? '#')}" rel="external noopener noreferrer" target="_blank">` +
        `${escapeHtml(o.nameJa)}` +
        `</a></li>`;
    }
    orgBlock = `<div class="org-cert-block"><h3>関連業界団体</h3><ul class="org-list">${items}</ul></div>`;
  }

  let certBlock = '';
  if (certs.length > 0) {
    let items = '';
    for (const c of certs) {
      items += `<li>${escapeHtml(c)}</li>`;
    }
    certBlock = `<div class="org-cert-block"><h3>関連資格</h3><ul class="cert-list">${items}</ul></div>`;
  }

  return (`<section class="orgs-certs"><div class="org-cert-grid">${orgBlock}${certBlock}</div></section>`) as SafeHtml;
}
