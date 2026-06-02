/**
 * src/page-data/occupation-page-data.ts — page-level data preparation
 * for the 556 /[id] occupation detail pages.
 *
 * Lives in src/page-data/ (Phase E #2, 2026-05-15) because it
 * orchestrates loadGraph() + cross-occupation dataset construction
 * for an Astro page. That's build orchestration, not a pure view —
 * views receive a graph; only page-data initiates loadGraph.
 *
 * The getStaticPaths function in src/pages/[id].astro used to
 * inline ~80 lines of data wiring: load the graph, adapt every
 * detail file, sort, build the name lookup, build the
 * rankings-hits-by-occupation map, build the same-risk neighbor
 * map, and define the pickRelated algorithm. All of that is data
 * shaping, not page binding — moving it here keeps the page file
 * focused on Astro frontmatter + props extraction.
 *
 * Output is an `OccupationPageDataset` containing the four pieces
 * the page needs for every render: the full `allRecs` array, the
 * `nameLookup` map, and the two `Map → Array` serializations
 * required by Astro (which can't transport Map objects across the
 * getStaticPaths → component boundary).
 *
 * The pickRelatedOccupations function is the legacy "show 3 close
 * AI-risk neighbors + fill to 5 with id-distance fallbacks"
 * algorithm — preserved byte-for-byte (the SEO baseline diff
 * verifies every related-jobs list on every page).
 */

// Phase D audit #6 (2026-05-14): removed `node:fs` + `node:path`. Per doc
// §3.3 views must not do I/O. The previous buildOccupationSpokeViews
// re-read public/data.detail/<padded>.json on each spoke build; that data
// now flows from the graph (passed in by the page caller).
import type { Rec } from '@/views/occupation-detail';
import type { KnowledgeGraph } from '@/graph';
import type { SafeHtml } from '@/lib/safe-html';
import type { DetailFileSpoke } from '@/views/spoke-hub-graph';

/** One entry in the same-risk-neighbor map for a single occupation. */
export interface SameRiskNeighborView {
  readonly id: number;
  readonly name_ja: string;
  readonly ai_risk: number | null;
  readonly sector_id: string | null;
  readonly sector_ja: string | null;
  readonly workers: number | null;
}

/** One entry in the ranking-hits map for a single occupation. */
export interface RankingHitView {
  readonly slug: string;
  readonly rank: number;
}

/** Bundle of page-level data prep needed by [id].astro's
 *  getStaticPaths → component pipeline. */
export interface OccupationPageDataset {
  /** All 556 occupation records, sorted by id ascending. */
  readonly allRecs: Rec[];
  /** id → name_ja lookup. Used by the Transfer card name fallback. */
  readonly nameLookup: Record<number, string>;
  /** Array-serialized Map<occId, RankingHit[]>. Map can't cross the
   *  getStaticPaths → component boundary in Astro, so we serialize. */
  readonly rankingHitsArr: Array<[number, Array<RankingHitView>]>;
  /** Array-serialized Map<occId, SameRiskNeighbor[]> (Phase C
   *  cross-sector same-risk neighbors, capped at 5). */
  readonly sameRiskArr: Array<[number, Array<SameRiskNeighborView>]>;
}

/** How many same-risk neighbors to keep per occupation (Phase C). */
const SAME_RISK_TOP_N = 5;
/** How many related jobs the legacy related-section shows. */
const RELATED_COUNT_DEFAULT = 5;
/** How many of those slots are filled by "close AI-risk" matches. */
const RELATED_CLOSE_RISK_QUOTA = 3;
/** Maximum AI-risk distance counted as "close". */
const RELATED_CLOSE_RISK_TOLERANCE = 1;

/**
 * Load + adapt every detail file, sort by id, and pre-compute the
 * cross-occupation maps Astro needs to transport to every page render.
 *
 * Dynamic imports are used so this function can be called from inside
 * Astro's `getStaticPaths` without hoisting issues — Astro statically
 * analyzes top-level imports differently than dynamic ones.
 */
