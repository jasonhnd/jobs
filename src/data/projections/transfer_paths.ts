/**
 * data.transfer_paths.json projection — per docs/DATA_ARCHITECTURE.md §6.11.
 *
 * Status: Implemented (v1.1.0 phase 2)
 * Consumer: mobile ④/⑤ 詳細 関連職業 grid (3 cards), future ⑨ 診断 結果
 * Shape: { source_id → [ {id, similarity, sector_id, ai_risk}, ... ] up to 5 entries }
 *
 * Phase E follow-up (2026-05-17): the algorithm (cosine + same-sector pool
 * pre-indexing + safer-candidate filter) moved into the graph layer at
 * `src/graph/transfer-paths.ts`. This module now reuses
 * `computeTransferCandidatesMap` so views/page-data can read the same data
 * via `KnowledgeGraph.transferCandidatesOf(id)` without an fs round-trip.
 * `public/data.transfer_paths.json` is still emitted for browser consumers,
 * byte-identical to the legacy projection.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { nowIso } from '../../lib/now.js';
import {
  computeTransferCandidatesMap,
  skillsBlockOf,
  TRANSFER_TOP_N,
  TRANSFER_MIN_RISK_DROP,
  TRANSFER_MIN_SIMILARITY,
  type TransferComputeInput,
} from '../../graph/transfer-paths.js';

export interface TransferPathsBuildResult {
  files: string[];
  sources: number;
  summary: {
    total_sources: number;
    primary: number;
    fallback_no_safer_in_sector: number;
    fallback_no_skills: number;
    no_candidates: number;
  };
}

export async function buildTransferPaths(
  indexes: Indexes,
  distRoot: string,
): Promise<TransferPathsBuildResult> {
  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);

  const input: TransferComputeInput = {
    sortedOccIds: sortedIds,
    skillsByOcc: new Map(
      sortedIds.map((id) => [id, skillsBlockOf(indexes.occById.get(id)!)]),
    ),
    riskByOcc: new Map(
      [...indexes.canonicalScoreByOcc].map(([id, entry]) => [id, entry.ai_risk]),
    ),
    sectorByOcc: new Map(
      [...indexes.sectorByOcc].map(([id, a]) => [id, a.sector_id]),
    ),
    titleByOcc: new Map(
      sortedIds.map((id) => [id, indexes.occById.get(id)!.title_ja]),
    ),
  };

  const map = computeTransferCandidatesMap(input);

  // Transform map → JSON payload. Tally summary stats from fallback labels
  // for build telemetry.
  const outPaths: Record<string, unknown> = {};
  const fallbackCounts = {
    no_safer_in_sector: 0,
    no_skills: 0,
    primary: 0,
  };
  let noCandidatesAtAll = 0;
  for (const occId of sortedIds) {
    const entry = map.get(occId);
    if (!entry) continue;

    // Preserve the legacy projection's exact JSON shape:
    // - `fallback` key is OMITTED entirely (not null) when no fallback.
    // - candidates objects stay byte-identical in field order.
    const obj: Record<string, unknown> = {
      source_id: entry.source_id,
      candidates: entry.candidates,
    };
    if (entry.fallback != null) obj.fallback = entry.fallback;
    outPaths[String(occId)] = obj;

    if (entry.fallback === 'no_skills') {
      fallbackCounts.no_skills += 1;
    } else if (entry.fallback === 'no_safer_in_sector') {
      fallbackCounts.no_safer_in_sector += 1;
    } else if (entry.fallback === 'no_similar_in_sector') {
      noCandidatesAtAll += 1;
    } else {
      // Either no fallback (primary) or one of the above. Non-null with
      // no candidates means scored.length === 0 → also "no candidates".
      if (entry.candidates.length === 0 && entry.fallback != null) {
        // Already counted above.
      } else {
        fallbackCounts.primary += 1;
      }
    }
  }

  const summary = {
    total_sources: Object.keys(outPaths).length,
    primary: fallbackCounts.primary,
    fallback_no_safer_in_sector: fallbackCounts.no_safer_in_sector,
    fallback_no_skills: fallbackCounts.no_skills,
    no_candidates: noCandidatesAtAll,
  };

  const payload = {
    schema_version: '1.0',
    generated_at: nowIso(),
    rule: {
      top_n: TRANSFER_TOP_N,
      min_risk_drop: TRANSFER_MIN_RISK_DROP,
      min_similarity: TRANSFER_MIN_SIMILARITY,
      ranking_metric: 'cosine_similarity_over_skills',
      candidate_pool: 'same_sector_id',
    },
    summary,
    paths: outPaths,
  };

  const outPath = join(distRoot, 'data.transfer_paths.json');
  await writeFile(
    outPath,
    JSON.stringify(payload) + '\n',
    'utf-8',
  );

  return {
    files: [outPath],
    sources: Object.keys(outPaths).length,
    summary,
  };
}
