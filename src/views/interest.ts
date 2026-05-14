/**
 * src/views/interest.ts — graph → holland-rows + treemap-summary adapters.
 *
 * Step 7: the 6 /ja/interests/[type] routes and /ja/interests index now
 * source their data from the knowledge graph rather than reading
 * public/data.holland.json + public/data.treemap.json.
 *
 * interests.buildInterests accepts an optional `loaders` object;
 * pages flip the loaders to the graph-backed ones below.
 *
 * The Holland adapter replicates what src/data/projections/holland.ts
 * emits: one row per occupation with its RIASEC scores read from the
 * occupation.interests inline distribution (EN keys 'realistic',
 * 'investigative', 'artistic', 'social', 'enterprising', 'conventional').
 */

import type { KnowledgeGraph, OccupationId } from '@/graph';
import type {
  HollandRow,
  TreemapRecord as InterestsTreemapRecord,
} from './interests';
import { riskBand as legacyRiskBand } from '../data/lib/bands';

/** EN-key → RIASEC letter mapping. */
const KEY_TO_LETTER: Record<string, keyof Omit<HollandRow, 'id' | 'name_ja'>> = {
  realistic:     'R',
  investigative: 'I',
  artistic:      'A',
  social:        'S',
  enterprising:  'E',
  conventional:  'C',
};

export function makeHollandLoaderFromGraph(
  graph: KnowledgeGraph,
): () => HollandRow[] {
  let cached: HollandRow[] | null = null;
  return () => {
    if (cached) return cached;
    const out: HollandRow[] = [];
    for (const [occId, occ] of graph.occupations) {
      const idNum = occId as unknown as number;
      // Initialize with all 6 letters null; fill from interest edges.
      const row: HollandRow = {
        id: idNum,
        name_ja: occ.titleJa,
        R: null, I: null, A: null, S: null, E: null, C: null,
      };
      for (const edge of graph.interestsOf(occId as OccupationId)) {
        const key = edge.to as unknown as string;
        const letter = KEY_TO_LETTER[key];
        if (letter) row[letter] = edge.weight;
      }
      out.push(row);
    }
    out.sort((a, b) => a.id - b.id);
    cached = out;
    return cached;
  };
}

/**
 * The TreemapRecord shape interests.ts uses is a private re-declaration
 * of the same fields as the schema-level TreemapRecordSummary. Produce
 * a Map<id, …> from graph.
 */
export function makeInterestsTreemapFromGraph(
  graph: KnowledgeGraph,
): () => Map<number, InterestsTreemapRecord> {
  let cached: Map<number, InterestsTreemapRecord> | null = null;
  return () => {
    if (cached) return cached;
    const m = new Map<number, InterestsTreemapRecord>();
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
