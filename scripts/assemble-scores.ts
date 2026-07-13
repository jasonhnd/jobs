#!/usr/bin/env bun
/**
 * assemble-scores.ts — turn raw Opus scoring output (JSONL) into a valid
 * `ScoreRunSchema` batch file. Reusable on every model upgrade
 * (Opus 4.8 → 4.9 → 5.0 …). See docs/SCORING_RUNBOOK.md §3 + 附录 C.
 *
 * LOCAL dev tool — deliberately NOT wired into `build` / `verify:gates` /
 * `vercel.json`. Zero production/deploy impact.
 *
 * Usage:
 *   bun run assemble:scores \
 *     --mode aiois|legacy \
 *     --model claude-opus-4-8 --date 2026-06-01 --prompt-version 2.0 \
 *     --prompt-file data/prompts/2026-06-01_claude-opus-4-8.ja.md \
 *     --in raw-scores.jsonl \
 *     [--out data/scores/occupations_claude-opus-4-8_2026-06-01.json] \
 *     [--run-id occ_2026-06-01_v1] [--operator name] \
 *     [--input-data-version occupations_2026-06] \
 *     [--anchors anchors.json] [--caveat caveat.txt] [--scoring-method "…"]
 *
 * Input JSONL — one line per occupation (Japanese-only site — rationale_ja only):
 *   legacy: {"id":1,"ai_risk":6.9,"rationale_ja":"…","confidence":0.8}
 *   aiois:  …plus required "aiois":{d1..d10,transformation,displacement} — the
 *           full AIOIS-10 contract incl. index-formula re-validation
 *           (docs/SCORING_RUNBOOK.md, Issue #9). Legacy single-axis input is
 *           allowed only via the explicit --mode legacy flag.
 *
 * Exit: 0 = wrote a schema-valid file; 1 = bad args / input / schema-invalid
 * (never writes on failure; never overwrites an existing file — append-only).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { ScoreRunSchema, type Aiois10, type ScoreEntry } from '../src/data/schema/score-run.js';

// ───── Pure, testable core ─────

export interface ParsedScores {
  readonly scores: Record<string, ScoreEntry>;
  readonly errors: readonly string[];
}

/** Raw-line validation mode: 'aiois' = full AIOIS-10 contract (Issue #9+); 'legacy' = single-axis batches. */
export type ParseMode = 'aiois' | 'legacy';

const AIOIS_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'transformation', 'displacement'] as const;
const TOP_KEYS_AIOIS = new Set(['id', 'ai_risk', 'rationale_ja', 'confidence', 'aiois']);
/** Index re-validation tolerance: one 1-decimal rounding step (docs/SCORING_RUNBOOK.md §Execution mechanism). */
const INDEX_TOL = 0.05 + 1e-9;

const isOneDecimalScore = (v: unknown): v is number =>
  typeof v === 'number' && v >= 0 && v <= 10 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;

/**
 * Validate the `aiois` block of one raw line against the AIOIS-10 v1.0 contract:
 * 12 required one-decimal fields, no extras, ai_risk === transformation, and the
 * /standard index formulas re-computed within ±0.05. No silent correction —
 * a violation fails the line so the occupation is re-scored.
 * Pushes one error and returns null on the first violation.
 */
