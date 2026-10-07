/** L3 consistency checks for treemap projections. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { riskBand } from '../lib/bands.js';
import { readJsonOrFail, type Report } from './shared.js';

const TREEMAP_REQUIRED_KEYS = new Set([
  'id', 'name_ja',
  'salary', 'workers', 'hours', 'age', 'recruit_wage', 'recruit_ratio', 'hourly_wage',
  'ai_risk', 'ai_rationale_ja',
  'education_pct', 'employment_type',
  'url',
]);

const RISK_TIERS = ['low', 'mid', 'high'] as const;

const JAPAN_WORKFORCE_LIMIT = 70_000_000;

const MIN_OCCUPATIONS_PER_SECTOR = 5;

const VALID_HUE = new Set(['safe', 'mid', 'warm', 'risk']);

const VALID_RISK_BAND = new Set(['low', 'mid', 'high', null]);

const VALID_WORKFORCE_BAND = new Set(['small', 'mid', 'large', null]);

const VALID_DEMAND_BAND = new Set(['cold', 'normal', 'hot', null]);

interface SectorEntry {
  id?: string;
  hue?: string;
  ja?: string;
  occupation_count?: number;
}

/**
 * `expectedCount` is the number of source occupation files. When given, a
 * treemap with any other record count fails (an empty or truncated
 * projection must not pass the gate).
 */
export async function checkTreemap(distRoot: string, r: Report, expectedCount?: number): Promise<unknown[]> {
  const f = join(distRoot, 'data.treemap.json');
  if (!existsSync(f)) return [];
  const result = await readJsonOrFail<unknown>(r, f, `data.treemap.json is invalid JSON`);
  if (!result.ok) return [];
  let data: typeof result.data;
  data = result.data;

  if (!Array.isArray(data)) {
    r.fail(`data.treemap.json must be a top-level array (got ${typeof data})`);
    return [];
  }
  if (expectedCount !== undefined && data.length !== expectedCount) {
    r.fail(`treemap has ${data.length} records but the source has ${expectedCount} occupations`);
  }

  const seenIds = new Set<number>();
  const riskCounts: Record<string, number> = { low: 0, mid: 0, high: 0 };
  let workforce = 0;
  let salaryPresent = 0;
  let workersPresent = 0;
  let nWithScore = 0;
  let schemaDriftReported = false;

  for (let i = 0; i < data.length; i += 1) {
    const rec = data[i] as Record<string, unknown>;
    if (!rec || typeof rec !== 'object') {
      r.fail(`treemap[${i}] is not an object`);
      continue;
    }
    if (!schemaDriftReported) {
      const missing: string[] = [];
      for (const k of TREEMAP_REQUIRED_KEYS) {
        if (!(k in rec)) missing.push(k);
      }
      if (missing.length > 0) {
        r.fail(`treemap record missing required keys: ${missing.sort().join(', ')}`);
        schemaDriftReported = true;
      }
    }

    const rid = rec.id as number;
    if (seenIds.has(rid)) {
      r.fail(`duplicate id in treemap: ${rid}`);
    }
    seenIds.add(rid);

    if (typeof rec.name_ja !== 'string' || rec.name_ja.length === 0) {
      r.fail(`id=${rid} treemap name_ja empty/non-string`);
    }

    const aiRisk = rec.ai_risk as number | null;
    if (aiRisk != null) {
      if (aiRisk < 0 || aiRisk > 10) {
        r.fail(`id=${rid} ai_risk out of range: ${aiRisk}`);
      }
      // Use the canonical band fn (4.0 / 7.0 boundaries) so this telemetry —
      // and the degenerate-tier warning below — match the risk_band the
      // treemap actually emits. A local 5.0 boundary previously made the
      // printed counts disagree with the published risk_band distribution.
      const tier = riskBand(aiRisk);
      if (tier) {
        riskCounts[tier] += 1;
        // Assert the stored risk_band matches the canonical band, so a
        // regression in treemap.ts's band stamping fails the gate.
        // A null risk_band on a scored record is a stamping regression too.
        const emitted = (rec.risk_band ?? null) as 'low' | 'mid' | 'high' | null;
        if (emitted !== tier) {
          const shown = emitted === null ? 'null' : `"${emitted}"`;
          r.fail(`id=${rid} risk_band ${shown} != canonical "${tier}" (ai_risk=${aiRisk})`);
        }
      }
      nWithScore += 1;
    } else if (rec.risk_band != null) {
      r.fail(`id=${rid} risk_band "${String(rec.risk_band)}" but ai_risk is null`);
    }
    if (rec.salary != null) salaryPresent += 1;
    if (rec.workers != null) {
      workersPresent += 1;
      workforce += rec.workers as number;
    }
  }

  const n = data.length;
  r.note(`treemap: ${n} records, ${seenIds.size} unique ids`);
  r.note(`  ai_risk coverage:  ${nWithScore}/${n} (${pct(nWithScore, n)})`);
  r.note(`  salary coverage:   ${salaryPresent}/${n} (${pct(salaryPresent, n)})`);
  r.note(`  workers coverage:  ${workersPresent}/${n} (${pct(workersPresent, n)})`);
  r.note(`  workforce total:   ${workforce.toLocaleString('en-US')}`);
  r.note(`  risk tiers:        low=${riskCounts.low} mid=${riskCounts.mid} high=${riskCounts.high}`);

  if (workforce > JAPAN_WORKFORCE_LIMIT) {
    r.fail(`workforce total ${workforce.toLocaleString('en-US')} exceeds Japan's ~67M ceiling`);
  }
  if (workforce < 10_000_000) {
    r.warn(`workforce total ${workforce.toLocaleString('en-US')} suspiciously low`);
  }
  for (const tier of RISK_TIERS) {
    if (riskCounts[tier] === 0 && nWithScore > 0) {
      r.warn(`zero records in risk tier '${tier}' — distribution degenerate?`);
    }
  }
  return data;
}

