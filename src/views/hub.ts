/**
 * src/views/hub.ts — graph → DetailFileMin adapter for hub-family pages.
 *
 * Step 4 (partial): the hub-family pages (abilities/knowledge/values/
 * work-styles) historically consumed pre-projected detail JSONs through
 * `loadAllDetails()`. This module produces the same DetailFileMin[]
 * shape directly from the knowledge graph so those pages no longer
 * touch public/data.detail/*.json.
 *
 * Scope: only the fields the graph already exposes. Hub families that
 * still depend on graph-absent fields (training_pre/post, experience,
 * education_distribution, employment_type, related_certs_ja) keep using
 * the legacy `loadAllDetails()` until those edges are added to the graph.
 *
 * The mapping intentionally mirrors the legacy projection in
 * src/data/projections/detail.ts so byte-equivalent DetailFileMin[]
 * is produced and the SEO baseline diff stays clean.
 */

import type { KnowledgeGraph, OccupationId } from '@/graph';
import type { DetailFileMin } from '../data/lib/genre-hub';

type TopNEntry = { key: string; label_ja: string; score: number };

function riskBand(score: number | null): 'low' | 'mid' | 'high' | null {
  if (score === null || score === undefined) return null;
  if (score <= 3) return 'low';
  if (score <= 6) return 'mid';
  return 'high';
}

function topN(
  edges: ReadonlyArray<{ to: string | { toString(): string }; weight: number }>,
  labelMap: ReadonlyMap<string, { nameJa: string }>,
  n: number,
): TopNEntry[] | null {
  if (edges.length === 0) return null;
  const sorted = [...edges].sort((a, b) => b.weight - a.weight);
  return sorted.slice(0, n).map((e) => {
    const key = String(e.to);
    const label = labelMap.get(key);
    return {
      key,
      label_ja: label ? label.nameJa : key,
      score: e.weight,
    };
  });
}

function nodeLabelMap<T extends { id: unknown; nameJa: string }>(
  src: ReadonlyMap<unknown, T>,
): Map<string, { nameJa: string }> {
  const m = new Map<string, { nameJa: string }>();
  for (const [id, node] of src) m.set(String(id), { nameJa: node.nameJa });
  return m;
}

/**
 * Build DetailFileMin[] from the graph, suitable for genre-hub.buildGenreResult().
 *
 * Populates: id, title.ja, ai_risk, risk_band, stats, sector, skills_top10,
 * knowledge_top5, abilities_top5, work_values_top5, work_characteristics_top5.
 *
 * NOT populated (set to null for compatibility, but hub families relying on
 * these still need the legacy loadAllDetails path):
 *   - training_pre_top5 / training_post_top5 / experience_top5
 *   - education_distribution / employment_type
 *   - related_certs_ja
 */
export function loadGraphAdaptedDetails(graph: KnowledgeGraph): DetailFileMin[] {
  const skillLabels = nodeLabelMap(graph.skills as ReadonlyMap<unknown, { id: unknown; nameJa: string }>);
  const knowledgeLabels = nodeLabelMap(graph.knowledge as ReadonlyMap<unknown, { id: unknown; nameJa: string }>);
  const abilityLabels = nodeLabelMap(graph.abilities as ReadonlyMap<unknown, { id: unknown; nameJa: string }>);
  const workValueLabels = nodeLabelMap(graph.workValues as ReadonlyMap<unknown, { id: unknown; nameJa: string }>);
  const workCharLabels = nodeLabelMap(graph.workCharacteristics as ReadonlyMap<unknown, { id: unknown; nameJa: string }>);

  const out: DetailFileMin[] = [];
  for (const [occId, occ] of graph.occupations) {
    const occIdNum = occId as unknown as number;
    const secId = graph.sectorOf(occId as OccupationId);
    const sectorNode = secId ? graph.sectors.get(secId) : null;

    out.push({
      id: occIdNum,
      title: { ja: occ.titleJa },
      ai_risk: occ.aiRisk ? { score: occ.aiRisk.score } : null,
      risk_band: riskBand(occ.aiRisk?.score ?? null),
      stats: occ.stats
        ? {
            salary_man_yen: occ.stats.salaryManYen ?? null,
            workers: occ.stats.workers ?? null,
            monthly_hours: occ.stats.monthlyHours ?? null,
            average_age: occ.stats.averageAge ?? null,
            recruit_ratio: occ.stats.recruitRatio ?? null,
            recruit_wage_man_yen: occ.stats.recruitWageManYen ?? null,
          }
        : null,
      sector: sectorNode
        ? {
            id: sectorNode.id as unknown as string,
            ja: sectorNode.nameJa,
          }
        : null,
      skills_top10: topN(graph.skillsOf(occId as OccupationId), skillLabels, 10),
      knowledge_top5: topN(graph.knowledgeOf(occId as OccupationId), knowledgeLabels, 5),
      abilities_top5: topN(graph.abilitiesOf(occId as OccupationId), abilityLabels, 5),
      work_values_top5: topN(graph.workValuesOf(occId as OccupationId), workValueLabels, 5),
      work_characteristics_top5: topN(
        graph.workCharacteristicsOf(occId as OccupationId),
        workCharLabels,
        5,
      ),
      // Not yet in graph — kept null for compatibility.
      training_pre_top5: null,
      training_post_top5: null,
      experience_top5: null,
      education_distribution: null,
      employment_type: null,
      related_certs_ja: [],
    });
  }
  // Order matters for downstream sort stability — match legacy occ-id ascending.
  out.sort((a, b) => a.id - b.id);
  return out;
}
