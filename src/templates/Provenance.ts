/**
 * src/templates/Provenance.ts — data-provenance footer line.
 *
 * Extracted from src/pages/[id].astro (`renderProvenance`) as the
 * first piece of page-inline rendering pulled into Layer 4.
 *
 * Output: a single `<p class="provenance">…</p>` line joining up to
 * two bullet fragments with a center dot. Renders empty SafeHtml when
 * neither AI-scoring metadata nor IPD-version metadata is present.
 *
 * Input type is a NARROW record (not the page-local Rec) so the
 * template doesn't pin itself to a single caller — future surfaces
 * (compare, ranking, etc.) that want a provenance line can compose
 * the same `<p>` without depending on the [id]-page shape.
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

export interface ProvenanceInput {
  /** Model identifier shown in the AI-risk bullet (e.g. "claude-opus-4-7"). */
  readonly aiModel: string | null;
  /** ISO date or timestamp string of the AI-risk score capture. Only the
   *  first 10 chars (YYYY-MM-DD) are rendered. */
  readonly aiScoredAt: string | null;
  /** IPD numeric-data version label shown in the data-source bullet. */
  readonly ipdNumeric: string | null;
  /** IPD description-data version label. Used as fallback when ipdNumeric
   *  is missing (legacy callers that only carried one of the two). */
  readonly ipdDescription: string | null;
}

export function renderProvenance(input: ProvenanceInput): SafeHtml {
  const bits: string[] = [];

  if (input.aiModel && input.aiScoredAt) {
    bits.push(
      `AI 影響度 — モデル <code>${escapeHtml(input.aiModel)}</code> · ` +
      `スコア取得 <code>${escapeHtml(input.aiScoredAt.slice(0, 10))}</code>`,
    );
  }

  const ipdVersion = input.ipdNumeric ?? input.ipdDescription;
  if (ipdVersion) {
    bits.push(`データ — 厚労省 / JILPT IPD <code>${escapeHtml(ipdVersion)}</code>`);
  }

  if (bits.length === 0) return '' as SafeHtml;
  return (`<p class="provenance">${bits.join(' · ')}</p>`) as SafeHtml;
}
