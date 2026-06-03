/**
 * src/lib/og-dispatch.ts — pure dispatch decision for `/api/og`.
 *
 * Why this module exists
 * ─────────────────────────────────────────────────────────────────
 * `api/og.tsx` used to inline the parameter-parse → card-lookup →
 * renderer-call chain inside its `renderHandler`. That meant the
 * dispatch branches (map / page=* / ranking=* / interest=* /
 * skill=* / compare=* / route=* / sector=* / id=* + the home-card
 * safety net) were 0% testable without spinning up `@vercel/og` +
 * the real Google Fonts fetch.
 *
 * This module extracts the decision-making layer as a pure
 * function (`decideDispatch`). The Edge entry then becomes a thin
 * executor: parse URL → call `decideDispatch` → switch on `kind`
 * → invoke the matching renderer. Unrenderable input never 400s —
 * it degrades to the home card (see DispatchDecision below).
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
  EXPLORE_CARDS,
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
  readonly route: Readonly<Record<string, GenericCardConfig>>;
}

export const PRODUCTION_CATALOG: CardCatalog = {
  page: PAGE_CARDS,
  ranking: RANKING_CARDS,
  interest: INTEREST_CARDS,
  skill: SKILL_CARDS,
  compare: COMPARE_CARDS,
  route: EXPLORE_CARDS,
};

/**
 * Dispatch decision returned by `decideDispatch`. The Edge entry
 * pattern-matches on `kind`:
 *   - `render-map`        → renderMapOgCard()
 *   - `render-generic`    → renderGenericOgCard(decision.config)
 *   - `render-sector`     → renderSectorOgCard(url, decision.id)
 *   - `render-occupation` → renderOccupationOgCard(url, decision.id)
 *
 * There is intentionally NO `bad-request` kind: the endpoint must
 * never hard-fail a social card. Any unrenderable input degrades to
 * the home generic card (see `decideDispatch`'s safety net) so a
 * wiring slip produces a valid-but-generic card, not a 400 that
 * scrapers would cache. (Renderer-level 404s for a genuinely absent
 * occupation / sector still propagate from sector.ts / occupation.ts.)
 *
 * No I/O happens at the decision layer. All 4 kinds carry just enough
 * data for the executor to call the appropriate renderer; the executor
 * still owns the URL (for origin-based upstream fetch in sector /
 * occupation renderers).
 */
export type DispatchDecision =
  | { kind: 'render-map' }
  | { kind: 'render-generic'; config: GenericCardConfig }
  | { kind: 'render-sector'; id: string }
  | { kind: 'render-occupation'; id: string };

/** Param-precedence order — first match wins. `page=map` short-
 *  circuits before the generic page lookup because /map is a rich
 *  card (treemap-legend variant), not the text-only family. */
const PARAM_KEYS = ['page', 'ranking', 'interest', 'skill', 'compare', 'route', 'sector', 'id'] as const;

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
  const routeParam = url.searchParams.get('route');

  // Safety net (2026-06-03): the endpoint must never hard-fail a social
  // card. Any input we cannot render — an unknown slug in a known
  // family, an invalid/absent occupation id, or no recognized param at
  // all — degrades to the home card instead of a 400 that scrapers
  // would cache. `catalog.page.home` is guaranteed present in both
  // PRODUCTION_CATALOG (PAGE_CARDS.home) and the test catalog.
  const homeCard = (): DispatchDecision => ({
    kind: 'render-generic',
    config: catalog.page.home,
  });

  // Generic text-only family: a known slug renders its looked-up card;
  // an unknown slug falls through to the home card. Replaces the old
  // per-family 400 branches.
  const generic = (
    table: Readonly<Record<string, GenericCardConfig>>,
    slug: string,
  ): DispatchDecision => {
    const cfg = table[slug];
    return cfg ? { kind: 'render-generic', config: cfg } : homeCard();
  };

  // /map OG card uses the rich treemap-legend variant — special-case
  // before the generic ?page= branch.
  if (pageParam === 'map') {
    return { kind: 'render-map' };
  }

  // Generic text-only cards by family, in precedence order. Each family
  // has a fixed lookup table built from a single source of truth in
  // src/views/ (PAGE_CARDS hand-maintained; the rest derived from their
  // *_META / EXPLORE_ROUTES modules).
  if (pageParam) return generic(catalog.page, pageParam);
  if (rankingParam) return generic(catalog.ranking, rankingParam);
  if (interestParam) return generic(catalog.interest, interestParam);
  if (skillParam) return generic(catalog.skill, skillParam);
  if (compareParam) return generic(catalog.compare, compareParam);
  if (routeParam) return generic(catalog.route, routeParam);

  // Sector cards consume URL.origin downstream; just forward the param.
  // Shape validation + 404 is the renderer's job (sector.ts checks
  // `/^[a-z_]+$/` and lets upstream 404 propagate).
  if (sectorParam) {
    return { kind: 'render-sector', id: sectorParam };
  }

  // Occupation id MUST be 1–4 ASCII digits (padId's strict contract —
  // we only ever serve up to 9999 occupations). A valid id renders the
  // occupation card; anything else (non-digit, overflow, decimal,
  // empty, or simply absent) falls back to the home card.
  if (idParam && /^\d{1,4}$/.test(idParam)) {
    return { kind: 'render-occupation', id: idParam };
  }

  return homeCard();
}

/** Exposed for tests + the no-param branch fallback in api/og.tsx. */
export const PARAM_KEYS_PRECEDENCE: ReadonlyArray<string> = PARAM_KEYS;
