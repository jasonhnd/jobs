/**
 * import-ipd.ts — Import IPD xlsx → data/occupations/<padded>.json × 556+.
 *
 * Per docs/DATA_ARCHITECTURE.md §2.1 / §5.1 / §3A / D-009.
 *
 * Migrated from scripts/import_ipd.py (Track B-4, MIGRATION_PLAN.md PR 23).
 *
 * Inputs:
 *   ~/Downloads/IPD_DL_numeric_<ver>.xlsx       (518+ occupations × numeric profile)
 *   ~/Downloads/IPD_DL_description_<ver>.xlsx   (556+ occupations × text/classification)
 *   data/labels/*.ja-en.json                    (7 dimensions, IPD-ID → en_key)
 *
 * Outputs:
 *   data/occupations/0001.json … 0584.json      (one per occupation, 4-digit padded id)
 *   data/.ipd_provenance.json                   (sha256 + retrieved_at)
 *
 * Joins:
 *   By 収録番号 (IPD_01_01_001) = canonical_id (1-584).
 *   Numeric file is subset of description (518 ⊂ 556).
 *
 * Verification: re-running with the same xlsx files should produce byte-identical
 * JSON to the Python version (validated when Python is still available; once
 * Python is removed in Track D, run against a snapshot).
 *
 * Usage:
 *   tsx src/data/import-ipd.ts [--numeric path] [--description path]
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { type Occupation, OccupationSchema } from './schema/occupation.js';

const REPO = process.cwd();
const HOME_DOWNLOADS = join(homedir(), 'Downloads');
const DEFAULT_NUM_FP = join(HOME_DOWNLOADS, 'IPD_DL_numeric_7_00.xlsx');
const DEFAULT_DESC_FP = join(HOME_DOWNLOADS, 'IPD_DL_description_7_00_01.xlsx');
const LABELS_DIR = join(REPO, 'data', 'labels');
const OUTPUT_DIR = join(REPO, 'data', 'occupations');
const PROVENANCE_FILE = join(REPO, 'data', '.ipd_provenance.json');

const IPD_VERSION = 'v7.00';
const INGESTED_AT = new Date().toISOString().slice(0, 10);

// ───── Hardcoded JA → en_key for the 5 distribution subsections ─────

const EDUCATION_KEYS: Record<string, string> = {
  高卒未満: 'below_high_school',
  高卒: 'high_school',
  専門学校卒: 'vocational_school',
  短大卒: 'junior_college',
  高専卒: 'technical_college',
  大卒: 'university',
  '修士課程卒（修士と同等の専門職学位を含む）': 'masters',
  博士課程卒: 'doctorate',
  わからない: 'unknown',
};

const TRAINING_PRE_KEYS: Record<string, string> = {
  特に必要ない: 'not_required',
  '1ヶ月以下': 'up_to_1_month',
  '1ヶ月超～6ヶ月以下': '1_to_6_months',
  '6ヶ月超～1年以下': '6_months_to_1_year',
  '1年超～2年以下': '1_to_2_years',
  '2年超～3年以下': '2_to_3_years',
  '3年超～5年以下': '3_to_5_years',
  '5年超～10年以下': '5_to_10_years',
  '10年超': 'over_10_years',
  わからない: 'unknown',
};

const EXPERIENCE_KEYS = TRAINING_PRE_KEYS;

const TRAINING_POST_KEYS: Record<string, string> = {
  '必要でない（未経験でも即戦力となる）': 'not_required',
  '1ヶ月以下': 'up_to_1_month',
  '1ヶ月超～6ヶ月以下': '1_to_6_months',
  '6ヶ月超～1年以下': '6_months_to_1_year',
  '1年超～2年以下': '1_to_2_years',
  '2年超～3年以下': '2_to_3_years',
  '3年超～5年以下': '3_to_5_years',
  '5年超～10年以下': '5_to_10_years',
  '10年超': 'over_10_years',
  わからない: 'unknown',
};

const EMPLOYMENT_TYPE_KEYS: Record<string, string> = {
  '正規の職員、従業員': 'regular_employee',
  パートタイマー: 'part_time',
  派遣社員: 'dispatched',
  '契約社員、期間従業員': 'contract',
  '自営、フリーランス': 'self_employed_freelance',
  '経営層（役員等）': 'executive',
  'アルバイト（学生以外）': 'casual_non_student',
  'アルバイト（学生）': 'casual_student',
  わからない: 'unknown',
  その他: 'other',
};

// ───── Helpers ─────

async function sha256OfFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function safeFloat(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface LabelsFileShape {
  labels: Record<string, { onet_id?: string }>;
}

async function buildIpdToEnKey(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const files = (await readdir(LABELS_DIR)).filter((f) => f.endsWith('.ja-en.json'));
  for (const fname of files) {
    const raw = await readFile(join(LABELS_DIR, fname), 'utf-8');
    const data = JSON.parse(raw) as LabelsFileShape;
    for (const [enKey, entry] of Object.entries(data.labels)) {
      const ipdId = entry.onet_id;
      if (!ipdId) continue;
      if (mapping.has(ipdId)) {
        throw new Error(`Duplicate IPD-ID ${ipdId} across labels files`);
      }
      mapping.set(ipdId, enKey);
    }
  }
  return mapping;
}

interface SheetIndex {
  /** IPD-ID → 1-based column index. */
  colMap: Map<string, number>;
  /** IPD-ID → JA name (from row 17 / 13 above the IPD-ID header row). */
  jaByIpdId: Map<string, string>;
}