function validateAiois(
  obj: Record<string, unknown>,
  where: string,
  aiRisk: number,
  errors: string[],
): Aiois10 | null {
  const raw = obj.aiois;
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`${where}: aiois object with 12 fields required`);
    return null;
  }
  const a = raw as Record<string, unknown>;
  const unknown = Object.keys(a).filter((k) => !(AIOIS_KEYS as readonly string[]).includes(k));
  if (unknown.length) {
    errors.push(`${where}: unknown aiois field(s): ${unknown.join(', ')}`);
    return null;
  }
  for (const k of AIOIS_KEYS) {
    if (!isOneDecimalScore(a[k])) {
      errors.push(`${where}: aiois.${k} must be 0.0–10.0 with ≤1 decimal, got ${JSON.stringify(a[k])}`);
      return null;
    }
  }
  const v = a as Record<(typeof AIOIS_KEYS)[number], number>;
  if (aiRisk !== v.transformation) {
    errors.push(`${where}: ai_risk ${aiRisk} must equal aiois.transformation ${v.transformation}`);
    return null;
  }
  const e = (v.d1 + v.d2) / 2;
  if (Math.abs(v.transformation - e) > INDEX_TOL) {
    errors.push(`${where}: transformation ${v.transformation} must equal mean(d1,d2) = ${e.toFixed(2)} (±0.05)`);
    return null;
  }
  const m = (v.d3 + v.d4 + v.d5 + v.d6 + v.d7) / 5;
  const p = (v.d8 + v.d9) / 2;
  const dispRaw = e * (1 - m / 10) * (0.6 + (0.4 * (p + v.d10)) / 20);
  const dispClamped = Math.min(10, Math.max(0, dispRaw));
  if (Math.abs(v.displacement - dispClamped) > INDEX_TOL) {
    errors.push(`${where}: displacement ${v.displacement} must equal formula value ${dispClamped.toFixed(2)} (±0.05)`);
    return null;
  }
  return {
    d1: v.d1, d2: v.d2, d3: v.d3, d4: v.d4, d5: v.d5,
    d6: v.d6, d7: v.d7, d8: v.d8, d9: v.d9, d10: v.d10,
    transformation: v.transformation, displacement: v.displacement,
  };
}

/** Validate one raw JSONL line. Returns the parsed entry, or null after pushing one error. */
function parseLine(
  line: string,
  lineNo: number,
  mode: ParseMode,
  errors: string[],
): { id: number; entry: ScoreEntry } | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line) as Record<string, unknown>;
  } catch {
    errors.push(`line ${lineNo}: invalid JSON`);
    return null;
  }
  const id = obj.id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > 999) {
    errors.push(`line ${lineNo}: bad id ${JSON.stringify(id)}`);
    return null;
  }
  const where = `line ${lineNo} (id ${id})`;
  const r = obj.ai_risk;
  if (!isOneDecimalScore(r)) {
    errors.push(`${where}: ai_risk must be 0.0–10.0 with ≤1 decimal, got ${JSON.stringify(r)}`);
    return null;
  }
  if (typeof obj.rationale_ja !== 'string' || obj.rationale_ja.length === 0) {
    errors.push(`${where}: rationale_ja required (non-empty)`);
    return null;
  }
  const conf = obj.confidence;
  if (conf != null && (typeof conf !== 'number' || conf < 0 || conf > 1)) {
    errors.push(`${where}: confidence must be 0–1 or omitted`);
    return null;
  }
  if (mode === 'legacy') {
    if ('aiois' in obj) {
      errors.push(`${where}: aiois present — legacy mode would silently drop it; re-run with --mode aiois`);
      return null;
    }
    return {
      id,
      entry: { ai_risk: r, rationale_ja: obj.rationale_ja, confidence: typeof conf === 'number' ? conf : null },
    };
  }
  // aiois mode — the full AIOIS-10 contract.
  const extra = Object.keys(obj).filter((k) => !TOP_KEYS_AIOIS.has(k));
  if (extra.length) {
    errors.push(`${where}: unknown field(s): ${extra.join(', ')}`);
    return null;
  }
  if (typeof conf !== 'number') {
    errors.push(`${where}: confidence required (0–1) in aiois mode`);
    return null;
  }
  const aiois = validateAiois(obj, where, r, errors);
  if (!aiois) return null;
  return { id, entry: { ai_risk: r, rationale_ja: obj.rationale_ja, confidence: conf, aiois } };
}

/**
 * Parse + validate raw JSONL lines into a `scores` map.
 * Collects all errors (no throw).
 */
