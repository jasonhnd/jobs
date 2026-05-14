/**
 * src/views/skill.ts — graph → skill-ranking + treemap-summary adapters.
 *
 * Step 7: the 10 /ja/skills/[skill] routes and /ja/skills index now source
 * their data from the knowledge graph rather than reading
 * public/data.skills/<key>.json + public/data.treemap.json.
 *
 * skills-hub.buildSkillsBundle accepts an optional `loaders` object;
 * pages flip the loaders to the graph-backed ones below.
 *
 * The skill-ranking adapter replicates exactly what
 * src/data/projections/skills.ts emits: for each IPD skill key,
 * iterate every occupation, collect the (id, name_ja, score) triple
 * for that skill, and sort by score descending then id ascending.
 */

import type { KnowledgeGraph, OccupationId } from '@/graph';
import type { SkillRankingFileShape, TreemapRecordSummary } from '../lib/projection-schemas';
import { riskBand as legacyRiskBand } from '../data/lib/bands';

/**
 * For a given IPD skill key (e.g. 'critical_thinking'), enumerate every
 * occupation in the graph that has a score for that skill, returning a
 * pre-sorted SkillRankingFile.
 */
export function makeSkillRankingLoaderFromGraph(
  graph: KnowledgeGraph,
): (ipdKey: string) => SkillRankingFileShape {
  // Build a map (skillKey → ranking entries) once for efficiency.
  const byKey = new Map<string, Array<{ id: number; name_ja: string; score: number }>>();

  for (const [occId, occ] of graph.occupations) {
    const idNum = occId as unknown as number;
    for (const edge of graph.skillsOf(occId as OccupationId)) {
      const key = edge.to as unknown as string;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = [];
        byKey.set(key, bucket);
      }
      bucket.push({ id: idNum, name_ja: occ.titleJa, score: edge.weight });
    }
  }

  // Sort each bucket descending by score, ascending by id on ties
  // (matches src/data/projections/skills.ts ordering).
  for (const [, bucket] of byKey) {
    bucket.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id - b.id;
    });
  }

  // Skill labels: look up ja name for the IPD key (used as label_ja).
  const skillLabels = new Map<string, string>();
  for (const [id, node] of graph.skills) {
    skillLabels.set(String(id), node.nameJa);
  }

  return (ipdKey: string): SkillRankingFileShape => {
    const occupations = byKey.get(ipdKey) ?? [];
    return {
      skill_key: ipdKey,
      label_ja: skillLabels.get(ipdKey) ?? ipdKey,
      occupations,
    };
  };
}

/**
 * Build the Map<id, TreemapRecordSummary> that skill-hub / interest-hub
 * use to enrich the top-N occupations with ai_risk / sector / stats.
 */
export function makeTreemapSummaryFromGraph(
  graph: KnowledgeGraph,
): () => Map<number, TreemapRecordSummary> {
  let cached: Map<number, TreemapRecordSummary> | null = null;
  return () => {
    if (cached) return cached;
    const m = new Map<number, TreemapRecordSummary>();
    for (const [occId, occ] of graph.occupations) {
      const idNum = occId as unknown as number;
      const sectorId = graph.sectorOf(occId as OccupationId);
      const sector = sectorId ? graph.sectors.get(sectorId) : null;
      const aiScore = occ.aiRisk?.score ?? null;
      m.set(idNum, {
        id: idNum,
        ai_risk: aiScore,
        risk_band: legacyRiskBand(aiScore),
        workers: occ.stats?.workers ?? null,
        salary: occ.stats?.salaryManYen ?? null,
        sector_id: sectorId !== null ? (sectorId as unknown as string) : '_uncategorized',
        sector_ja: sector ? sector.nameJa : '未分類',
      });
    }
    cached = m;
    return m;
  };
}
