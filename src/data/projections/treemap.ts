/**
 * data.treemap.json projection — per docs/DATA_ARCHITECTURE.md §6.1.
 *
 * Status: Implemented
 * Consumer: homepage desktop treemap canvas + per-tile tooltip, homepage
 *           mobile TOP 10 via data.top10.json, mobile-web ② 職業マップ
 *           + ⑦ ランキング (sector grouping + bands).
 * Shape:    data.treemap.json is an array of objects (one per occupation) for
 *           legacy data.json compatibility. data.top10.json is a 10-row subset
 *           with only the mobile carousel fields.
 *
 * Filtering:
 *   Emit only occupations that have BOTH stats_legacy and a latest AI score.
 *
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { demandBand, riskBand, workforceBand } from '../lib/bands.js';
import { bankerRound } from '../lib/banker-round.js';
import { nowIso } from '../../lib/now.js';

// 2026-05-17 CODE-011 fix: single source of truth for distribution
// labels moved to src/data/domain/distribution-labels.ts. Re-imported
// here to keep this file's existing local-name usage stable.
import {
  EDU_LABELS_EN_TO_JA as EDU_KEY_EN_TO_JA,
  EMP_LABELS_EN_TO_JA as EMP_KEY_EN_TO_JA,
} from '../domain/distribution-labels.js';

export interface TreemapBuildResult {
  files: string[];
  rows: number;
  top10Rows: number;
}

interface TreemapRecord {
  id: number;
  name_ja: string;
  salary: number | null;
  workers: number | null;
  hours: number | null;
  age: number | null;
  recruit_wage: number | null;
  recruit_ratio: number | null;
  hourly_wage: null;
  ai_risk: number | null;
  ai_rationale_ja: string;
  education_pct: Record<string, number> | null;
  employment_type: Record<string, number> | null;
  sector_id: string | null;
  sector_ja: string | null;
  hue: string | null;
  risk_band: string | null;
  workforce_band: string | null;
  demand_band: string | null;
  url: string;
}

interface Top10Record {
  id: number;
  name_ja: string;
  salary: number | null;
  workers: number | null;
  ai_risk: number | null;
  ai_rationale_ja: string;
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
    out[jaKey] = bankerRound(frac * 100, 1);
  }
  return out;
}

export async function buildTreemap(
  indexes: Indexes,
  distRoot: string,
): Promise<TreemapBuildResult> {
  const sectorById = new Map<string, (typeof indexes.sectors)[number]>();
  for (const s of indexes.sectors) sectorById.set(s.id, s);

  const records: TreemapRecord[] = [];
  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);

  for (const occId of sortedIds) {
    const occ = indexes.occById.get(occId)!;
    const stats = indexes.statsById.get(occId);
    const score = indexes.canonicalScoreByOcc.get(occId);
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

  const top10 = records
    .filter((rec) => rec.ai_risk != null)
    .sort((a, b) => {
      const riskDiff = (b.ai_risk ?? -Infinity) - (a.ai_risk ?? -Infinity);
      return riskDiff !== 0 ? riskDiff : a.id - b.id;
    })
    .slice(0, 10)
    .map((rec): Top10Record => ({
      id: rec.id,
      name_ja: rec.name_ja,
      salary: rec.salary,
      workers: rec.workers,
      ai_risk: rec.ai_risk,
      ai_rationale_ja: rec.ai_rationale_ja,
    }));

  const top10Path = join(distRoot, 'data.top10.json');
  await writeFile(
    top10Path,
    JSON.stringify(top10) + '\n',
    'utf-8',
  );

  const metaPath = join(distRoot, 'data.treemap.meta.json');
  const meta = {
    schema_version: '2.0',
    generated_at: nowIso(),
    record_count: records.length,
    top10_count: top10.length,
    filter: 'occupations with stats_legacy AND latest ai score',
  };
  await writeFile(
    metaPath,
    JSON.stringify(meta, null, 2) + '\n',
    'utf-8',
  );

  return { files: [dataPath, top10Path, metaPath], rows: records.length, top10Rows: top10.length };
}
