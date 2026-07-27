/**
 * src/views/ranking.ts — barrel re-export for the ranking subsystem.
 *
 * The implementation moved into src/views/ranking/ on 2026-05-17
 * (audit finding CODE-010 — splitting the 1411-line monolith into
 * focused sub-modules per src/views/ranking/{config,utilities,loaders,
 * build,rankings/*}). This barrel preserves the historical import
 * path so every consumer keeps working without changes:
 *
 *   - src/pages/rankings/index.astro       buildRankings, loadOccupationsFromGraph
 *   - src/pages/rankings/[type].astro      buildRankings, RankingResult
 *   - src/pages/rankings/_rankings-bindings.ts  ALL_RANKINGS, RankingResult, RankingSlug
 *   - src/page-data/occupation-page-data.ts   buildRankings, loadOccupationsFromGraph
 *   - src/templates/Ranking.ts                type Occupation
 *   - src/templates/Ranking.test.ts           type Occupation
 *   - src/views/ranking.test.ts               loadOccupationsFromGraph
 *
 * For module-internal use, prefer `./ranking/<sub>` directly.
 */

export {
  TOP_N,
  DEMAND_SCORE,
  DEMAND_JA,
  HIGH_DEMAND_MIN,
  demandScore,
  demandLabel,
  ALL_RANKINGS,
  FAQS,
  buildRankings,
  loadOccupationsFromGraph,
  safeMean,
  fmtInt,
  type Occupation,
  type RankingResult,
  type RankingsBundle,
  type RankingSlug,
} from './ranking/index.js';
