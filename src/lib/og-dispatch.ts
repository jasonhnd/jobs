/**
 * src/lib/og-dispatch.ts — pure dispatch decision for `/api/og`.
 *
 * Why this module exists
 * ─────────────────────────────────────────────────────────────────
 * `api/og.tsx` used to inline the parameter-parse → card-lookup →
 * renderer-call chain inside its `renderHandler`. That meant the
 * 11 dispatch branches (map / page=* / ranking=* / interest=* /
 * skill=* / compare=* / sector=* / id=* + four 400-fallback cases)
 * were 0% testable without spinning up `@vercel/og` + the real
 * Google Fonts fetch.
 *
 * This module extracts the decision-making layer as a pure
 * function (`decideDispatch`). The Edge entry then becomes a thin
 * executor: parse URL → call `decideDispatch` → switch on `kind`
 * → invoke the matching renderer (or emit the 400 Response).
 *
 * Architecture-fit: src/lib/ classification per docs/architecture.md
 * §6.2 — "general-purpose utility code, no forbidden imports". The
 * dispatch decision is data, not HTML, not a graph query — it
 * doesn't belong in views/ (which is graph-shaped projections) or
 * templates/ (which produces SafeHtml). lib/ is the right home.
 */

import {
  PAGE_CARDS,
  RANKING_CARDS,
  INTEREST_CARDS,
  SKILL_CARDS,
  COMPARE_CARDS,
} from '../views/og-cards.js';
import { type GenericCardConfig } from './og-helpers.js';

/**
 * Per-card-family lookup table. Bundled as one record so callers
 * (and tests) can inject alternative tables without touching the
 * production data. Defaults to the production CARDS at module load.
 */
export interface CardCatalog {
  readonly page: Readonly<Record<string, GenericCardConfig>>;
  readonly ranking: Readonly<Record<string, GenericCardConfig>>;
  readonly interest: Readonly<Record<string, GenericCardConfig>>;
  readonly skill: Readonly<Record<string, GenericCardConfig>>;
  readonly compare: Readonly<Record<string, GenericCardConfig>>;
}

export const PRODUCTION_CATALOG: CardCatalog = {
  page: PAGE_CARDS,
  ranking: RANKING_CARDS,
  interest: INTEREST_CARDS,
  skill: SKILL_CARDS,
  compare: COMPARE_CARDS,
};

/**
 * Dispatch decision returned by `decideDispatch`. The Edge entry
 * pattern-matches on `kind`:
 *   - `render-map`        → renderMapOgCard()
 *   - `render-generic`    → renderGenericOgCard(decision.config)
 *   - `render-sector`     → renderSectorOgCard(url, decision.id)
 *   - `render-occupation` → renderOccupationOgCard(url, decision.id)
 *   - `bad-request`       → new Response(decision.message, { status: 400 })
 *
 * No I/O happens at the decision layer. All 4 render-* kinds carry
 * just enough data for the executor to call the appropriate
 * renderer; the executor still owns the URL (for origin-based
 * upstream fetch in sector / occupation renderers).
 */
export type DispatchDecision =
  | { kind: 'render-map' }
  | { kind: 'render-generic'; config: GenericCardConfig }
  | { kind: 'render-sector'; id: string }
  | { kind: 'render-occupation'; id: string }
  | { kind: 'bad-request'; message: string };

/** Param-precedence order — first match wins. `page=map` short-
 *  circuits before the generic page lookup because /map is a rich
 *  card (treemap-legend variant), not the text-only family. */
const PARAM_KEYS = ['page', 'ranking', 'interest', 'skill', 'compare', 'sector', 'id'] as const;

/**
 * Decide which renderer to invoke given a request URL. Pure
 * function: depends only on `url.searchParams` and the catalog.
 * Returns a discriminated `DispatchDecision` — the executor in
 * `api/og.tsx` does the actual renderer call + Response wrap.
 */
