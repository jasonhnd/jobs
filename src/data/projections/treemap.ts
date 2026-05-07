/**
 * data.treemap.json projection — per docs/DATA_ARCHITECTURE.md §6.1.
 *
 * Status: Implemented
 * Consumer: index.html (desktop + mobile treemap canvas + per-tile tooltip),
 *           mobile-web ② 職業マップ + ⑦ ランキング (sector grouping + bands).
 * Shape:    array of objects (one per occupation) — top-level array for drop-in
 *           compatibility with legacy data.json.
 *
 * Filtering:
 *   Emit only occupations that have BOTH stats_legacy and a latest AI score.
 *
 * Migrated from scripts/projections/treemap.py.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { demandBand, riskBand, workforceBand } from '../lib/bands.js';
import { pythonRound } from '../lib/python-round.js';

// en_key → JA-key reverse maps (only for fields index.html expects in JA-key form).
const EDU_KEY_EN_TO_JA: Record<string, string> = {
  below_high_school: '高卒未満',
  high_school: '高卒',
  vocational_school: '専門学校卒',
  junior_college: '短大卒',
  technical_college: '高専卒',
  university: '大卒',
  masters: '修士課程卒（修士と同等の専門職学位を含む）',
  doctorate: '博士課程卒',
  // "unknown" (わからない) intentionally excluded — matches legacy data.json shape.
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

export interface TreemapBuildResult {
  files: string[];
  rows: number;
}

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

/** Convert {en_key: 0.0-1.0} → {ja_key: 0-100}, dropping keys not in mapping. */
function convertToLegacyPct(
  enDict: Record<string, number> | null | undefined,
  mapping: Record<string, string>,
): Record<string, number> | null {
  if (enDict == null) return null;
  const out: Record<string, number> = {};
  for (const [enKey, frac] of Object.entries(enDict)) {
    const jaKey = mapping[enKey];
    if (jaKey == null) continue;
    out[jaKey] = pythonRound(frac * 100, 1);
  }
  return out;
}

export async function buildTreemap(
  indexes: Indexes,
  distRoot: string,
): Promise<TreemapBuildResult> {
  const sectorById = new Map<string, (typeof indexes.sectors)[number]>();
  for (const s of indexes.sectors) sectorById.set(s.id, s);

  const records: unknown[] = [];
  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);

  for (const occId of sortedIds) {
    const occ = indexes.occById.get(occId)!;
    const stats = indexes.statsById.get(occId);
    const score = indexes.latestScoreByOcc.get(occId);
    // Filter: treemap needs both stats AND ai_risk.
    if (!stats || !score) continue;

    const assignment = indexes.sectorByOcc.get(occId);
    const sectorId = assignment ? assignment.sector_id : null;
    const sectorDef = sectorId ? sectorById.get(sectorId) : null;

    records.push({
      id: occId,
      name_ja: occ.title_ja,

      // Stats — flat fields, legacy field names preserved
      salary: stats.salary_man_yen ?? null,
      workers: stats.workers ?? null,
      hours: stats.monthly_hours ?? null,
      age: stats.average_age ?? null,
      recruit_wage: stats.recruit_wage_man_yen ?? null,
      recruit_ratio: stats.recruit_ratio ?? null,
      hourly_wage: null,

      // AI risk
      ai_risk: score.ai_risk,
      ai_rationale_ja: score.rationale_ja,

      // Distributions — converted to legacy JA-key + percentage form
      education_pct: convertToLegacyPct(occ.education_distribution, EDU_KEY_EN_TO_JA),
      employment_type: convertToLegacyPct(occ.employment_type, EMP_KEY_EN_TO_JA),

      // ── v1.1.0 additive: sector + multi-axis bands ──
      sector_id: sectorId,
      sector_ja: sectorDef ? sectorDef.ja : null,
      hue: sectorDef ? sectorDef.hue : null,
      risk_band: riskBand(score.ai_risk),
      workforce_band: workforceBand(stats.workers ?? null),
      demand_band: demandBand(stats.recruit_ratio ?? null),

      url: occ.url,
    });
  }

  const dataPath = join(distRoot, 'data.treemap.json');
  await writeFile(
    dataPath,
    JSON.stringify(records) + '\n',
    'utf-8',
  );

  const metaPath = join(distRoot, 'data.treemap.meta.json');
  const meta = {
    schema_version: '2.0',
    generated_at: nowIso(),
    record_count: records.length,
    filter: 'occupations with stats_legacy AND latest ai score',
  };
  await writeFile(
    metaPath,
    JSON.stringify(meta, null, 2) + '\n',
    'utf-8',
  );

  return { files: [dataPath, metaPath], rows: records.length };
}
