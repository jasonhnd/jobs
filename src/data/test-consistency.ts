/**
 * test-consistency.ts — L3 projection sanity per docs/DATA_ARCHITECTURE.md §7.6.
 *
 * Validates the BUILT projections in dist-ts/ (post `npm run build:data:ts`).
 * Source-data L1 + L2 validation is done inside build.ts.
 *
 * Migrated from scripts/test_data_consistency.py (Track B-4, MIGRATION_PLAN.md PR 22).
 *
 * Usage:
 *   npm run test:consistency
 *   tsx src/data/test-consistency.ts
 *   tsx src/data/test-consistency.ts --dist-root path/to/dist
 *
 * Exit code: 0 = all checks pass, 1 = at least one error.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const REPO = process.cwd();

// Per §6.1 — treemap is array of objects with these required fields.
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

class Report {
  errors: string[] = [];
  warnings: string[] = [];
  info: string[] = [];
  fail(msg: string): void { this.errors.push(msg); }
  warn(msg: string): void { this.warnings.push(msg); }
  note(msg: string): void { this.info.push(msg); }
}

async function loadJson(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

function getDistRoot(): string {
  const argIdx = process.argv.indexOf('--dist-root');
  if (argIdx >= 0 && process.argv[argIdx + 1]) {
    return process.argv[argIdx + 1]!;
  }
  return join(REPO, 'dist-ts');
}

function relPath(p: string): string {
  try {
    return relative(REPO, p) || p;
  } catch {
    return p;
  }
}

async function checkPlannedFilesExist(distRoot: string, r: Report): Promise<void> {
  const required = [
    join(distRoot, 'data.treemap.json'),
    join(distRoot, 'data.search.json'),
    join(distRoot, 'data.labels', 'ja.json'),
    join(distRoot, 'data.detail'),
    join(distRoot, 'data.sectors.json'),
    join(distRoot, 'data.review_queue.json'),
  ];
  for (const p of required) {
    if (!existsSync(p)) {
      r.fail(`missing required projection: ${relPath(p)}`);
    }
  }
}

async function checkTreemap(distRoot: string, r: Report): Promise<unknown[]> {
  const f = join(distRoot, 'data.treemap.json');
  if (!existsSync(f)) return [];
  let data: unknown;
  try {
    data = await loadJson(f);
  } catch (err) {
    r.fail(`data.treemap.json is invalid JSON: ${(err as Error).message}`);
    return [];
  }

  if (!Array.isArray(data)) {
    r.fail(`data.treemap.json must be a top-level array (got ${typeof data})`);
    return [];
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
      const tier = aiRisk < 5 ? 'low' : aiRisk < 7 ? 'mid' : 'high';
      riskCounts[tier]! += 1;
      nWithScore += 1;
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

async function checkSearch(distRoot: string, r: Report, expectedCount: number): Promise<void> {
  const f = join(distRoot, 'data.search.json');
  if (!existsSync(f)) return;
  let data: { documents?: Array<Record<string, unknown>> };
  try {
    data = (await loadJson(f)) as typeof data;
  } catch (err) {
    r.fail(`data.search.json is invalid JSON: ${(err as Error).message}`);
    return;
  }
  const docs = data.documents ?? [];
  if (expectedCount > 0 && docs.length !== expectedCount) {
    r.fail(`search document_count (${docs.length}) != total source occupations (${expectedCount})`);
  }
  const seen = new Set<number>();
  for (const d of docs) {
    const rid = d.id as number;
    if (seen.has(rid)) r.fail(`duplicate id in search: ${rid}`);
    seen.add(rid);
    if (!d.title_ja) r.fail(`id=${rid} search missing title_ja`);
  }
}

async function checkDetailFiles(
  distRoot: string,
  r: Report,
  expectedIds: Set<number>,
): Promise<void> {
  const d = join(distRoot, 'data.detail');
  if (!existsSync(d)) return;
  const files = readdirSync(d).filter((f) => f.endsWith('.json')).sort();
  if (files.length !== expectedIds.size) {
    r.fail(`detail file count (${files.length}) != total source occupations (${expectedIds.size})`);
  }

  const fileIds = new Set<number>();
  for (const fname of files) {
    const stem = fname.replace(/\.json$/, '');
    const stemId = Number.parseInt(stem, 10);
    if (!Number.isFinite(stemId)) {
      r.fail(`detail file with non-int name: ${fname}`);
      continue;
    }
    let data: { id?: number; title?: { ja?: string } };
    try {
      data = (await loadJson(join(d, fname))) as typeof data;
    } catch (err) {
      r.fail(`detail/${fname} invalid JSON: ${(err as Error).message}`);
      continue;
    }
    if (data.id !== stemId) {
      r.fail(`detail/${fname} inner id ${data.id} != filename stem ${stemId}`);
    }
    if (!data.title || !data.title.ja) {
      r.fail(`detail/${fname} missing title.ja`);
    }
    if (stem.length !== 4) {
      r.fail(`detail/${fname} filename must be 4-digit zero-padded`);
    }
    fileIds.add(stemId);
  }

  const missing: number[] = [];
  for (const id of expectedIds) if (!fileIds.has(id)) missing.push(id);
  const extra: number[] = [];
  for (const id of fileIds) if (!expectedIds.has(id)) extra.push(id);
  if (missing.length > 0) r.fail(`detail/ missing ids: ${missing.slice(0, 5).join(', ')}`);
  if (extra.length > 0) r.fail(`detail/ has unknown ids: ${extra.slice(0, 5).join(', ')}`);
}

async function checkLabels(distRoot: string, r: Report): Promise<void> {
  for (const lang of ['ja', 'en']) {
    const f = join(distRoot, 'data.labels', `${lang}.json`);
    if (!existsSync(f)) continue;
    let data: Record<string, unknown>;
    try {
      data = (await loadJson(f)) as Record<string, unknown>;
    } catch (err) {
      r.fail(`data.labels/${lang}.json invalid JSON: ${(err as Error).message}`);
      continue;
    }
    if (data.lang !== lang) {
      r.fail(`data.labels/${lang}.json has wrong lang field: ${data.lang}`);
    }
    const dims = Object.keys(data).filter(
      (k) => !['schema_version', 'lang', 'generated_at'].includes(k),
    );
    if (dims.length !== 7) {
      r.warn(`data.labels/${lang}.json has ${dims.length} dimensions, expected 7`);
    }
  }
}

interface SectorEntry {
  id?: string;
  hue?: string;
  ja?: string;
  occupation_count?: number;
}

async function checkSectors(distRoot: string, r: Report): Promise<Set<string> | null> {
  const f = join(distRoot, 'data.sectors.json');
  if (!existsSync(f)) return null;
  let data: { sectors?: SectorEntry[] };
  try {
    data = (await loadJson(f)) as typeof data;
  } catch (err) {
    r.fail(`data.sectors.json invalid JSON: ${(err as Error).message}`);
    return null;
  }
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

async function checkReviewQueue(distRoot: string, r: Report): Promise<void> {
  const f = join(distRoot, 'data.review_queue.json');
  if (!existsSync(f)) return;
  let data: { summary?: Record<string, number> };
  try {
    data = (await loadJson(f)) as typeof data;
  } catch (err) {
    r.fail(`data.review_queue.json invalid JSON: ${(err as Error).message}`);
    return;
  }
  const s = data.summary ?? {};
  const uncat = s.uncategorized ?? 0;
  const ambig = s.ambiguous ?? 0;
  r.note(`review_queue: uncategorized=${uncat} ambiguous=${ambig} overrides=${s.override_count ?? 0}`);
  if (uncat > 0) r.warn(`${uncat} occupation(s) uncategorized`);
  if (ambig > 0) r.warn(`${ambig} occupation(s) ambiguous`);
}

function checkTreemapV110(
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

function reportAndExit(r: Report): never {
  for (const line of r.info) console.log(line);
  if (r.warnings.length > 0) {
    console.log('\nWARNINGS:');
    for (const w of r.warnings) console.log(`  ⚠ ${w}`);
  }
  if (r.errors.length > 0) {
    console.log('\nERRORS:');
    for (const e of r.errors) console.log(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log('\n✓ projections pass L3 consistency checks');
  process.exit(0);
}

async function main(): Promise<void> {
  const distRoot = getDistRoot();
  const r = new Report();

  if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
    r.fail(`dist root does not exist: ${distRoot}`);
    reportAndExit(r);
  }

  console.log(`Checking projections in ${relPath(distRoot)}\n`);

  await checkPlannedFilesExist(distRoot, r);
  const treemapRecords = await checkTreemap(distRoot, r);

  // Source occupation count
  const occDir = join(REPO, 'data', 'occupations');
  const allOccIds = new Set<number>();
  if (existsSync(occDir)) {
    for (const f of readdirSync(occDir)) {
      if (!f.endsWith('.json')) continue;
      const id = Number.parseInt(f.replace(/\.json$/, ''), 10);
      if (Number.isFinite(id)) allOccIds.add(id);
    }
  }

  await checkSearch(distRoot, r, allOccIds.size);
  await checkDetailFiles(distRoot, r, allOccIds);
  await checkLabels(distRoot, r);

  const sectorIds = await checkSectors(distRoot, r);
  await checkReviewQueue(distRoot, r);
  checkTreemapV110(treemapRecords, sectorIds, r);

  reportAndExit(r);
}

main().catch((err) => {
  console.error('test-consistency crashed:', err);
  process.exit(1);
});