export function parseScoreLines(lines: readonly string[], mode: ParseMode): ParsedScores {
  const scores: Record<string, ScoreEntry> = {};
  const errors: string[] = [];
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const parsed = parseLine(line, idx + 1, mode, errors);
    if (!parsed) return;
    const key = String(parsed.id);
    if (scores[key]) {
      errors.push(`line ${idx + 1}: duplicate id ${parsed.id}`);
      return;
    }
    scores[key] = parsed.entry;
  });
  return { scores, errors };
}

export interface BatchMeta {
  readonly model: string;
  readonly modelProvider: string;
  readonly date: string;
  readonly promptVersion: string;
  readonly promptFile: string;
  readonly runId: string;
  readonly operator: string | null;
  readonly inputDataVersion: string;
  readonly inputDataSha256: string | null;
  readonly promptSha256: string | null;
  readonly anchors: Record<string, string>;
  readonly caveat: string;
  readonly occupationCountScored: number;
  readonly occupationCountSkipped: number;
  readonly scoringMethod: string;
}

/** Infer the model provider from a model id prefix. Override with --provider. */
export function inferProvider(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3')) return 'openai';
  if (m.startsWith('claude')) return 'anthropic';
  if (m.startsWith('gemini')) return 'google';
  return 'anthropic';
}

/** Assemble the full ScoreRun object (validate separately via ScoreRunSchema). */
export function assembleBatch(scores: Record<string, ScoreEntry>, meta: BatchMeta): unknown {
  return {
    schema_version: '2.1',
    scope: 'occupations',
    scorer: {
      model: meta.model,
      model_provider: meta.modelProvider,
      model_temperature: null,
      scoring_method: meta.scoringMethod,
    },
    run: { run_date: meta.date, run_id: meta.runId, duration_minutes: null, operator: meta.operator },
    input: {
      input_data_version: meta.inputDataVersion,
      input_data_sha256: meta.inputDataSha256,
      occupation_count_scored: meta.occupationCountScored,
      occupation_count_skipped: meta.occupationCountSkipped,
    },
    prompt: {
      prompt_version: meta.promptVersion,
      prompt_file: meta.promptFile,
      prompt_sha256: meta.promptSha256,
      rubric_source: meta.promptFile,
    },
    anchors: meta.anchors,
    caveat: meta.caveat,
    scores,
  };
}

// ───── CLI wrapper (only runs when executed directly, not when imported) ─────

