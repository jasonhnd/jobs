/**
 * test-consistency.ts — L3 projection sanity per docs/DATA_ARCHITECTURE.md §7.6.
 *
 * Validates the BUILT projections in public/ (post `npm run build:data`).
 * Source-data L1 + L2 validation is done inside build.ts.
 *
 * Usage:
 *   npm run test:consistency
 *   tsx src/data/test-consistency.ts
 *   tsx src/data/test-consistency.ts --dist-root path/to/dir
 *
 * Exit code: 0 = all checks pass, 1 = at least one error.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { riskBand } from './lib/bands.js';
import { ModelsDeepProjectionSchema, ScoreHistoryProjectionSchema } from '../lib/projection-schemas.js';

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
const MODELS_DEEP_MAX_BYTES = 30 * 1024;

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
  return join(REPO, 'public');
}

function relPath(p: string): string {
  try {
    return relative(REPO, p) || p;
  } catch {
    return p;
  }
}

async function checkPlannedFilesExist(distRoot: string, r: Report): Promise<void> {
  // All 13 projection families produced by src/data/build.ts. A missing
  // file here means a projection silently failed to write, which the build
  // step itself does not currently detect.
  const requiredFiles = [
    'data.treemap.json',
    'data.top10.json',
    'data.treemap.meta.json',
    'data.search.json',
    'data.sectors.json',
    'data.review_queue.json',
    'data.profile5.json',
    'data.worktypes.json',
    'data.transfer_paths.json',
    'data.score_history.json',
    'data.models_deep.json',
    'data.holland.json',
    'data.labels/ja.json',
    // Removed in Step 12: data.featured.json (dead projection).
  ];
  const requiredDirs = [
    'data.detail',         // 556 per-occupation files
    'data.skills',         // 39 per-skill files + index
    // Removed in Step 12: data.tasks (556 dead files) and
    // data.score-history (old 552-file directory).
  ];
  for (const f of requiredFiles) {
    const p = join(distRoot, f);
    if (!existsSync(p)) {
      r.fail(`missing required projection file: ${relPath(p)}`);
    }
  }
  for (const d of requiredDirs) {
    const p = join(distRoot, d);
    if (!existsSync(p)) {
      r.fail(`missing required projection directory: ${relPath(p)}`);
    } else {
      // Directory should be non-empty.
      try {
        const entries = readdirSync(p);
        if (entries.length === 0) {
          r.fail(`projection directory is empty: ${relPath(p)}`);
        }
      } catch (err) {
        r.fail(`cannot read projection directory ${relPath(p)}: ${(err as Error).message}`);
      }
    }
  }
}

async function checkNonEmptyJsonShape(
  distRoot: string,
  filename: string,
  expectKey: string,
  r: Report,
): Promise<void> {
  // Lightweight sanity: file exists, parses as JSON, has the expected
  // top-level key. Catches regressions like "projection wrote {} or [] only".
  const p = join(distRoot, filename);
  if (!existsSync(p)) return;  // existence already reported above
  let data: unknown;
  try {
    data = await loadJson(p);
  } catch (err) {
    r.fail(`${filename} invalid JSON: ${(err as Error).message}`);
    return;
  }
  if (!data || typeof data !== 'object') {
    r.fail(`${filename} top-level must be an object/array (got ${typeof data})`);
    return;
  }
  if (!(expectKey in (data as Record<string, unknown>))) {
    r.fail(`${filename} missing expected top-level key: ${expectKey}`);
  }
}

async function checkPerOccupationDir(
  distRoot: string,
  dirname: string,
  expectMin: number,
  r: Report,
): Promise<void> {
  // Sample-validate one file from a per-occupation directory.
  const dir = join(distRoot, dirname);
  if (!existsSync(dir)) return;  // existence already reported above
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch (err) {
    r.fail(`cannot read ${dirname}: ${(err as Error).message}`);
    return;
  }
  if (entries.length < expectMin) {
    r.fail(`${dirname} has ${entries.length} files, expected ≥ ${expectMin}`);
  }
  if (entries.length === 0) return;
  // Parse the first file to ensure it's valid JSON.
  const sample = join(dir, entries[0]!);
  try {
    const parsed = await loadJson(sample);
    if (!parsed || typeof parsed !== 'object') {
      r.fail(`${dirname}/${entries[0]} sample is not an object`);
    }
  } catch (err) {
    r.fail(`${dirname}/${entries[0]} sample invalid JSON: ${(err as Error).message}`);
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
      // Use the canonical band fn (4.0 / 7.0 boundaries) so this telemetry —
      // and the degenerate-tier warning below — match the risk_band the
      // treemap actually emits. A local 5.0 boundary previously made the
      // printed counts disagree with the published risk_band distribution.
      const tier = riskBand(aiRisk);
      if (tier) {
        riskCounts[tier] += 1;
        // Assert the stored risk_band matches the canonical band, so a
        // regression in treemap.ts's band stamping fails the gate.
        const emitted = (rec.risk_band ?? null) as 'low' | 'mid' | 'high' | null;
        if (emitted !== null && emitted !== tier) {
          r.fail(`id=${rid} risk_band "${emitted}" != canonical "${tier}" (ai_risk=${aiRisk})`);
        }
      }
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

async function checkTop10(
  distRoot: string,
  treemapRecords: unknown[],
  r: Report,
): Promise<void> {
  const f = join(distRoot, 'data.top10.json');
  if (!existsSync(f)) return;

  let data: unknown;
  try {
    data = await loadJson(f);
  } catch (err) {
    r.fail(`data.top10.json is invalid JSON: ${(err as Error).message}`);
    return;
  }

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

function containsForbiddenKey(value: unknown, forbiddenKey: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenKey(item, forbiddenKey));
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === forbiddenKey) return true;
      if (containsForbiddenKey(child, forbiddenKey)) return true;
    }
  }
  return false;
}

async function checkScoreHistory(
  distRoot: string,
  r: Report,
  expectedIds: Set<number>,
): Promise<void> {
  const f = join(distRoot, 'data.score_history.json');
  if (!existsSync(f)) return;

  let data: unknown;
  try {
    data = await loadJson(f);
  } catch (err) {
    r.fail(`data.score_history.json invalid JSON: ${(err as Error).message}`);
    return;
  }

  const parsed = ScoreHistoryProjectionSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    r.fail(
      `data.score_history.json schema invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : parsed.error.message}`,
    );
    return;
  }

  if (containsForbiddenKey(parsed.data, 'rationale_ja')) {
    r.fail('data.score_history.json must not contain rationale_ja');
  }

  const actualIds = new Set(Object.keys(parsed.data).map((id) => Number.parseInt(id, 10)));
  if (actualIds.size !== expectedIds.size) {
    r.fail(`data.score_history.json key count (${actualIds.size}) != total source occupations (${expectedIds.size})`);
  }
  const missing: number[] = [];
  for (const id of expectedIds) if (!actualIds.has(id)) missing.push(id);
  const extra: number[] = [];
  for (const id of actualIds) if (!expectedIds.has(id)) extra.push(id);
  if (missing.length > 0) r.fail(`data.score_history.json missing ids: ${missing.slice(0, 5).join(', ')}`);
  if (extra.length > 0) r.fail(`data.score_history.json has unknown ids: ${extra.slice(0, 5).join(', ')}`);

  let entries = 0;
  for (const [occId, history] of Object.entries(parsed.data)) {
    entries += history.length;
    for (let i = 1; i < history.length; i += 1) {
      if (history[i - 1]!.date > history[i]!.date) {
        r.fail(`data.score_history.json id=${occId} entries are not ordered by date ascending`);
        break;
      }
    }
    for (const [idx, entry] of history.entries()) {
      if (entry.dims != null && Object.keys(entry.dims).length !== 10) {
        r.fail(`data.score_history.json id=${occId}[${idx}] dims must have all 10 dimensions`);
      }
    }
  }

  r.note(`score_history: ${actualIds.size} occupations, ${entries} entries`);
}

async function checkModelsDeep(
  distRoot: string,
  r: Report,
  expectedIds: Set<number>,
): Promise<void> {
  const f = join(distRoot, 'data.models_deep.json');
  if (!existsSync(f)) return;

  const bytes = statSync(f).size;
  if (bytes > MODELS_DEEP_MAX_BYTES) {
    r.fail(`data.models_deep.json is ${bytes} bytes, expected <= ${MODELS_DEEP_MAX_BYTES}`);
  }

  let data: unknown;
  try {
    data = await loadJson(f);
  } catch (err) {
    r.fail(`data.models_deep.json invalid JSON: ${(err as Error).message}`);
    return;
  }

  const parsed = ModelsDeepProjectionSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    r.fail(
      `data.models_deep.json schema invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : parsed.error.message}`,
    );
    return;
  }

  const referencedIds = [
    ...parsed.data.consensus.map((row) => row.id),
    ...parsed.data.stories.map((story) => story.id),
  ];
  for (const id of referencedIds) {
    if (!expectedIds.has(id)) {
      r.fail(`data.models_deep.json references unknown occupation id: ${id}`);
    }
  }

  if (new Set(parsed.data.stories.map((story) => story.id)).size !== parsed.data.stories.length) {
    r.fail('data.models_deep.json stories contain duplicate occupation ids');
  }

  r.note(
    `models_deep: cards=${parsed.data.model_cards.length} consensus=${parsed.data.consensus.length} stories=${parsed.data.stories.length} bytes=${bytes}`,
  );
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
    for (const w of r.warnings) console.log(`  [WARN] ${w}`);
  }
  if (r.errors.length > 0) {
    console.log('\nERRORS:');
    for (const e of r.errors) console.log(`  [FAIL] ${e}`);
    process.exit(1);
  }
  console.log('\n[OK] projections pass L3 consistency checks');
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
  await checkTop10(distRoot, treemapRecords, r);

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
  await checkScoreHistory(distRoot, r, allOccIds);
  await checkModelsDeep(distRoot, r, allOccIds);

  const sectorIds = await checkSectors(distRoot, r);
  await checkReviewQueue(distRoot, r);
  checkTreemapV110(treemapRecords, sectorIds, r);

  // Lightweight existence + shape checks for the projections that don't
  // have deep dedicated checks above. Catches "projection silently wrote
  // an empty / malformed file" regressions.
  await checkNonEmptyJsonShape(distRoot, 'data.holland.json', 'rows', r);
  await checkNonEmptyJsonShape(distRoot, 'data.profile5.json', 'profiles', r);
  await checkNonEmptyJsonShape(distRoot, 'data.worktypes.json', 'occupations', r);
  await checkNonEmptyJsonShape(distRoot, 'data.transfer_paths.json', 'paths', r);
  await checkPerOccupationDir(distRoot, 'data.skills', 30, r);
  // Step 12 removed: data.featured.json (dead projection),
  // data.tasks (556 dead files), data.score-history (old 552-file dir).

  // Cross-projection invariants — every id referenced by the search /
  // transfer_paths projections must point at an occupation that
  // actually has a detail file. Catches dangling references that would
  // produce 404 fetches at runtime.
  await checkCrossProjectionIdReferences(distRoot, r);

  reportAndExit(r);
}

async function checkCrossProjectionIdReferences(distRoot: string, r: Report): Promise<void> {
  // Build the canonical id set from data.detail/<padded>.json filenames.
  const detailDir = join(distRoot, 'data.detail');
  if (!existsSync(detailDir)) return;
  let knownIds: Set<number>;
  try {
    knownIds = new Set(
      readdirSync(detailDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => Number.parseInt(f.replace(/\.json$/, ''), 10))
        .filter(Number.isFinite),
    );
  } catch (err) {
    r.fail(`cannot enumerate data.detail/: ${(err as Error).message}`);
    return;
  }

  // search.json: every documents[].id must be in knownIds.
  const searchPath = join(distRoot, 'data.search.json');
  if (existsSync(searchPath)) {
    try {
      const search = (await loadJson(searchPath)) as { documents?: Array<{ id?: number }> };
      const docs = search.documents ?? [];
      const dangling: number[] = [];
      for (const d of docs) {
        if (typeof d.id === 'number' && !knownIds.has(d.id)) dangling.push(d.id);
      }
      if (dangling.length > 0) {
        r.fail(
          `data.search.json has ${dangling.length} ids with no matching data.detail/ file: ${dangling.slice(0, 5).join(', ')}${dangling.length > 5 ? '…' : ''}`,
        );
      }
    } catch (err) {
      r.fail(`data.search.json id-cross-check failed: ${(err as Error).message}`);
    }
  }

  // transfer_paths.json: every paths[*].candidates[*].id must be in knownIds.
  const tpPath = join(distRoot, 'data.transfer_paths.json');
  if (existsSync(tpPath)) {
    try {
      const tp = (await loadJson(tpPath)) as {
        paths?: Record<string, { candidates?: Array<{ id?: number }> }>;
      };
      const pathsObj = tp.paths ?? {};
      const dangling = new Set<number>();
      for (const entry of Object.values(pathsObj)) {
        for (const c of entry.candidates ?? []) {
          if (typeof c.id === 'number' && !knownIds.has(c.id)) dangling.add(c.id);
        }
      }
      if (dangling.size > 0) {
        const sample = Array.from(dangling).slice(0, 5).join(', ');
        r.fail(
          `data.transfer_paths.json references ${dangling.size} candidate ids with no matching data.detail/ file: ${sample}${dangling.size > 5 ? '…' : ''}`,
        );
      }
    } catch (err) {
      r.fail(`data.transfer_paths.json id-cross-check failed: ${(err as Error).message}`);
    }
  }

  // (featured.json cross-check removed in Step 12 — projection deleted.)
}

main().catch((err) => {
  console.error('test-consistency crashed:', err);
  process.exit(1);
});
