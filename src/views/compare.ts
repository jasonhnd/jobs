/**
 * src/views/compare.ts — graph → compare-hub.DetailFile adapter.
 *
 * Step 6: the compare-hub pages (12 routes under /ja/compare/[pair])
 * now derive their per-side DetailFile records from the knowledge graph
 * instead of reading public/data.detail/<padded>.json.
 *
 * compare-hub.ts is left untouched aside from accepting a `loader`
 * dependency-injection parameter that defaults to the legacy file path.
 * Pages flip the loader to this graph-based one.
 */

import type { KnowledgeGraph, OccupationId } from '@/graph';
import type { DetailFile } from './compare-hub';

function riskBand(score: number | null): string | undefined {
  if (score === null) return undefined;
  if (score <= 3) return 'low';
  if (score <= 6) return 'mid';
  return 'high';
}

/**
 * Returns a `(id: number) => DetailFile` function backed by `graph`.
 * Pre-builds DetailFile records for every occupation up front so repeated
 * calls within one render pass are O(1) lookups.
 */
export function makeCompareLoaderFromGraph(
  graph: KnowledgeGraph,
): (id: number) => DetailFile {
  // Pre-build label map (same as src/views/hub.ts approach).
  const skillLabels = new Map<string, string>();
  for (const [id, node] of graph.skills) {
    skillLabels.set(String(id), node.nameJa);
  }

  const cache = new Map<number, DetailFile>();
  for (const [occId, occ] of graph.occupations) {
    const idNum = Number(occId);
    const secId = graph.sectorOf(occId as OccupationId);
    const sector = secId ? graph.sectors.get(secId) : null;

    // Top 10 skills computed from inline weighted edges, ja-labeled.
    const skillEdges = [...graph.skillsOf(occId as OccupationId)]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
    const skills_top10 = skillEdges.map((e) => {
      const key = String(e.to);
      return {
        key,
        label_ja: skillLabels.get(key) ?? key,
        score: e.weight,
      };
    });

    const record: DetailFile = {
      id: idNum,
      title: { ja: occ.titleJa },
      ai_risk: occ.aiRisk
        ? {
            score: occ.aiRisk.score,
            rationale_ja: occ.aiRisk.rationaleJa,
          }
        : undefined,
      risk_band: riskBand(occ.aiRisk?.score ?? null),
      description: {
        summary_ja: occ.description.summaryJa ?? undefined,
      },
      stats: occ.stats
        ? {
            salary_man_yen: occ.stats.salaryManYen,
            workers: occ.stats.workers,
            monthly_hours: occ.stats.monthlyHours,
            average_age: occ.stats.averageAge,
            recruit_ratio: occ.stats.recruitRatio,
          }
        : undefined,
      sector: sector
        ? { id: String(sector.id), ja: sector.nameJa }
        : undefined,
      related_certs_ja: occ.relatedCertsJa as string[],
      skills_top10,
    };
    cache.set(idNum, record);
  }

  return (id: number): DetailFile => {
    const cached = cache.get(id);
    if (!cached) {
      throw new Error(`compare graph loader: occupation id ${id} not in graph`);
    }
    return cached;
  };
}
