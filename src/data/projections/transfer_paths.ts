/**
 * data.transfer_paths.json projection — per docs/DATA_ARCHITECTURE.md §6.11.
 *
 * Status: Implemented (v1.1.0 phase 2)
 * Consumer: mobile ④/⑤ 詳細 関連職業 grid (3 cards), future ⑨ 診断 結果
 * Shape: { source_id → [ {id, similarity, sector_id, ai_risk}, ... ] up to 4 entries }
 *
 * Recommendation rule:
 *   For each source occupation S, candidates are occupations C where:
 *     1. C.sector_id == S.sector_id
 *     2. C.ai_risk <= S.ai_risk - MIN_RISK_DROP (strictly safer)
 *     3. C != S
 *   Rank by cosine similarity over their `skills` vector. Top N (4).
 *
 * Fallback: same-sector ANY ai_risk if no safer candidates exist.
 *
 * Migrated from scripts/projections/transfer_paths.py.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { fsum } from '../lib/fsum.js';
import { pythonRound } from '../lib/python-round.js';

const TOP_N = 4;
const MIN_RISK_DROP = 1.0;
const MIN_SIMILARITY = 0.3;

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

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

/**
 * Cosine similarity over the intersection of dimension keys.
 * Mirrors Python's set(u) & set(v) intersection. Uses fsum for sums of products
 * and squares to match Python 3.12+ sum() compensated summation.
 */
function cosine(u: Record<string, number>, v: Record<string, number>): number {
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

interface CandidateEntry {
  id: number;
  cand_skills: Record<string, number>;
  cand_risk: number;
}

interface ScoredEntry {
  id: number;
  similarity: number;
  cand_risk: number;
}

export async function buildTransferPaths(
  indexes: Indexes,
  distRoot: string,
): Promise<TransferPathsBuildResult> {
  const riskById = new Map<number, number>();
  for (const [occId, entry] of indexes.latestScoreByOcc) {
    riskById.set(occId, entry.ai_risk);
  }

  const sectorById = new Map<number, string>();
  for (const [occId, a] of indexes.sectorByOcc) {
    sectorById.set(occId, a.sector_id);
  }

  const skillsById = new Map<number, Record<string, number>>();
  for (const [occId, occ] of indexes.occById) {
    if (occ.skills != null) skillsById.set(occId, occ.skills);
  }

  const outPaths: Record<string, unknown> = {};
  const fallbackCounts = {
    no_safer_in_sector: 0,
    no_skills: 0,
    primary: 0,
  };
  let noCandidatesAtAll = 0;

  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);

  for (const occId of sortedIds) {
    const sourceSector = sectorById.get(occId);
    const sourceRisk = riskById.get(occId);
    const sourceSkills = skillsById.get(occId);

    if (sourceSkills == null || sourceSector == null || sourceRisk == null) {
      outPaths[String(occId)] = {
        source_id: occId,
        candidates: [],
        fallback: 'no_skills',
      };
      fallbackCounts.no_skills += 1;
      continue;
    }

    // Pool: same sector, different occupation, has skills + risk
    const pool: CandidateEntry[] = [];
    for (const [candId, candSkills] of skillsById) {
      if (candId === occId) continue;
      if (sectorById.get(candId) !== sourceSector) continue;
      const candRisk = riskById.get(candId);
      if (candRisk == null) continue;
      pool.push({ id: candId, cand_skills: candSkills, cand_risk: candRisk });
    }

    // Primary: prefer SAFER candidates (cand_risk <= source_risk - MIN_RISK_DROP)
    const safer = pool.filter((c) => c.cand_risk <= sourceRisk - MIN_RISK_DROP);

    let chosenPool: CandidateEntry[];
    let fallbackLabel: string | null = null;
    if (safer.length > 0) {
      chosenPool = safer;
    } else {
      chosenPool = pool;
      fallbackLabel = 'no_safer_in_sector';
    }

    const scored: ScoredEntry[] = [];
    for (const c of chosenPool) {
      const sim = pythonRound(cosine(sourceSkills, c.cand_skills), 4);
      if (sim < MIN_SIMILARITY) continue;
      scored.push({ id: c.id, similarity: sim, cand_risk: c.cand_risk });
    }
    // Sort by similarity desc; matches Python's stable sort with key+reverse.
    // Python is stable; Array.prototype.sort in V8 is stable since Node 12.
    scored.sort((a, b) => b.similarity - a.similarity);
    const top = scored.slice(0, TOP_N);

    if (top.length === 0) {
      noCandidatesAtAll += 1;
      outPaths[String(occId)] = {
        source_id: occId,
        candidates: [],
        fallback: fallbackLabel ?? 'no_similar_in_sector',
      };
      continue;
    }

    const candidates = top.map((s) => {
      const candOcc = indexes.occById.get(s.id);
      return {
        id: s.id,
        title_ja: candOcc ? candOcc.title_ja : null,
        ai_risk: s.cand_risk,
        similarity: s.similarity,
        sector_id: sectorById.get(s.id) ?? null,
      };
    });

    const entry: Record<string, unknown> = {
      source_id: occId,
      candidates,
    };
    if (fallbackLabel) entry.fallback = fallbackLabel;
    outPaths[String(occId)] = entry;

    if (fallbackLabel) {
      fallbackCounts.no_safer_in_sector += 1;
    } else {
      fallbackCounts.primary += 1;
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
      top_n: TOP_N,
      min_risk_drop: MIN_RISK_DROP,
      min_similarity: MIN_SIMILARITY,
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