export async function buildOccupationPageData(): Promise<OccupationPageDataset> {
  const { loadGraph } = await import('@/graph');
  const { buildOccupationDetailFile } = await import('@/views/occupation-detail');
  const { adaptDetailFile } = await import('@/views/occupation-detail');
  const { buildRankings, loadOccupationsFromGraph } = await import('@/views/ranking');
  const { buildRankingHitsByOcc } = await import('@/views/spoke-hub-graph');
  const { buildSameRiskNeighbors } = await import('@/views/spoke-spoke-graph');

  const graph = await loadGraph();
  const allRecs: Rec[] = [];
  for (const [occId, occNode] of graph.occupations) {
    const detailFile = buildOccupationDetailFile(graph, occId);
    // profile5 + transferCandidates both flow through the graph layer
    // (Phase E follow-up 2026-05-16/17) — no fs round-trip via the
    // deprecated getProfile5() / getTransferPaths() loaders.
    allRecs.push(adaptDetailFile(
      detailFile,
      occNode.profile5,
      graph.transferCandidatesOf(occId),
    ));
  }
  allRecs.sort((a, b) => a.id - b.id);

  const nameLookup: Record<number, string> = {};
  for (const r of allRecs) nameLookup[r.id] = r.name_ja;

  // Ranking-hits map (Phase A: built once, shared across all spokes).
  // Phase D audit #6 (2026-05-14): explicit graph loader passed in; previous
  // buildRankings() with no loader fell back to fs-reading loadOccupations,
  // which violates doc §3.3 (views shouldn't do I/O).
  const rankingResults = buildRankings(() => loadOccupationsFromGraph(graph));
  const rankingHitsByOcc = buildRankingHitsByOcc(rankingResults.results.values());
  const rankingHitsArr: Array<[number, Array<RankingHitView>]> = [];
  for (const [occId, hits] of rankingHitsByOcc) {
    rankingHitsArr.push([
      occId,
      hits.map((h) => ({ slug: h.slug, rank: h.rank })),
    ]);
  }

  // Same-risk-neighbor map (Phase C: cross-sector, symmetric, capped at top 5).
  const sameRiskInputs = allRecs.map((r) => ({
    id: r.id,
    name_ja: r.name_ja,
    ai_risk: r.ai_risk,
    sector_id: r.sector?.id ?? null,
    sector_ja: r.sector?.ja ?? null,
    workers: r.workers,
  }));
  const srnMap = buildSameRiskNeighbors(sameRiskInputs, { span: 1, topN: SAME_RISK_TOP_N });
  const sameRiskArr: Array<[number, Array<SameRiskNeighborView>]> = [];
  for (const [occId, neighbors] of srnMap) {
    // Cap final view at SAME_RISK_TOP_N even though symmetrize may have added a few.
    sameRiskArr.push([occId, neighbors.slice(0, SAME_RISK_TOP_N)]);
  }

  return { allRecs, nameLookup, rankingHitsArr, sameRiskArr };
}

/** HTML fragments for the spoke-hubs and same-risk-neighbors
 *  sections of one detail page. Phase E (2026-05-15) closed the
 *  SafeHtml brand here — both fields now flow as SafeHtml from
 *  the upstream renderers (spoke-{hub,spoke}-graph). */
export interface OccupationSpokeViews {
  /** `<section>` markup for the same-risk neighbors block.
   *  Empty SafeHtml when this occupation has no neighbors. */
  readonly sameRiskHtml: SafeHtml;
  /** `<section>` markup for the related-hubs block. */
  readonly relatedHubsHtml: SafeHtml;
}

/**
 * Reconstruct the cross-occupation Maps Astro had to serialize over
 * the getStaticPaths → component boundary, then derive the two
 * spoke-graph HTML fragments for this page.
 *
 * The raw `public/data.detail/{padded}.json` is re-read here (one
 * extra ~1ms read per spoke build) because computeSpokeHubs needs
 * the original `top-N` array shape, not the page-local Rec shape.
 */