export async function checkTop10(
  distRoot: string,
  treemapRecords: unknown[],
  r: Report,
): Promise<void> {
  const f = join(distRoot, 'data.top10.json');
  if (!existsSync(f)) return;

  const result = await readJsonOrFail<unknown>(r, f, `data.top10.json is invalid JSON`);
  if (!result.ok) return;
  let data: typeof result.data;
  data = result.data;

  if (!Array.isArray(data)) {
    r.fail(`data.top10.json must be a top-level array (got ${typeof data})`);
    return;
  }
  if (data.length !== 10) {
    r.fail(`data.top10.json must contain exactly 10 records (got ${data.length})`);
  }

  const expectedIds = treemapRecords
    .map((rec) => rec as Record<string, unknown>)
    .filter((rec) => typeof rec.ai_risk === 'number')
    .sort((a, b) => {
      const riskDiff = (b.ai_risk as number) - (a.ai_risk as number);
      return riskDiff !== 0 ? riskDiff : (a.id as number) - (b.id as number);
    })
    .slice(0, 10)
    .map((rec) => rec.id as number);

  const seenIds = new Set<number>();
  const actualIds: number[] = [];
  const requiredKeys = ['id', 'name_ja', 'salary', 'workers', 'ai_risk', 'ai_rationale_ja'];
  for (let i = 0; i < data.length; i += 1) {
    const rec = data[i] as Record<string, unknown>;
    if (!rec || typeof rec !== 'object') {
      r.fail(`top10[${i}] is not an object`);
      continue;
    }
    for (const k of requiredKeys) {
      if (!(k in rec)) r.fail(`top10[${i}] missing required key: ${k}`);
    }
    if (typeof rec.id !== 'number') r.fail(`top10[${i}].id is not a number`);
    if (typeof rec.name_ja !== 'string' || rec.name_ja.length === 0) {
      r.fail(`top10[${i}].name_ja empty/non-string`);
    }
    if (rec.ai_risk == null || typeof rec.ai_risk !== 'number') {
      r.fail(`top10[${i}].ai_risk must be a number`);
    }
    if (typeof rec.id === 'number') {
      if (seenIds.has(rec.id)) r.fail(`duplicate id in top10: ${rec.id}`);
      seenIds.add(rec.id);
      actualIds.push(rec.id);
    }
  }

  if (expectedIds.length === 10 && actualIds.join(',') !== expectedIds.join(',')) {
    r.fail(`data.top10.json ids ${actualIds.join(',')} != treemap top10 ${expectedIds.join(',')}`);
  }
  r.note(`top10: ${data.length} records`);
}