function buildHeaderColMap(
  worksheet: ExcelJS.Worksheet,
  headerRow: number,
): Map<string, number> {
  const out = new Map<string, number>();
  const row = worksheet.getRow(headerRow);
  // ExcelJS columns are 1-based.
  const maxCol = row.cellCount > 0 ? row.cellCount : worksheet.columnCount;
  for (let c = 1; c <= maxCol; c += 1) {
    const v = row.getCell(c).value;
    if (typeof v === 'string' && v.startsWith('IPD_')) {
      out.set(v, c);
    }
  }
  return out;
}

function readDataRows(
  worksheet: ExcelJS.Worksheet,
  colMap: Map<string, number>,
  firstDataRow: number,
  idCol: number,
): Map<number, Map<string, unknown>> {
  const out = new Map<number, Map<string, unknown>>();
  for (let r = firstDataRow; r <= worksheet.rowCount; r += 1) {
    const idCell = worksheet.getRow(r).getCell(idCol).value;
    if (idCell == null) continue;
    const occId = Number(idCell);
    if (!Number.isInteger(occId)) continue;
    const rowData = new Map<string, unknown>();
    for (const [ipdId, c] of colMap) {
      rowData.set(ipdId, worksheet.getRow(r).getCell(c).value);
    }
    out.set(occId, rowData);
  }
  return out;
}

// ───── Per-occupation builders ─────

function buildAliases(descRow: Map<string, unknown>): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 25; i += 1) {
    const v = safeStr(descRow.get(`IPD_02_04_${String(i).padStart(3, '0')}`));
    if (v) out.push(v);
  }
  return out;
}

function buildClassifications(descRow: Map<string, unknown>): {
  mhlw_main: string | null;
  mhlw_all: string[];
  jsoc_main: string | null;
  jsoc_all: string[];
} {
  const mhlwMain = safeStr(descRow.get('IPD_02_02_000'));
  const mhlwAll: string[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const v = safeStr(descRow.get(`IPD_02_02_${String(i).padStart(3, '0')}`));
    if (v) mhlwAll.push(v);
  }
  if (mhlwMain && !mhlwAll.includes(mhlwMain)) mhlwAll.unshift(mhlwMain);

  const jsocMain = safeStr(descRow.get('IPD_02_03_000'));
  const jsocAll: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const v = safeStr(descRow.get(`IPD_02_03_${String(i).padStart(3, '0')}`));
    if (v) jsocAll.push(v);
  }
  if (jsocMain && !jsocAll.includes(jsocMain)) jsocAll.unshift(jsocMain);

  return { mhlw_main: mhlwMain, mhlw_all: mhlwAll, jsoc_main: jsocMain, jsoc_all: jsocAll };
}

function buildDescription(descRow: Map<string, unknown>): {
  summary_ja: string | null;
  what_it_is_ja: string | null;
  how_to_become_ja: string | null;
  working_conditions_ja: string | null;
} {
  return {
    summary_ja: safeStr(descRow.get('IPD_03_01_000')),
    what_it_is_ja: safeStr(descRow.get('IPD_03_01_001')),
    how_to_become_ja: safeStr(descRow.get('IPD_03_01_002')),
    working_conditions_ja: safeStr(descRow.get('IPD_03_01_003')),
  };
}