if (import.meta.main) {
  const ROOT = resolve(import.meta.dir, '..');
  const OCC_DIR = join(ROOT, 'data', 'occupations');
  const SCORES_DIR = join(ROOT, 'data', 'scores');
  const fail = (m: string): never => {
    console.error(`[assemble-scores] FAIL — ${m}`);
    process.exit(1);
  };

  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) fail(`--${a.slice(2)} needs a value`);
      args[a.slice(2)] = v as string;
      i += 1;
    }
  }
  const need = (k: string): string => args[k] ?? fail(`missing --${k}`);

  const modeArg = need('mode');
  if (modeArg !== 'aiois' && modeArg !== 'legacy') fail(`--mode must be "aiois" or "legacy", got "${modeArg}"`);
  const mode: ParseMode = modeArg;
  const model = need('model');
  // Provider: explicit --provider wins; else infer from the model id prefix.
  const provider = args['provider'] ?? inferProvider(model);
  const date = need('date');
  const promptVersion = need('prompt-version');
  const promptFile = args['prompt-file'] ?? 'data/prompts/prompt.ja.md';
  const inPath = resolve(need('in'));
  const outPath = resolve(args['out'] ?? join(SCORES_DIR, `occupations_${model}_${date}.json`));

  if (!existsSync(inPath)) fail(`--in not found: ${inPath}`);
  if (existsSync(outPath)) fail(`--out already exists (append-only; never overwrite): ${outPath}`);

  const { scores, errors } = parseScoreLines(readFileSync(inPath, 'utf8').split('\n'), mode);
  if (errors.length) {
    console.error(`[assemble-scores] FAIL — ${errors.length} input error(s):`);
    errors.slice(0, 30).forEach((e) => console.error(`  ${e}`));
    if (errors.length > 30) console.error(`  …and ${errors.length - 30} more.`);
    process.exit(1);
  }

  const realOccIds = new Set(
    readdirSync(OCC_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => Number.parseInt(f.replace(/\.json$/, ''), 10))
      .filter((n) => Number.isFinite(n)),
  );
  const scoredIds = Object.keys(scores).map((k) => Number.parseInt(k, 10));
  const extra = scoredIds.filter((id) => !realOccIds.has(id)).sort((a, b) => a - b);
  if (extra.length) fail(`${extra.length} scored id(s) have no occupation file: ${extra.slice(0, 20).join(', ')}`);
  const missing = [...realOccIds].filter((id) => !scoredIds.includes(id)).sort((a, b) => a - b);

  const occHash = createHash('sha256');
  readdirSync(OCC_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .forEach((f) => occHash.update(readFileSync(join(OCC_DIR, f))));
  const inputDataSha256 = occHash.digest('hex');
  const promptAbs = resolve(ROOT, promptFile);
  const promptSha256 = existsSync(promptAbs)
    ? createHash('sha256').update(readFileSync(promptAbs)).digest('hex')
    : null;

  // anchors/caveat: from --anchors/--caveat, else carry from the latest batch.
  let carriedAnchors: Record<string, string> | undefined;
  let carriedCaveat: string | undefined;
  let latestDate = '';
  for (const f of readdirSync(SCORES_DIR).filter((x) => x.endsWith('.json'))) {
    try {
      const b = JSON.parse(readFileSync(join(SCORES_DIR, f), 'utf8')) as {
        scope?: string;
        run?: { run_date?: string };
        anchors?: Record<string, string>;
        caveat?: string;
      };
      if (b.scope === 'occupations' && b.run?.run_date && b.run.run_date > latestDate) {
        latestDate = b.run.run_date;
        carriedAnchors = b.anchors;
        carriedCaveat = b.caveat;
      }
    } catch {
      /* skip unreadable */
    }
  }
  const anchors: Record<string, string> | undefined = args['anchors']
    ? (JSON.parse(readFileSync(resolve(args['anchors']), 'utf8')) as Record<string, string>)
    : carriedAnchors;
  const caveat = args['caveat'] ? readFileSync(resolve(args['caveat']), 'utf8').trim() : carriedCaveat;
  if (!anchors) fail('no anchors (pass --anchors or have an existing batch to carry from)');
  if (!caveat) fail('no caveat (pass --caveat or have an existing batch to carry from)');

  const batch = assembleBatch(scores, {
    model,
    modelProvider: provider,
    date,
    promptVersion,
    promptFile,
    runId: args['run-id'] ?? `occ_${date}_v1`,
    operator: args['operator'] ?? null,
    inputDataVersion: args['input-data-version'] ?? `occupations_${date}`,
    inputDataSha256,
    promptSha256,
    anchors,
    caveat,
    occupationCountScored: scoredIds.length,
    occupationCountSkipped: missing.length,
    scoringMethod:
      args['scoring-method'] ??
      (mode === 'aiois'
        ? 'AIOIS-10 v1.0: in-session single-pass per occupation; model-judged D1–D10, indices per /standard formulas (re-validated)'
        : 'single-pass per occupation'),
  });

  const parsed = ScoreRunSchema.safeParse(batch);
  if (!parsed.success) {
    console.error('[assemble-scores] FAIL — assembled object does not pass ScoreRunSchema:');
    parsed.error.issues.slice(0, 30).forEach((i) => console.error(`  ${i.path.join('.') || '<root>'}: ${i.message}`));
    process.exit(1);
  }

  writeFileSync(outPath, `${JSON.stringify(parsed.data, null, 2)}\n`);
  console.log(`[assemble-scores] OK → ${outPath}`);
  console.log(
    `  scored ${scoredIds.length}/${realOccIds.size}; missing ${missing.length}` +
      `${missing.length ? ` (${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''})` : ''}`,
  );
  console.log(`  next: bun run check:score-batch ${outPath}`);
}