export function decideDispatch(
  url: URL,
  catalog: CardCatalog = PRODUCTION_CATALOG,
): DispatchDecision {
  const sectorParam = url.searchParams.get('sector');
  const idParam = url.searchParams.get('id');
  const pageParam = url.searchParams.get('page');
  const rankingParam = url.searchParams.get('ranking');
  const interestParam = url.searchParams.get('interest');
  const skillParam = url.searchParams.get('skill');
  const compareParam = url.searchParams.get('compare');

  // /map OG card uses the rich treemap-legend variant — special-case
  // before the generic ?page= branch.
  if (pageParam === 'map') {
    return { kind: 'render-map' };
  }

  // Generic text-only cards by family. Each family has a fixed
  // lookup table; unknown slugs produce a 400 with the known-keys
  // list embedded for caller-friendly diagnostics.
  if (pageParam) {
    const cfg = catalog.page[pageParam];
    if (!cfg) {
      return {
        kind: 'bad-request',
        message: `Bad request: unknown ?page=${pageParam}. Known: ${Object.keys(catalog.page).join(', ')}, map`,
      };
    }
    return { kind: 'render-generic', config: cfg };
  }

  if (rankingParam) {
    const cfg = catalog.ranking[rankingParam];
    if (!cfg) {
      return {
        kind: 'bad-request',
        message: `Bad request: unknown ?ranking=${rankingParam}. Known: ${Object.keys(catalog.ranking).join(', ')}`,
      };
    }
    return { kind: 'render-generic', config: cfg };
  }

  if (interestParam) {
    const cfg = catalog.interest[interestParam];
    if (!cfg) {
      return {
        kind: 'bad-request',
        message: `Bad request: unknown ?interest=${interestParam}. Known: ${Object.keys(catalog.interest).join(', ')}`,
      };
    }
    return { kind: 'render-generic', config: cfg };
  }

  if (skillParam) {
    const cfg = catalog.skill[skillParam];
    if (!cfg) {
      return {
        kind: 'bad-request',
        message: `Bad request: unknown ?skill=${skillParam}. Known: ${Object.keys(catalog.skill).join(', ')}`,
      };
    }
    return { kind: 'render-generic', config: cfg };
  }

  if (compareParam) {
    const cfg = catalog.compare[compareParam];
    if (!cfg) {
      return {
        kind: 'bad-request',
        message: `Bad request: unknown ?compare=${compareParam}. Known: ${Object.keys(catalog.compare).join(', ')}`,
      };
    }
    return { kind: 'render-generic', config: cfg };
  }

  // Sector + occupation cards consume URL.origin downstream; just
  // forward the param. Validation of sectorId shape / idParam is
  // the renderer's job (sector.ts checks `/^[a-z_]+$/`, occupation.ts
  // calls `padId(idParam)` and lets upstream 404 propagate).
  if (sectorParam) {
    return { kind: 'render-sector', id: sectorParam };
  }

  // Occupation id MUST be 1–4 ASCII digits. Anything else is a 400.
  // The 1-to-4 bound matches `padId`'s strict contract — we only ever
  // serve up to 9999 occupations, and accepting wider input would
  // either throw downstream (turning into a 500) or, before CODE-008
  // was fixed, silently truncate to the wrong card.
  if (!idParam) {
    return {
      kind: 'bad-request',
      message:
        'Bad request: required ?id=<n>, ?sector=<id>, ?ranking=<slug>, ?interest=<slug>, ?skill=<slug>, ?compare=<slug>, or ?page=<map|home|about|privacy|compliance|404|sectors|rankings|interests|skills|compare>',
    };
  }
  if (!/^\d{1,4}$/.test(idParam)) {
    return {
      kind: 'bad-request',
      message: `Bad request: invalid ?id=${idParam} (must be 1-4 digits, max 9999)`,
    };
  }

  return { kind: 'render-occupation', id: idParam };
}

/** Exposed for tests + the no-param branch fallback in api/og.tsx. */
export const PARAM_KEYS_PRECEDENCE: ReadonlyArray<string> = PARAM_KEYS;