function buildRelatedOrgs(
  descRow: Map<string, unknown>,
): Array<{ name_ja: string; url: string | null }> {
  const out: Array<{ name_ja: string; url: string | null }> = [];
  for (let i = 1; i <= 10; i += 1) {
    const idx = String(i).padStart(2, '0');
    const name = safeStr(descRow.get(`IPD_03_03_${idx}_01`));
    const url = safeStr(descRow.get(`IPD_03_03_${idx}_02`));
    if (name) out.push({ name_ja: name, url });
  }
  return out;
}

function buildRelatedCerts(descRow: Map<string, unknown>): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 35; i += 1) {
    const v = safeStr(descRow.get(`IPD_03_04_${String(i).padStart(3, '0')}`));
    if (v) out.push(v);
  }
  return out;
}

function buildLabeledDimension(
  numRow: Map<string, unknown>,
  prefix: string,
  ipdToKey: Map<string, string>,
): Record<string, number> | null {
  const block: Record<string, number> = {};
  for (const [ipdId, enKey] of ipdToKey) {
    if (!ipdId.startsWith(prefix)) continue;
    const v = safeFloat(numRow.get(ipdId));
    if (v != null) block[enKey] = v;
  }
  return Object.keys(block).length === 0 ? null : block;
}

function buildDistribution(
  numRow: Map<string, unknown>,
  prefix: string,
  jaToKey: Record<string, string>,
  numIdToJa: Map<string, string>,
): Record<string, number> | null {
  const block: Record<string, number> = {};
  for (const [ipdId, jaLabel] of numIdToJa) {
    if (!ipdId.startsWith(prefix)) continue;
    const enKey = jaToKey[jaLabel];
    if (!enKey) {
      console.error(`  WARN: distribution ${prefix} JA '${jaLabel}' not in en_key map`);
      continue;
    }
    const v = safeFloat(numRow.get(ipdId));
    if (v != null) block[enKey] = v;
  }
  return Object.keys(block).length === 0 ? null : block;
}

function buildTasks(
  numRow: Map<string, unknown>,
): { tasks_lead_ja: string | null; tasks: Array<{ task_id: number; description_ja: string; execution_rate: number | null; importance: number | null }> } {
  const lead = safeStr(numRow.get('IPD_05_00_01'));
  const tasks: Array<{
    task_id: number;
    description_ja: string;
    execution_rate: number | null;
    importance: number | null;
  }> = [];
  for (let i = 1; i <= 37; i += 1) {
    const prefix = `IPD_05_${String(i).padStart(2, '0')}_`;
    const desc = safeStr(numRow.get(`${prefix}01`));
    const rate = safeFloat(numRow.get(`${prefix}02`));
    const imp = safeFloat(numRow.get(`${prefix}03`));
    if (desc == null && rate == null && imp == null) continue;
    if (!desc) continue;
    tasks.push({
      task_id: i,
      description_ja: desc,
      execution_rate: rate,
      importance: imp,
    });
  }
  return { tasks_lead_ja: lead, tasks };
}

function buildLastUpdated(
  descRow: Map<string, unknown>,
  numRow: Map<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const descFields: Array<[string, string]> = [
    ['IPD_88_01_01', 'ipd_id'],
    ['IPD_88_02_01', 'classifications'],
    ['IPD_88_03_01', 'description'],
  ];
  for (const [ipdId, key] of descFields) {
    const v = descRow.get(ipdId);
    if (v != null) {
      const n = Number(v);
      if (Number.isInteger(n)) out[key] = n;
    }
  }
  const numFields: Array<[string, string]> = [
    ['IPD_88_04_01_001', 'interests'],
    ['IPD_88_04_01_002', 'work_values'],
    ['IPD_88_04_01_003', 'skills'],
    ['IPD_88_04_01_004', 'knowledge'],
    ['IPD_88_04_01_005', 'work_characteristics'],
    ['IPD_88_04_01_006', 'work_activities'],
    ['IPD_88_04_01_007', 'abilities'],
    ['IPD_88_04_01_008', 'education_distribution'],
    ['IPD_88_04_01_009', 'training_experience_employment'],
    ['IPD_88_05_01', 'tasks'],
  ];
  for (const [ipdId, key] of numFields) {
    const v = numRow.get(ipdId);
    if (v != null) {
      const n = Number(v);
      if (Number.isInteger(n)) out[key] = n;
    }
  }
  return out;
}

// ───── Sheet loading ─────