export async function buildOccupationSpokeViews(
  rec: Rec,
  rankingHitsArr: ReadonlyArray<[number, ReadonlyArray<RankingHitView>]>,
  sameRiskArr: ReadonlyArray<[number, ReadonlyArray<SameRiskNeighborView>]>,
  graph: KnowledgeGraph,
): Promise<OccupationSpokeViews> {
  const { computeSpokeHubs, renderSpokeHubsSection } = await import(
    '@/views/spoke-hub-graph'
  );
  const { renderSameRiskSection } = await import('@/views/spoke-spoke-graph');
  const { loadGraphAdaptedDetails } = await import('@/views/hub');

  // Same-risk neighbors: lookup this rec's row from the serialized array.
  const sameRiskMap = new Map(sameRiskArr);
  const myNeighbors = sameRiskMap.get(rec.id) ?? [];
  const sameRiskHtml = renderSameRiskSection([...myNeighbors], rec.ai_risk);

  // Ranking-hits map: needed by computeSpokeHubs for "this rec
  // appears in rankings X, Y, Z" inclusion.
  const rankingHitsByOcc = new Map(
    rankingHitsArr.map(
      ([occId, hits]) =>
        [occId, hits.map((h) => ({ slug: h.slug, rank: h.rank }))] as const,
    ),
  );

  // Phase D audit #6 (2026-05-14): build the spoke detail shape from the
  // graph instead of re-reading public/data.detail/<id>.json. The hub
  // adapter `loadGraphAdaptedDetails(graph)` already yields the DetailFileMin
  // shape that computeSpokeHubs's DetailFileSpoke extends.
  //
  // Byte-identity guard: the pre-refactor `data.detail/<id>.json` files do
  // NOT contain an `interests` block (graph derives RIASEC from a separate
  // source). computeSpokeHubs.topInterestTypes() therefore returned [] for
  // every occupation, which means the spoke section never emitted
  // /interests/<type> links. Adding `interests` here from
  // graph.interestsOf() would now emit those links — a real SEO drift
  // (verified: each detail page would grow by exactly 2 hrefs). We
  // intentionally omit `interests` to preserve byte-identical output. A
  // future Phase E commit can opt-in by populating interests once the
  // baseline is recaptured with the drift acknowledged.
  const allDetails = loadGraphAdaptedDetails(graph);
  const baseDetail = allDetails.find((d) => d.id === rec.id) ?? null;
  // DetailFileMin is structurally a DetailFileSpoke (the latter adds only
  // optional `interests`). The explicit cast names the contract; the runtime
  // shape is unchanged. See block-comment above for the byte-identity guard
  // on why `interests` is intentionally omitted.
  const spokeHubs = baseDetail
    ? computeSpokeHubs(baseDetail as DetailFileSpoke, {
        rankingHitsByOcc: rankingHitsByOcc as never,
      })
    : { groups: [], total: 0 };
  const relatedHubsHtml = renderSpokeHubsSection(spokeHubs);

  return { sameRiskHtml, relatedHubsHtml };
}

/**
 * Pick up to `count` related occupations for one focus record.
 *
 * Algorithm (preserved byte-for-byte from legacy [id].astro):
 *   1. Quota: first 3 slots reserved for close AI-risk matches
 *      (|risk - focus.risk| ≤ 1), sorted by risk-distance then
 *      id-distance then id.
 *   2. Fill remaining slots from the full list ordered by absolute
 *      id-distance from the focus, then by id ascending.
 *
 * When focus.ai_risk is null, step 1 is skipped entirely and the
 * function falls straight through to id-distance selection.
 */
export function pickRelatedOccupations(
  focus: Rec,
  allRecs: ReadonlyArray<Rec>,
  count: number = RELATED_COUNT_DEFAULT,
): Rec[] {
  const focusId = focus.id;
  const focusRisk = focus.ai_risk;
  const chosen: Rec[] = [];
  const chosenIds = new Set<number>();

  // Step 1: close AI-risk quota.
  if (focusRisk !== null) {
    const closeRisk = allRecs.filter(
      (r) =>
        r.id !== focusId &&
        r.ai_risk !== null &&
        Math.abs(r.ai_risk - focusRisk) <= RELATED_CLOSE_RISK_TOLERANCE,
    );
    closeRisk.sort((a, b) => {
      const da = Math.abs((a.ai_risk ?? 0) - focusRisk);
      const db = Math.abs((b.ai_risk ?? 0) - focusRisk);
      if (da !== db) return da - db;
      const na = Math.abs(a.id - focusId);
      const nb = Math.abs(b.id - focusId);
      if (na !== nb) return na - nb;
      return a.id - b.id;
    });
    for (const r of closeRisk) {
      if (chosen.length >= RELATED_CLOSE_RISK_QUOTA) break;
      chosen.push(r);
      chosenIds.add(r.id);
    }
  }

  // Step 2: fill from id-distance neighbours.
  const idNeighbours = allRecs
    .filter((r) => r.id !== focusId && !chosenIds.has(r.id))
    .sort((a, b) => {
      const na = Math.abs(a.id - focusId);
      const nb = Math.abs(b.id - focusId);
      if (na !== nb) return na - nb;
      return a.id - b.id;
    });
  for (const r of idNeighbours) {
    if (chosen.length >= count) break;
    chosen.push(r);
    chosenIds.add(r.id);
  }

  return chosen.slice(0, count);
}
