/**
 * Transfer-paths derivation — graph-layer cross-occupation algorithm.
 *
 * Phase E follow-up (2026-05-17): extracted from
 * `src/data/projections/transfer_paths.ts` so the graph layer owns the
 * algorithm. Unlike profile5 (which is per-occupation and lives on
 * OccupationNode), transfer_paths is a *cross-occupation* algorithm —
 * for each source occupation S, it scans the same-sector pool of
 * candidates and ranks them by cosine similarity over skill vectors.
 * That cross-cutting shape doesn't fit a single OccupationNode field;
 * instead, the graph exposes a query method
 * `KnowledgeGraph.transferCandidatesOf(id)`.
 *
 * Both consumers go through this module:
 *
 *   1. `src/graph/loader.ts` — pre-builds the full
 *      `Map<OccupationId, TransferCandidate[]>` once during loadGraph()
 *      and exposes it via `transferCandidatesOf`. Views/page-data read
 *      it via the graph contract, no fs round-trip.
 *
 *   2. `src/data/projections/transfer_paths.ts` — still emits
 *      `public/data.transfer_paths.json` for browser consumers, but
 *      uses the same algorithm via `computeTransferCandidatesMap`.
 *      Removes the twin-algorithm drift risk.
 *
 * Pure: no I/O, no time, no Math.random. Same banker-rounded output
 * regardless of input order (fsum uses Neumaier compensated sum).
 *
 * Cost: O(N × pool) where pool is same-sector occupation count (~30-50).
 * For N=556 occupations, total ≈ 25k cosine computations ≈ 30-50ms.
 * Acceptable inside loadGraph (one-time, memoized for the whole build).
 */
import type { Occupation } from '../data/schema/occupation.js';
import { fsum } from '../data/lib/fsum.js';
import { bankerRound } from '../data/lib/banker-round.js';

// Phase C (2026-05-10): TOP_N raised 4 → 5 for the new spoke-spoke link block.
export const TRANSFER_TOP_N = 5;
export const TRANSFER_MIN_RISK_DROP = 1.0;
export const TRANSFER_MIN_SIMILARITY = 0.3;

/**
 * Per-source-occupation transfer-path candidate.
 *
 * Same shape the legacy public/data.transfer_paths.json projection emits.
 * Kept stable for backward-compatible projection output.
 */
export interface TransferCandidate {
  readonly id: number;
  readonly title_ja: string | null;
  readonly ai_risk: number | null;
  readonly similarity: number;
  readonly sector_id: string | null;
}

/**
 * Per-source-occupation transfer-path query result. `fallback` is null
 * for the "primary" path (≥1 strictly-safer candidate found in the
 * same sector); otherwise it labels the degraded reason. Used by both
 * `KnowledgeGraph.transferCandidatesOf(id)` and the JSON projection.
 */
export interface TransferPathEntry {
  readonly source_id: number;
  readonly candidates: ReadonlyArray<TransferCandidate>;
  readonly fallback: string | null;
}

/**
 * Cosine similarity over the intersection of dimension keys (only
 * sums over keys present in BOTH vectors, ignoring keys present in
 * only one). Uses Neumaier-compensated `fsum` so float accumulation
 * is order-independent and byte-equivalent to the Python pipeline.
 */
export function cosine(u: Record<string, number>, v: Record<string, number>): number {
  const uKeys = new Set(Object.keys(u));
  const sharedKeys: string[] = [];
  for (const k of Object.keys(v)) {
    if (uKeys.has(k)) sharedKeys.push(k);
  }
  if (sharedKeys.length === 0) return 0.0;

  const dotTerms: number[] = [];
  const uSqTerms: number[] = [];
  const vSqTerms: number[] = [];

  for (const k of sharedKeys) {
    const uk = u[k];
    const vk = v[k];
    if (uk == null || vk == null) continue;
    dotTerms.push(uk * vk);
  }
  for (const k of sharedKeys) {
    const uk = u[k];
    if (uk == null) continue;
    uSqTerms.push(uk * uk);
  }
  for (const k of sharedKeys) {
    const vk = v[k];
    if (vk == null) continue;
    vSqTerms.push(vk * vk);
  }

  const dot = fsum(dotTerms);
  const nu = Math.sqrt(fsum(uSqTerms));
  const nv = Math.sqrt(fsum(vSqTerms));
  if (nu === 0 || nv === 0) return 0.0;
  return dot / (nu * nv);
}

/**
 * Input shape for `computeTransferCandidatesMap` — the minimal slice of
 * graph state the algorithm needs. Decoupled from KnowledgeGraph itself
 * so the function can run both during loadGraph (before the graph
 * instance is sealed) and from the projection pipeline (using indexes).
 */
export interface TransferComputeInput {
  /** All occupation ids in stable ascending order (for deterministic iteration). */
  readonly sortedOccIds: ReadonlyArray<number>;
  /** Map occ id → raw IPD `skills` numeric block (or null/missing). */
  readonly skillsByOcc: ReadonlyMap<number, Record<string, number> | null>;
  /** Map occ id → latest AI-risk integer 0-10. */
  readonly riskByOcc: ReadonlyMap<number, number>;
  /** Map occ id → resolved sector id string. */
  readonly sectorByOcc: ReadonlyMap<number, string>;
  /** Map occ id → display title (ja). */
  readonly titleByOcc: ReadonlyMap<number, string>;
}