async function loadSheet(
  filePath: string,
  sheetName: string,
  headerRow: number,
  firstDataRow: number,
): Promise<{ rows: Map<number, Map<string, unknown>>; sheetIdx: SheetIndex }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) throw new Error(`Sheet '${sheetName}' not found in ${filePath}`);

  const colMap = buildHeaderColMap(ws, headerRow);
  // For numeric sheet, JA label sits one row above the header row (row 17 vs 18).
  // For description sheet, JA labels not used.
  const jaByIpdId = new Map<string, string>();
  const labelRow = headerRow - 1;
  if (labelRow >= 1) {
    const row = ws.getRow(labelRow);
    for (const [ipdId, c] of colMap) {
      const v = row.getCell(c).value;
      if (v != null) jaByIpdId.set(ipdId, String(v));
    }
  }

  const idCol = colMap.get('IPD_01_01_001') ?? 3;
  const rows = readDataRows(ws, colMap, firstDataRow, idCol);
  return { rows, sheetIdx: { colMap, jaByIpdId } };
}

// ───── Main ─────

interface CliArgs {
  numericPath: string;
  descriptionPath: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let numericPath = DEFAULT_NUM_FP;
  let descriptionPath = DEFAULT_DESC_FP;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--numeric' && args[i + 1]) {
      numericPath = args[i + 1]!;
      i += 1;
    } else if (args[i] === '--description' && args[i + 1]) {
      descriptionPath = args[i + 1]!;
      i += 1;
    }
  }
  return { numericPath, descriptionPath };
}