export async function checkSectors(distRoot: string, r: Report): Promise<Set<string> | null> {
  const f = join(distRoot, 'data.sectors.json');
  if (!existsSync(f)) return null;
  const result = await readJsonOrFail<{ sectors?: SectorEntry[] }>(r, f, `data.sectors.json invalid JSON`);
  if (!result.ok) return null;
  let data: typeof result.data;
  data = result.data;
  const sectors = data.sectors ?? [];
  if (sectors.length === 0) {
    r.fail('data.sectors.json has no sectors');
    return null;
  }
  const sectorIds = new Set<string>();
  const seenIds = new Set<string>();
  let totalCount = 0;
  for (const s of sectors) {
    if (!s.id) {
      r.fail('sector entry missing id');
      continue;
    }
    if (seenIds.has(s.id)) r.fail(`duplicate sector id: ${s.id}`);
    seenIds.add(s.id);
    sectorIds.add(s.id);
    if (!VALID_HUE.has(s.hue ?? '')) {
      r.fail(`sector ${s.id} has invalid hue: ${s.hue}`);
    }
    const count = s.occupation_count ?? 0;
    totalCount += count;
    if (s.id !== '_uncategorized' && count < MIN_OCCUPATIONS_PER_SECTOR) {
      r.warn(`sector ${s.id} has only ${count} occupations (min ${MIN_OCCUPATIONS_PER_SECTOR})`);
    }
    if (typeof s.ja !== 'string' || s.ja.length === 0) {
      r.fail(`sector ${s.id} missing ja label`);
    }
  }
  r.note(`sectors: ${sectors.length} entries, ${totalCount} occupations covered`);
  return sectorIds;
}

export async function checkReviewQueue(distRoot: string, r: Report): Promise<void> {
  const f = join(distRoot, 'data.review_queue.json');
  if (!existsSync(f)) return;
  const result = await readJsonOrFail<{ summary?: Record<string, number> }>(r, f, `data.review_queue.json invalid JSON`);
  if (!result.ok) return;
  let data: typeof result.data;
  data = result.data;
  const s = data.summary ?? {};
  const uncat = s.uncategorized ?? 0;
  const ambig = s.ambiguous ?? 0;
  r.note(`review_queue: uncategorized=${uncat} ambiguous=${ambig} overrides=${s.override_count ?? 0}`);
  if (uncat > 0) r.warn(`${uncat} occupation(s) uncategorized`);
  if (ambig > 0) r.warn(`${ambig} occupation(s) ambiguous`);
}

export function checkTreemapV110(
  records: unknown[],
  sectorIds: Set<string> | null,
  r: Report,
): void {
  if (records.length === 0) return;
  const sample = records[0] as Record<string, unknown>;
  for (const k of ['sector_id', 'sector_ja', 'hue', 'risk_band', 'workforce_band', 'demand_band']) {
    if (!(k in sample)) {
      r.fail(`treemap[0] missing v1.1.0 field: ${k}`);
    }
  }
  const riskBands: Record<string, number> = {};
  const wfBands: Record<string, number> = {};
  const demandBands: Record<string, number> = {};
  const badSectors: number[] = [];
  for (const recAny of records) {
    const rec = recAny as Record<string, unknown>;
    const rid = rec.id as number;
    const sid = rec.sector_id as string | null;
    if (sectorIds != null && sid != null && !sectorIds.has(sid) && sid !== '_uncategorized') {
      badSectors.push(rid);
    }
    if (rec.hue !== null && rec.hue !== undefined && !VALID_HUE.has(rec.hue as string)) {
      r.fail(`id=${rid} treemap hue invalid: ${rec.hue}`);
    }
    if (!VALID_RISK_BAND.has(rec.risk_band as string | null)) {
      r.fail(`id=${rid} risk_band invalid: ${rec.risk_band}`);
    }
    if (!VALID_WORKFORCE_BAND.has(rec.workforce_band as string | null)) {
      r.fail(`id=${rid} workforce_band invalid: ${rec.workforce_band}`);
    }
    if (!VALID_DEMAND_BAND.has(rec.demand_band as string | null)) {
      r.fail(`id=${rid} demand_band invalid: ${rec.demand_band}`);
    }
    const rb = (rec.risk_band as string | null) ?? 'null';
    riskBands[rb] = (riskBands[rb] ?? 0) + 1;
    const wb = (rec.workforce_band as string | null) ?? 'null';
    wfBands[wb] = (wfBands[wb] ?? 0) + 1;
    const db = (rec.demand_band as string | null) ?? 'null';
    demandBands[db] = (demandBands[db] ?? 0) + 1;
  }
  if (badSectors.length > 0) {
    r.fail(`treemap has unknown sector_id values for ids: ${badSectors.slice(0, 5).join(', ')}`);
  }
  r.note(`  risk_band:         low=${riskBands.low ?? 0} mid=${riskBands.mid ?? 0} high=${riskBands.high ?? 0}`);
  r.note(`  workforce_band:    small=${wfBands.small ?? 0} mid=${wfBands.mid ?? 0} large=${wfBands.large ?? 0}`);
  r.note(`  demand_band:       cold=${demandBands.cold ?? 0} normal=${demandBands.normal ?? 0} hot=${demandBands.hot ?? 0}`);
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}
