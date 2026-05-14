/**
 * src/views/occupation-detail.ts — graph → adapt-detail.DetailFile adapter.
 *
 * Step 8: the 556 /ja/[id] occupation detail pages now source their
 * DetailFile records from the knowledge graph rather than reading
 * public/data.detail/<id>.json. The auxiliary profile5 + transfer_paths
 * projections are still consumed file-side (deferred to a later step).
 *
 * Output is identical to the legacy projection (src/data/projections/
 * detail.ts) for every field adapt-detail.adaptDetailFile reads. The
 * SEO baseline diff verifies byte-equivalence across all 556 pages.
 */

import type { KnowledgeGraph, OccupationId } from '@/graph';
import type { DetailFile, TopNEntry } from './adapt-detail';
import {
  riskBand as legacyRiskBand,
  demandBand as legacyDemandBand,
  workforceBand as legacyWorkforceBand,
} from '../data/lib/bands';

function topN(
  edges: ReadonlyArray<{ to: string | { toString(): string }; weight: number }>,
  labelMap: ReadonlyMap<string, string>,
  n: number,
): TopNEntry[] | null {
  if (edges.length === 0) return null;
  const sorted = [...edges].sort((a, b) => b.weight - a.weight);
  return sorted.slice(0, n).map((e) => {
    const key = String(e.to);
    return {
      key,
      label_ja: labelMap.get(key) ?? key,
      score: e.weight,
    };
  });
}

function labelMap<T extends { nameJa: string }>(
  src: ReadonlyMap<unknown, T>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const [id, node] of src) m.set(String(id), node.nameJa);
  return m;
}

/**
 * Build a complete DetailFile from graph for a given occupation id.
 * Mirrors src/data/projections/detail.ts exactly for every field
 * adapt-detail.adaptDetailFile downstream consumes.
 */
export function buildOccupationDetailFile(
  graph: KnowledgeGraph,
  occId: OccupationId,
): DetailFile {
  const occ = graph.occupations.get(occId);
  if (!occ) throw new Error(`buildOccupationDetailFile: occupation ${String(occId)} not in graph`);

  const sectorId = graph.sectorOf(occId);
  const sector = sectorId ? graph.sectors.get(sectorId) : null;
  const aiScore = occ.aiRisk?.score ?? null;

  const skillLabels = labelMap(graph.skills as ReadonlyMap<unknown, { nameJa: string }>);
  const knowledgeLabels = labelMap(graph.knowledge as ReadonlyMap<unknown, { nameJa: string }>);
  const abilityLabels = labelMap(graph.abilities as ReadonlyMap<unknown, { nameJa: string }>);

  return {
    id: occ.id as unknown as number,
    schema_version: '1.2',
    title: {
      ja: occ.titleJa,
      aliases_ja: [...occ.aliasesJa],
    },
    description: {
      summary_ja: occ.description.summaryJa ?? null,
      what_it_is_ja: occ.description.whatItIsJa ?? null,
      how_to_become_ja: occ.description.howToBecomeJa ?? null,
      working_conditions_ja: occ.description.workingConditionsJa ?? null,
    },
    classifications: {
      mhlw_main: occ.classifications.mhlwMain ?? undefined,
      mhlw_all: [...occ.classifications.mhlwAll],
      jsoc_main: occ.classifications.jsocMain ?? undefined,
      jsoc_all: [...occ.classifications.jsocAll],
    },
    sector: sector
      ? { id: sector.id as unknown as string, ja: sector.nameJa }
      : undefined,
    risk_band: legacyRiskBand(aiScore),
    workforce_band: legacyWorkforceBand(occ.stats?.workers ?? null),
    demand_band: legacyDemandBand(occ.stats?.recruitRatio ?? null),
    ai_risk: occ.aiRisk
      ? {
          score: occ.aiRisk.score,
          model: occ.aiRisk.model,
          scored_at: occ.aiRisk.date,
          rationale_ja: occ.aiRisk.rationaleJa,
          // rationale_long_ja / displaceable_tasks_ja / resilient_tasks_ja /
          // horizon_5y_ja: not currently emitted by the projection either
          // (all null/empty in public/data.detail/*.json). Adapter handles
          // null gracefully.
        }
      : undefined,
    stats: occ.stats
      ? {
          salary_man_yen: occ.stats.salaryManYen,
          workers: occ.stats.workers,
          monthly_hours: occ.stats.monthlyHours,
          average_age: occ.stats.averageAge,
          recruit_wage_man_yen: occ.stats.recruitWageManYen,
          recruit_ratio: occ.stats.recruitRatio,
        }
      : undefined,
    skills_top10:    topN(graph.skillsOf(occId),    skillLabels,    10) ?? undefined,
    knowledge_top5:  topN(graph.knowledgeOf(occId), knowledgeLabels, 5) ?? undefined,
    abilities_top5:  topN(graph.abilitiesOf(occId), abilityLabels,   5) ?? undefined,
    tasks_count: occ.tasksCount,
    tasks_lead_ja: occ.tasksLeadJa,
    related_orgs: occ.relatedOrgs.map(o => ({ name_ja: o.nameJa, url: o.url })),
    related_certs_ja: [...occ.relatedCertsJa],
    data_source_versions: {
      ipd_numeric: occ.dataSourceVersions.ipdNumeric,
      ipd_description: occ.dataSourceVersions.ipdDescription,
      ipd_retrieved_at: occ.dataSourceVersions.ipdRetrievedAt,
    },
  } as DetailFile;
}
