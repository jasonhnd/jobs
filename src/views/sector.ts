/**
 * src/views/sector.ts — Layer 3 views for /ja/sectors and /ja/sectors/[sector].
 *
 * Pure functions: (graph, params) → typed view object. No I/O, no HTML, no
 * mutation. See docs/architecture.md §2.3 for the layer contract.
 *
 * These views replace the per-page assembly that used to live in:
 *   - src/pages/ja/sectors/index.astro     (read public/data.sectors.json)
 *   - src/pages/ja/sectors/[sector].astro  (read public/data.detail/*.json)
 *
 * Both pages now bind the view result to a template. The legacy
 * projection JSONs continue to be produced by build:data; they're still
 * consumed by the OG endpoint (Step 9) until that's migrated.
 */

import type {
  KnowledgeGraph,
  OccupationNode,
  SectorNode,
  HueBand,
} from '@/graph';
import type { OccupationId, SectorId } from '@/graph';

// ─── shared shapes ───────────────────────────────────────────────

export type RiskBand = 'low' | 'mid' | 'high';

/**
 * Per-occupation summary as the sector pages consume it. Mirrors the legacy
 * OccRow that the page-internal assembly produced.
 */
export interface SectorOccupationSummary {
  id: OccupationId;
  titleJa: string | null;
  titleEn: string | null;
  aiRisk: number | null;
  riskBand: RiskBand | null;
  workers: number | null;
  salary: number | null;
  monthlyHours: number | null;
  averageAge: number | null;
  recruitRatio: number | null;
  sectorId: SectorId | null;
}

// ─── sector-index view ───────────────────────────────────────────

export interface SectorSampleOccupation {
  /** Numeric occupation id (matches OccupationId / `/ja/<id>` detail-page URL). */
  id: number;
  titleJa: string | null;
}

export interface SectorIndexEntry {
  id: SectorId;
  ja: string;
  hue: HueBand;
  descriptionJa: string | null;
  occupationCount: number;
  meanAiRisk: number | null;
  totalWorkforce: number;
  /** Legacy: titles only (kept for backward compat). */
  sampleTitlesJa: readonly string[];
  /** RA-129: representative occupations with ids, so the index card can render
   *  them as inline links to `/ja/<id>` instead of plain text. Same order +
   *  selection as sampleTitlesJa (top 3 by workers, then by id). */
  sampleEntries: readonly SectorSampleOccupation[];
}

export interface SectorIndexView {
  /** All 16 sectors in their canonical source order. */
  sectors: readonly SectorIndexEntry[];
  /** Total occupations across all sectors (= scored + uncategorized). */
  totalOccupations: number;
}

export function sectorIndexView(graph: KnowledgeGraph): SectorIndexView {
  // Sum of categorized occupations (matches the legacy data.sectors.json
  // aggregation — excludes any `_uncategorized` ones). Equal to
  // graph.occupations.size today because every occ resolves; preserving
  // the per-sector sum keeps SEO copy ("日本の{N}職業を…") stable even
  // if an occupation later lands in the uncategorized bucket.
  let totalOccupations = 0;
  const entries: SectorIndexEntry[] = [];

  for (const [secId, sec] of graph.sectors) {
    const occIds = graph.occupationsBySector(secId);
    const aiRisks: number[] = [];
    let totalWorkforce = 0;
    for (const occId of occIds) {
      const occ = graph.occupations.get(occId);
      if (!occ) continue;
      if (occ.aiRisk !== null) aiRisks.push(occ.aiRisk.score);
      totalWorkforce += occ.stats?.workers ?? 0;
    }
    const meanAiRisk = aiRisks.length
      ? aiRisks.reduce((a, b) => a + b, 0) / aiRisks.length
      : null;

    // Top 3 by workers (then by id) for the "sample titles" preview line on
    // each card — matches the legacy aggregation produced into data.sectors.json.
    const byWorkers = [...occIds]
      .map(id => graph.occupations.get(id))
      .filter((o): o is OccupationNode => o !== undefined)
      .sort((a, b) => {
        const wb = b.stats?.workers ?? 0;
        const wa = a.stats?.workers ?? 0;
        if (wb !== wa) return wb - wa;
        return (a.id as unknown as number) - (b.id as unknown as number);
      });
    const topSamples = byWorkers.slice(0, 3);
    const sampleTitlesJa = topSamples.map(o => o.titleJa);
    const sampleEntries: SectorSampleOccupation[] = topSamples.map(o => ({
      id: o.id as unknown as number,
      titleJa: o.titleJa,
    }));

    entries.push({
      id: secId,
      ja: sec.nameJa,
      hue: sec.hue,
      descriptionJa: sec.descriptionJa,
      occupationCount: occIds.length,
      meanAiRisk,
      totalWorkforce,
      sampleTitlesJa,
      sampleEntries,
    });
    totalOccupations += occIds.length;
  }

  return { sectors: entries, totalOccupations };
}

// ─── sector-detail view ──────────────────────────────────────────

export interface SectorRelatedEntry {
  id: SectorId;
  ja: string;
  occupationCount: number;
}

export interface SectorDetailView {
  /** The sector this page is about. */
  sector: SectorNode;
  /** Occupations in this sector, in source order. */
  occupations: readonly SectorOccupationSummary[];
  /** Every occupation across the site — used for site-baseline normalization. */
  allOccupations: readonly SectorOccupationSummary[];
  /** Other sectors for the "related sectors" footer block. */
  relatedSectors: readonly SectorRelatedEntry[];
}

export function sectorDetailView(graph: KnowledgeGraph, sectorId: SectorId): SectorDetailView {
  const sector = graph.sectors.get(sectorId);
  if (!sector) throw new Error(`sectorDetailView: unknown sectorId '${String(sectorId)}'`);

  const allOccupations: SectorOccupationSummary[] = [];
  for (const [occId, occ] of graph.occupations) {
    allOccupations.push(summarizeOccupation(occId, occ, graph.sectorOf(occId)));
  }

  const occupations = allOccupations.filter(o => o.sectorId === sectorId);

  const relatedSectors: SectorRelatedEntry[] = [];
  for (const [otherId, otherSec] of graph.sectors) {
    if (otherId === sectorId) continue;
    relatedSectors.push({
      id: otherId,
      ja: otherSec.nameJa,
      occupationCount: graph.occupationsBySector(otherId).length,
    });
  }

  return { sector, occupations, allOccupations, relatedSectors };
}

// ─── helpers ─────────────────────────────────────────────────────

function summarizeOccupation(
  id: OccupationId,
  occ: OccupationNode,
  sectorId: SectorId | null,
): SectorOccupationSummary {
  const aiRisk = occ.aiRisk?.score ?? null;
  return {
    id,
    titleJa: occ.titleJa,
    titleEn: occ.titleEn,
    aiRisk,
    riskBand: aiRisk === null ? null : riskBand(aiRisk),
    workers: occ.stats?.workers ?? null,
    salary: occ.stats?.salaryManYen ?? null,
    monthlyHours: occ.stats?.monthlyHours ?? null,
    averageAge: occ.stats?.averageAge ?? null,
    recruitRatio: occ.stats?.recruitRatio ?? null,
    sectorId,
  };
}

function riskBand(score: number): RiskBand {
  if (score <= 3) return 'low';
  if (score <= 6) return 'mid';
  return 'high';
}
