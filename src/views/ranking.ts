/**
 * src/views/ranking.ts — graph → rankings.Occupation adapter.
 *
 * Step 5: the 9 /ja/rankings/[type] routes (+ index) now derive their
 * Occupation[] from the knowledge graph rather than reading the
 * data.treemap.json projection + data.detail/<id>.json certs files.
 *
 * rankings.ts unchanged except for accepting an optional loader on
 * buildRankings(). Pages flip the loader to this graph-based one.
 *
 * Important: rankings.ts uses JA-keyed education_pct and employment_type
 * (e.g. '高卒', '正規の職員、従業員'). The legacy treemap projection
 * translates EN → JA at projection time; we replicate the same map
 * here so output stays byte-identical.
 */

import type { KnowledgeGraph, OccupationId } from '@/graph';
import type { Occupation } from '../data/lib/rankings';
import { riskBand as legacyRiskBand, demandBand as legacyDemandBand } from '../data/lib/bands';

// Mirror of src/data/projections/treemap.ts:EDU_KEY_EN_TO_JA. Kept local
// because the projection module is not in the architecture's public
// surface; copying 8 lines here avoids a cross-layer import.
const EDU_KEY_EN_TO_JA: Record<string, string> = {
  below_high_school: '高卒未満',
  high_school: '高卒',
  vocational_school: '専門学校卒',
  junior_college: '短大卒',
  technical_college: '高専卒',
  university: '大卒',
  masters: '修士課程卒（修士と同等の専門職学位を含む）',
  doctorate: '博士課程卒',
};

const EMP_KEY_EN_TO_JA: Record<string, string> = {
  regular_employee: '正規の職員、従業員',
  part_time: 'パートタイマー',
  dispatched: '派遣社員',
  contract: '契約社員、期間従業員',
  self_employed_freelance: '自営、フリーランス',
  executive: '経営層（役員等）',
  casual_non_student: 'アルバイト（学生以外）',
  casual_student: 'アルバイト（学生）',
  unknown: 'わからない',
  other: 'その他',
};

function convertEnToJaPct(
  enDict: Record<string, number> | null,
  mapping: Record<string, string>,
): Record<string, number> | null {
  if (enDict == null) return null;
  const out: Record<string, number> = {};
  for (const [enKey, frac] of Object.entries(enDict)) {
    const jaKey = mapping[enKey];
    if (jaKey == null) continue;
    // Banker's rounding to 1 decimal place — matches src/data/lib/banker-round.ts.
    out[jaKey] = bankerRound1(frac * 100);
  }
  return out;
}

/** Banker's rounding to 1 decimal place (half-to-even). */
function bankerRound1(n: number): number {
  const scaled = n * 10;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let rounded: number;
  if (diff > 0.5) rounded = floor + 1;
  else if (diff < 0.5) rounded = floor;
  else rounded = floor % 2 === 0 ? floor : floor + 1;
  return rounded / 10;
}

// Reuse the legacy band functions to guarantee output parity. Importing
// pure logic from src/data/lib is permitted under the layer policy
// (those modules are no-HTML, no-I/O helpers).

/**
 * Build the full Occupation[] that buildRankings() expects, sourced from
 * graph instead of treemap.json + per-occupation cert files.
 */
export function loadOccupationsFromGraph(graph: KnowledgeGraph): Occupation[] {
  const out: Occupation[] = [];
  for (const [occId, occ] of graph.occupations) {
    const idNum = occId as unknown as number;
    const sectorId = graph.sectorOf(occId as OccupationId);
    const sector = sectorId ? graph.sectors.get(sectorId) : null;
    const aiScore = occ.aiRisk?.score ?? null;
    const recruitWage = occ.stats?.recruitWageManYen ?? null;
    // hourly_wage = recruit_wage_man_yen × 10000 / 160h (matches legacy).
    const hourlyWage = recruitWage !== null ? (recruitWage * 10000) / 160 : null;

    out.push({
      id: idNum,
      title_ja: occ.titleJa,
      ai_risk: aiScore,
      risk_band: legacyRiskBand(aiScore),
      workers: occ.stats?.workers ?? null,
      salary: occ.stats?.salaryManYen ?? null,
      monthly_hours: occ.stats?.monthlyHours ?? null,
      average_age: occ.stats?.averageAge ?? null,
      recruit_wage: recruitWage,
      recruit_ratio: occ.stats?.recruitRatio ?? null,
      demand_band: legacyDemandBand(occ.stats?.recruitRatio ?? null),
      sector_id: sectorId !== null ? (sectorId as unknown as string) : '_uncategorized',
      sector_ja: sector ? sector.nameJa : '未分類',
      education_pct: convertEnToJaPct(occ.educationDistribution, EDU_KEY_EN_TO_JA),
      employment_type: convertEnToJaPct(occ.employmentType, EMP_KEY_EN_TO_JA),
      certs: occ.relatedCertsJa as string[],
      hourly_wage: hourlyWage,
    });
  }
  // Sort by id ascending — matches legacy treemap order.
  out.sort((a, b) => a.id - b.id);
  return out;
}
