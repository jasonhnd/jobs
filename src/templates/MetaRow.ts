/**
 * src/templates/MetaRow.ts — sector chip + risk/workforce/demand
 * band chips row, rendered directly under the page title on the
 * occupation detail page.
 *
 * Extracted from src/pages/ja/[id].astro (`renderMetaRow` plus its
 * `bandLabel` / `bandClass` helpers). The whole row is one
 * `<div class="meta-row">` with up to 4 inline chips.
 *
 * ─────────────────────────────────────────────────────────────
 * PRESERVED PRE-EXISTING BUG (do not "fix" silently)
 * ─────────────────────────────────────────────────────────────
 * `bandLabel` / `bandClass` accept the demand_band values
 * `'cool' | 'warm' | 'hot'`, but the data layer actually emits
 * `'cold' | 'normal' | 'hot'` (see src/data/test-consistency.ts
 * VALID_DEMAND_BAND). As a result, ~273 occupations whose
 * demand_band is `cold` or `normal` silently render no demand
 * chip on the live site today.
 *
 * The architecture migration is required to ship byte-equivalent
 * output to the SEO baseline snapshot. Fixing the lookup here
 * would shift the rendered HTML on ~273 pages and break the
 * `pnpm run check:seo-baseline` gate. The fix belongs in a
 * separate, deliberate commit that ALSO rebases the baseline.
 *
 * `workforce_band` also tolerates both `'mid'` and `'medium'`;
 * the data layer only emits `'mid'`, but the dead-defensive
 * `'medium'` key is preserved for parity.
 * ─────────────────────────────────────────────────────────────
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

/** Page-level inputs (snake-case names map to Rec fields verbatim). */
export interface MetaRowInput {
  /** Sector display name. Falsy → no sector chip. */
  readonly sectorJa: string | null;
  /** Sector id used to build `/ja/sectors/{id}` href. Adapter
   *  forwards `rec.sector?.id` verbatim — when sectorJa is present
   *  this is always set, so the falsy path is purely defensive. */
  readonly sectorId: string | undefined;
  /** 'low' | 'mid' | 'high' | null */
  readonly riskBand: string | null;
  /** 'small' | 'mid' | 'medium' | 'large' | null */
  readonly workforceBand: string | null;
  /** 'cool' | 'warm' | 'hot' (the labelled keys, BUG — see header) */
  readonly demandBand: string | null;
}

type BandField = 'risk_band' | 'workforce_band' | 'demand_band';

// PRESERVED LEGACY KEYSET — see file header for the demand_band bug
// and the workforce_band 'medium' dead-defensive key.
const BAND_LABELS: Record<BandField, Record<string, string>> = {
  risk_band: { low: 'AI 影響 低', mid: 'AI 影響 中', high: 'AI 影響 高' },
  workforce_band: { small: '規模 小', mid: '規模 中', medium: '規模 中', large: '規模 大' },
  demand_band: { cool: '需要 安定', warm: '需要 旺盛', hot: '需要 過熱' },
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
      ({ small: 'band-low', mid: 'band-mid', medium: 'band-mid', large: 'band-high' } as Record<
        string,
        string
      >)[band] ?? ''
    );
  }
  if (field === 'demand_band') {
    return (
      ({ cool: 'band-low', warm: 'band-mid', hot: 'band-high' } as Record<string, string>)[band] ??
      ''
    );
  }
  return '';
}

export function renderMetaRow(input: MetaRowInput): SafeHtml {
  const parts: string[] = [];

  if (input.sectorJa) {
    // Legacy parity: gating is solely on sectorJa. If sectorId is
    // undefined the href stringifies to `/ja/sectors/undefined`
    // (template-literal coercion). That broken URL never ships in
    // practice because data is invariant on sectorJa ↔ sectorId
    // presence, but the byte-level behaviour is preserved verbatim.
    const href = `/ja/sectors/${input.sectorId}`;
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