async function main(): Promise<void> {
  const { numericPath, descriptionPath } = parseArgs();

  console.log(`Loading ${numericPath} ...`);
  const { rows: numData, sheetIdx: numIdx } = await loadSheet(
    numericPath,
    'IPD形式',
    /* headerRow */ 18,
    /* firstDataRow */ 19,
  );
  console.log(`  ${numData.size} numeric occupations loaded`);

  console.log(`Loading ${descriptionPath} ...`);
  const { rows: descData } = await loadSheet(
    descriptionPath,
    '解説系',
    /* headerRow */ 14,
    /* firstDataRow */ 15,
  );
  console.log(`  ${descData.size} description occupations loaded`);

  const ipdToKey = await buildIpdToEnKey();
  console.log(`  ${ipdToKey.size} IPD-ID → en_key labels loaded`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Computing source SHA256 ...`);
  const numSha = await sha256OfFile(numericPath);
  const descSha = await sha256OfFile(descriptionPath);

  const provenance = {
    ipd_version: IPD_VERSION,
    ipd_published_at: '2026-03-17',
    ipd_data_cut_numeric: '2026-02-10',
    ipd_data_cut_description: '2026-02-26',
    ipd_retrieved_at: INGESTED_AT,
    files: {
      numeric: { name: numericPath.split(/[\\/]/).pop()!, sha256: numSha },
      description: { name: descriptionPath.split(/[\\/]/).pop()!, sha256: descSha },
    },
    source_index_url: 'https://shigoto.mhlw.go.jp/User/download',
    source_file_url_numeric:
      'https://sgteprdstaplog01.blob.core.windows.net/web-app-contents/downloads/ver13/IPD_DL_numeric_7_00.xlsx',
    source_file_url_description:
      'https://sgteprdstaplog01.blob.core.windows.net/web-app-contents/downloads/ver13/IPD_DL_description_7_00_01.xlsx',
    license:
      'JILPT 職業情報データベース; secondary use permitted per jobtag TOS Article 9 with required attribution',
    tos_url: 'https://shigoto.mhlw.go.jp/User/tos',
  };
  await writeFile(
    PROVENANCE_FILE,
    JSON.stringify(provenance, null, 2) + '\n',
    'utf-8',
  );
  console.log(`  wrote ${PROVENANCE_FILE}`);

  const allIds = [...new Set([...descData.keys(), ...numData.keys()])].sort((a, b) => a - b);
  console.log(`\nBuilding ${allIds.length} occupation files ...`);

  let written = 0;
  let hasNumeric = 0;
  let noNumeric = 0;
  const failures: Array<[number, string]> = [];

  for (const occId of allIds) {
    const descRow = descData.get(occId);
    const numRow = numData.get(occId) ?? new Map<string, unknown>();

    if (!descRow) {
      console.error(`  WARN: id=${occId} present in numeric but not description; skipping`);
      continue;
    }

    const titleJa = safeStr(descRow.get('IPD_02_01_001'));
    if (!titleJa) {
      console.error(`  WARN: id=${occId} has no 職業名; skipping`);
      continue;
    }

    let interests: Record<string, number> | null = null;
    let workValues: Record<string, number> | null = null;
    let skills: Record<string, number> | null = null;
    let knowledge: Record<string, number> | null = null;
    let abilities: Record<string, number> | null = null;
    let workCharacteristics: Record<string, number> | null = null;
    let workActivities: Record<string, number> | null = null;
    let educationDistribution: Record<string, number> | null = null;
    let trainingPre: Record<string, number> | null = null;
    let experience: Record<string, number> | null = null;
    let trainingPost: Record<string, number> | null = null;
    let employmentType: Record<string, number> | null = null;
    let tasksLeadJa: string | null = null;
    let tasks: Array<{
      task_id: number;
      description_ja: string;
      execution_rate: number | null;
      importance: number | null;
    }> = [];

    if (numRow.size > 0) {
      interests = buildLabeledDimension(numRow, 'IPD_04_01_', ipdToKey);
      workValues = buildLabeledDimension(numRow, 'IPD_04_02_', ipdToKey);
      skills = buildLabeledDimension(numRow, 'IPD_04_03_01_', ipdToKey);
      knowledge = buildLabeledDimension(numRow, 'IPD_04_04_01_', ipdToKey);
      abilities = buildLabeledDimension(numRow, 'IPD_04_12_', ipdToKey);
      workCharacteristics = buildLabeledDimension(numRow, 'IPD_04_05_', ipdToKey);
      workActivities = buildLabeledDimension(numRow, 'IPD_04_10_', ipdToKey);

      educationDistribution = buildDistribution(numRow, 'IPD_04_06_', EDUCATION_KEYS, numIdx.jaByIpdId);
      trainingPre = buildDistribution(numRow, 'IPD_04_07_', TRAINING_PRE_KEYS, numIdx.jaByIpdId);
      experience = buildDistribution(numRow, 'IPD_04_08_', EXPERIENCE_KEYS, numIdx.jaByIpdId);
      trainingPost = buildDistribution(numRow, 'IPD_04_09_', TRAINING_POST_KEYS, numIdx.jaByIpdId);
      employmentType = buildDistribution(numRow, 'IPD_04_11_', EMPLOYMENT_TYPE_KEYS, numIdx.jaByIpdId);

      const t = buildTasks(numRow);
      tasksLeadJa = t.tasks_lead_ja;
      tasks = t.tasks;
      hasNumeric += 1;
    } else {
      noNumeric += 1;
    }

    const candidate: Occupation = {
      id: occId,
      ipd_id: `IPD_01_01_${String(occId).padStart(3, '0')}`,
      schema_version: '7.00',
      ingested_at: INGESTED_AT,
      title_ja: titleJa,
      aliases_ja: buildAliases(descRow),
      classifications: buildClassifications(descRow),
      description: buildDescription(descRow),
      interests,
      work_values: workValues,
      skills,
      knowledge,
      abilities,
      work_characteristics: workCharacteristics,
      work_activities: workActivities,
      education_distribution: educationDistribution,
      training_pre: trainingPre,
      training_post: trainingPost,
      experience,
      employment_type: employmentType,
      tasks_lead_ja: tasksLeadJa,
      tasks,
      related_orgs: buildRelatedOrgs(descRow),
      related_certs_ja: buildRelatedCerts(descRow),
      url: `https://shigoto.mhlw.go.jp/User/Occupation/Detail/${occId}`,
      data_source_versions: {
        ipd_numeric: IPD_VERSION,
        ipd_description: IPD_VERSION,
        ipd_retrieved_at: INGESTED_AT,
      },
      last_updated_per_section: buildLastUpdated(descRow, numRow),
    };

    const result = OccupationSchema.safeParse(candidate);
    if (!result.success) {
      failures.push([occId, result.error.issues[0]?.message ?? 'unknown']);
      continue;
    }

    const padded = String(occId).padStart(4, '0');
    const outPath = join(OUTPUT_DIR, `${padded}.json`);
    await writeFile(
      outPath,
      JSON.stringify(result.data, null, 2) + '\n',
      'utf-8',
    );
    written += 1;
  }

  console.log(`\nDone:`);
  console.log(`  wrote          ${written} files to ${OUTPUT_DIR}`);
  console.log(`  with numeric   ${hasNumeric}`);
  console.log(`  desc only      ${noNumeric}`);
  console.log(`  failures       ${failures.length}`);
  if (failures.length > 0) {
    console.log('First 5 failures:');
    for (const [id, err] of failures.slice(0, 5)) {
      console.log(`  id=${id}: ${err.slice(0, 200)}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('import-ipd crashed:', err);
  process.exit(1);
});
