/**
 * src/templates/MetaRow.ts — sector chip + risk/workforce/demand
 * band chips row, rendered directly under the page title on the
 * occupation detail page.
 *
 * Extracted from src/pages/[id].astro (`renderMetaRow` plus its
 * `bandLabel` / `bandClass` helpers). The whole row is one
 * `<div class="meta-row">` with up to 4 inline chips.
 *
 * ─────────────────────────────────────────────────────────────
 * Fixed 2026-05-17 — was demand_band key mismatch
 * ─────────────────────────────────────────────────────────────
 * Previously `bandLabel` / `bandClass` accepted demand_band values
 * `'cool' | 'warm' | 'hot'`, but the data layer actually emits
 * `'cold' | 'normal' | 'hot'` (see src/data/test-consistency.ts
 * VALID_DEMAND_BAND). ~273 occupations whose demand_band was
 * `cold` or `normal` silently rendered no demand chip.
 *
 * Keys now aligned with data layer. The `workforce_band` dead
 * `'medium'` defensive key was also removed (data layer only
 * emits `'mid'`). SEO baseline rebased in the same commit.
 * ─────────────────────────────────────────────────────────────
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** Page-level inputs (snake-case names map to Rec fields verbatim). */
export interface MetaRowInput {
  /** Sector display name. Falsy → no sector chip. */
  readonly sectorJa: string | null;
  /** Sector id used to build `/sectors/{id}` href. Adapter
   *  forwards `rec.sector?.id` verbatim — when sectorJa is present
   *  this is always set, so the falsy path is purely defensive. */
  readonly sectorId: string | undefined;
  /** 'low' | 'mid' | 'high' | null */
  readonly riskBand: string | null;
  /** 'small' | 'mid' | 'large' | null */
  readonly workforceBand: string | null;
  /** 'cold' | 'normal' | 'hot' | null (matches data/lib/bands.ts) */
  readonly demandBand: string | null;
}

type BandField = 'risk_band' | 'workforce_band' | 'demand_band';

// Keys aligned with data layer (src/data/lib/bands.ts + test-consistency.ts).
const BAND_LABELS: Record<BandField, Record<string, string>> = {
  risk_band: { low: 'AI 影響 低', mid: 'AI 影響 中', high: 'AI 影響 高' },
  workforce_band: { small: '規模 小', mid: '規模 中', large: '規模 大' },
  demand_band: { cold: '需要 安定', normal: '需要 旺盛', hot: '需要 過熱' },
};

function bandLabel(field: BandField, band: string | null): string | null {
  if (!band) return null;
  return BAND_LABELS[field]?.[band] ?? null;
}

function bandClass(field: BandField, band: string | null): string {
  if (!band) return '';
  if (field === 'risk_band') return `band-${band}`;
  if (field === 'workforce_band') {
    return (
      ({ small: 'band-low', mid: 'band-mid', large: 'band-high' } as Record<
        string,
        string
      >)[band] ?? ''
    );
  }
  if (field === 'demand_band') {
    return (
      ({ cold: 'band-low', normal: 'band-mid', hot: 'band-high' } as Record<string, string>)[band] ??
      ''
    );
  }
  return '';
}

export function renderMetaRow(input: MetaRowInput): SafeHtml {
  const parts: string[] = [];

  if (input.sectorJa) {
    // Legacy parity: gating is solely on sectorJa. If sectorId is
    // undefined the href stringifies to `/sectors/undefined`
    // (template-literal coercion). That broken URL never ships in
    // practice because data is invariant on sectorJa ↔ sectorId
    // presence, but the byte-level behaviour is preserved verbatim.
    const href = `/sectors/${input.sectorId}`;
    parts.push(
      `<a class="sector-chip" href="${escapeHtml(href)}">${escapeHtml(input.sectorJa)}</a>`,
    );
  }

  const bands: ReadonlyArray<readonly [BandField, string | null]> = [
    ['risk_band', input.riskBand],
    ['workforce_band', input.workforceBand],
    ['demand_band', input.demandBand],
  ];
  for (const [field, band] of bands) {
    const label = bandLabel(field, band);
    if (label) {
      parts.push(`<span class="band ${bandClass(field, band)}">${escapeHtml(label)}</span>`);
    }
  }

  if (parts.length === 0) return '' as SafeHtml;
  return (`<div class="meta-row">${parts.join('')}</div>`) as SafeHtml;
}