/**
 * Build the full `source_id → TransferPathEntry` map in one pass.
 *
 * For each source occupation:
 *   1. Look up its same-sector candidate pool (pre-indexed once).
 *   2. Filter to strictly safer candidates (risk drop ≥ MIN_RISK_DROP).
 *      If empty → fall back to the whole same-sector pool with
 *      `fallback: 'no_safer_in_sector'`.
 *   3. Score each candidate by `cosine(sourceSkills, candSkills)`,
 *      drop below MIN_SIMILARITY, sort desc, keep top N.
 *
 * Occupations with no skills / no sector / no AI risk land in the map
 * with `fallback: 'no_skills'` and empty candidates (renderers skip
 * the block gracefully).
 */
export function computeTransferCandidatesMap(
  input: TransferComputeInput,
): Map<number, TransferPathEntry> {
  // Pre-index candidates by sector — cuts inner loop from O(N) to O(pool).
  interface CandidateEntry {
    readonly id: number;
    readonly cand_skills: Record<string, number>;
    readonly cand_risk: number;
  }
  const candidatesBySector = new Map<string, CandidateEntry[]>();
  for (const candId of input.sortedOccIds) {
    const candSkills = input.skillsByOcc.get(candId);
    if (candSkills == null) continue;
    const candRisk = input.riskByOcc.get(candId);
    if (candRisk == null) continue;
    const candSector = input.sectorByOcc.get(candId);
    if (candSector == null) continue;
    let bucket = candidatesBySector.get(candSector);
    if (!bucket) {
      bucket = [];
      candidatesBySector.set(candSector, bucket);
    }
    bucket.push({ id: candId, cand_skills: candSkills, cand_risk: candRisk });
  }

  const out = new Map<number, TransferPathEntry>();

  for (const occId of input.sortedOccIds) {
    const sourceSkills = input.skillsByOcc.get(occId);
    const sourceSector = input.sectorByOcc.get(occId);
    const sourceRisk = input.riskByOcc.get(occId);

    if (sourceSkills == null || sourceSector == null || sourceRisk == null) {
      out.set(occId, {
        source_id: occId,
        candidates: [],
        fallback: 'no_skills',
      });
      continue;
    }

    const sectorPool = candidatesBySector.get(sourceSector) ?? [];
    const pool = sectorPool.filter((c) => c.id !== occId);
    const safer = pool.filter((c) => c.cand_risk <= sourceRisk - TRANSFER_MIN_RISK_DROP);

    let chosenPool: ReadonlyArray<CandidateEntry>;
    let fallbackLabel: string | null = null;
    if (safer.length > 0) {
      chosenPool = safer;
    } else {
      chosenPool = pool;
      fallbackLabel = 'no_safer_in_sector';
    }

    const scored: Array<{ id: number; similarity: number; cand_risk: number }> = [];
    for (const c of chosenPool) {
      const sim = bankerRound(cosine(sourceSkills, c.cand_skills), 4);
      if (sim < TRANSFER_MIN_SIMILARITY) continue;
      scored.push({ id: c.id, similarity: sim, cand_risk: c.cand_risk });
    }
    // V8's Array.prototype.sort is stable since Node 12, matching Python's
    // stable sort — preserves deterministic tie-breaks (insertion order).
    scored.sort((a, b) => b.similarity - a.similarity);
    const top = scored.slice(0, TRANSFER_TOP_N);

    if (top.length === 0) {
      out.set(occId, {
        source_id: occId,
        candidates: [],
        fallback: fallbackLabel ?? 'no_similar_in_sector',
      });
      continue;
    }

    const candidates: TransferCandidate[] = top.map((s) => ({
      id: s.id,
      title_ja: input.titleByOcc.get(s.id) ?? null,
      ai_risk: s.cand_risk,
      similarity: s.similarity,
      sector_id: input.sectorByOcc.get(s.id) ?? null,
    }));

    out.set(occId, {
      source_id: occId,
      candidates,
      fallback: fallbackLabel,
    });
  }

  return out;
}

/**
 * Adapter from a raw IPD `Occupation` to `Record<string, number>`.
 * Returns null when the occupation has no skills block (which downstream
 * code treats as "no candidates"). Tiny helper, but pulls the IPD-shape
 * awareness out of the algorithm itself.
 */
export function skillsBlockOf(occ: Occupation): Record<string, number> | null {
  // Occupation.skills is `Record<string, number>` per the Zod schema's
  // ipdScoreDimension shape, but may be omitted entirely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = (occ as any).skills;
  if (block == null) return null;
  // Filter out any null/undefined values — they leak through Zod's
  // `.nullish()` modifier and would break cosine math downstream.
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
    if (typeof v === 'number') cleaned[k] = v;
  }
  return Object.keys(cleaned).length === 0 ? null : cleaned;
}
