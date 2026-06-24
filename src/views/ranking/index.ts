/**
 * src/views/ranking/index.ts — public façade for the ranking subsystem.
 *
 * Refactored from the 1411-line src/views/ranking.ts (2026-05-17, audit
 * finding CODE-010). The original module was split into focused
 * sub-modules; this barrel re-exports the public API exactly as it was
 * before, so every consumer under src/pages/rankings/* (and the
 * type-only consumers in src/templates/) keeps working without changes.
 *
 * Public surface (unchanged):
 *   - Types:     Occupation, RankingResult, RankingsBundle, RankingSlug
 *   - Constants: TOP_N, DEMAND_SCORE, DEMAND_JA, ALL_RANKINGS
 *   - Helpers:   safeMean, fmtInt (re-export from lib/num)
 *   - Editorial: FAQS (re-export from ranking-copy)
 *   - Builders:  buildRankings(loader, options?), loadOccupationsFromGraph(graph)
 */

export {
  TOP_N,
  DEMAND_SCORE,
  DEMAND_JA,
  ALL_RANKINGS,
  RANKING_GROUPS,
  type Occupation,
  type RankingResult,
  type RankingsBundle,
  type RankingsHubCardData,
  type RankingsHubGroup,
  type RankingSlug,
  type RankingGroupKey,
} from './config.js';

export { safeMean } from './utilities.js';

// `fmtInt` lives in src/lib/num.ts but used to be re-exported from
// the rankings module — keep the surface stable.
export { fmtInt } from '../../lib/num.js';

// Editorial FAQs (preserved re-export — multiple consumers pull `FAQS`
// from this module path).
export { FAQS } from '../ranking-copy.js';

export { buildRankings, type BuildRankingsOptions } from './build.js';
export { loadOccupationsFromGraph } from './loaders.js';
