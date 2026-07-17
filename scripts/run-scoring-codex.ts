#!/usr/bin/env bun
/**
 * run-scoring-codex.ts — score occupations with the locally logged-in Codex CLI
 * subscription, emitting the same raw JSONL contract consumed by
 * `assemble:scores`.
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / vercel.json.
 * Needs a locally authenticated Codex CLI. Makes real subscription-backed model
 * calls only when this file is executed directly.
 *
 * Usage:
 *   bun scripts/run-scoring-codex.ts \
 *     --prompt-file data/prompts/2026-06-13_claude-fable-5-aiois10.ja.md \
 *     --out raw-scores.jsonl \
 *     [--model gpt-5.6-sol] [--limit N] [--ids 1,2,3] [--resume] [--concurrency 2]
 *
 * Output JSONL (one line per occupation):
 *   {id, ai_risk, rationale_ja, confidence, aiois:{d1..d10,transformation,displacement}}
 * → next: bun run assemble:scores --mode aiois --in raw-scores.jsonl …
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { z } from 'zod';
import { loadOccupationExtracts, type OccExtract } from './scoring-occupation.js';

const ROOT = resolve(import.meta.dir, '..');
const OCC_DIR = join(ROOT, 'data', 'occupations');
const MAX_ATTEMPTS = 3;
const MAX_CONCURRENCY = 4;
const DEFAULT_MODEL = 'gpt-5.6-sol';

const fail = (m: string): never => {
  console.error(`[run-scoring-codex] FAIL — ${m}`);
  process.exit(1);
};

const oneDecimalScore = z
  .number()
  .min(0)
  .max(10)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, {
    message: 'must have at most one decimal place',
  });

const AIOIS_INDEX_TOL = 0.05 + 1e-9;

const AioisOutputSchema = z
  .object({
    d1: oneDecimalScore,
    d2: oneDecimalScore,
    d3: oneDecimalScore,
    d4: oneDecimalScore,
    d5: oneDecimalScore,
    d6: oneDecimalScore,
    d7: oneDecimalScore,
    d8: oneDecimalScore,
    d9: oneDecimalScore,
    d10: oneDecimalScore,
    transformation: oneDecimalScore,
    displacement: oneDecimalScore,
  })
  .strict();

const CodexScoreSchema = z
  .object({
    id: z.number().int().min(1).max(999),
    ai_risk: oneDecimalScore,
    rationale_ja: z.string().min(1),
    confidence: z.number().min(0).max(1),
    aiois: AioisOutputSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.ai_risk !== value.aiois.transformation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ai_risk'],
        message: 'must equal aiois.transformation',
      });
    }
    const e = (value.aiois.d1 + value.aiois.d2) / 2;
    if (Math.abs(value.aiois.transformation - e) > AIOIS_INDEX_TOL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aiois', 'transformation'],
        message: `must equal mean(d1,d2) within ±0.05 (expected ${e.toFixed(2)})`,
      });
    }
    const m = (value.aiois.d3 + value.aiois.d4 + value.aiois.d5 + value.aiois.d6 + value.aiois.d7) / 5;
    const p = (value.aiois.d8 + value.aiois.d9) / 2;
    const displacement = Math.min(10, Math.max(0, e * (1 - m / 10) * (0.6 + (0.4 * (p + value.aiois.d10)) / 20)));
    if (Math.abs(value.aiois.displacement - displacement) > AIOIS_INDEX_TOL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aiois', 'displacement'],
        message: `must equal formula value within ±0.05 (expected ${displacement.toFixed(2)})`,
      });
    }
  });

export type CodexScore = z.infer<typeof CodexScoreSchema>;

export interface CodexScoringArgs {
  readonly promptFile: string;
  readonly outPath: string;
  readonly model: string;
  readonly limit: number | null;
  readonly ids: readonly number[] | null;
  readonly resume: boolean;
  readonly concurrency: number;
  readonly runName: string;
}

export interface CodexExecOptions {
  readonly cwd: string;
  readonly model: string;
  readonly outputSchemaPath: string;
  readonly outputLastMessagePath: string;
}

export interface CodexModelProbeResult {
  readonly command: readonly string[];
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

export interface CodexExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly rawText: string;
}

export type CodexExecutor = (prompt: string, options: CodexExecOptions) => Promise<CodexExecResult>;

export interface AttemptFailure {
  readonly attempt: number;
  readonly message: string;
}

export interface ScoreSuccess {
  readonly ok: true;
  readonly id: number;
  readonly score: CodexScore;
  readonly attempts: number;
}

export interface ScoreFailure {
  readonly ok: false;
  readonly id: number;
  readonly attempts: number;
  readonly failures: readonly AttemptFailure[];
}

export const CODEX_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1, maximum: 999 },
    ai_risk: { type: 'number', minimum: 0, maximum: 10 },
    rationale_ja: { type: 'string', minLength: 1 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    aiois: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'transformation', 'displacement'].map((k) => [
          k,
          { type: 'number', minimum: 0, maximum: 10 },
        ]),
      ),
      required: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'transformation', 'displacement'],
    },
  },
  required: ['id', 'ai_risk', 'rationale_ja', 'confidence', 'aiois'],
} as const;

export function parseArgs(argv: readonly string[], root = ROOT, now = new Date()): CodexScoringArgs {
  const raw: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) raw[key] = 'true';
    else {
      raw[key] = v;
      i += 1;
    }
  }
  if (!raw['prompt-file'] || raw['prompt-file'] === 'true') {
    throw new Error('missing required --prompt-file <path>');
  }
  const promptFile = resolve(root, raw['prompt-file']);
  const outPath = resolve(raw['out'] ?? join(root, 'raw-scores.jsonl'));
  const model = raw['model'] ?? DEFAULT_MODEL;
  const limit = raw['limit'] ? parsePositiveInt(raw['limit'], '--limit') : null;
  const concurrency = Math.min(parsePositiveInt(raw['concurrency'] ?? '2', '--concurrency'), MAX_CONCURRENCY);
  const ids = raw['ids']
    ? raw['ids']
        .split(',')
        .map((s) => parsePositiveInt(s.trim(), '--ids'))
    : null;
  const runName = raw['run-name'] ?? buildRunName(model, outPath, now);
  return {
    promptFile,
    outPath,
    model,
    limit,
    ids,
    resume: raw['resume'] === 'true',
    concurrency,
    runName: sanitizeRunName(runName),
  };
}

function parsePositiveInt(value: string, flag: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1 || String(n) !== value.trim()) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return n;
}

export function buildRunName(model: string, outPath: string, now = new Date()): string {
  const stem = basename(outPath, extname(outPath)) || 'raw-scores';
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return sanitizeRunName(`${stem}-${model}-${stamp}`);
}

export function sanitizeRunName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'codex-scoring';
}

export function completedIdsFromJsonl(text: string): Set<number> {
  const done = new Set<number>();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const id = (JSON.parse(line) as { id?: unknown }).id;
      if (typeof id === 'number' && Number.isInteger(id)) done.add(id);
    } catch {
      // Ignore corrupt partial lines; validation happens in assemble-scores.
    }
  }
  return done;
}

export function selectPendingOccupations(
  allOccs: readonly OccExtract[],
  args: Pick<CodexScoringArgs, 'ids' | 'limit'>,
  completedIds: ReadonlySet<number>,
): OccExtract[] {
  let occs = [...allOccs];
  if (args.ids) {
    const want = new Set(args.ids);
    occs = occs.filter((o) => want.has(o.id));
  }
  occs = occs.filter((o) => !completedIds.has(o.id));
  if (args.limit) occs = occs.slice(0, args.limit);
  return occs;
}

export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1]!.trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

export function validateAndNormalizeResponse(raw: string, expectedId: number): CodexScore {
  const reportedError = explicitScoringError(raw);
  if (reportedError) {
    throw new Error(`scoring response reported an upstream error/refusal: ${reportedError}`);
  }
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`invalid JSON: ${(err as Error).message}`);
  }
  const result = CodexScoreSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
    throw new Error(`schema validation failed: ${issues}`);
  }
  if (result.data.id !== expectedId) {
    throw new Error(`id mismatch: expected ${expectedId}, got ${result.data.id}`);
  }
  if (isSyntheticZeroPlaceholder(result.data)) {
    throw new Error('scoring response is a synthetic all-zero placeholder');
  }
  return result.data;
}

const EXPLICIT_SCORING_ERROR_PATTERNS: readonly RegExp[] = [
  /\b(?:requested\s+)?model\b.{0,80}\b(?:unavailable|not\s+available|not\s+found|unsupported|does\s+not\s+exist|cannot\s+be\s+used)\b/i,
  /\b(?:provider|upstream|inference|service)\b.{0,80}\b(?:error|failed|failure|unavailable|overloaded)\b/i,
  /\b(?:i\s+cannot|i\s+can't|i\s+am\s+unable|i'm\s+unable|cannot\s+comply|refus(?:e|al|ed|ing))\b/i,
  /(?:指定|要求).{0,24}モデル.{0,40}(?:利用できません|見つかりません|対応していません)/,
  /(?:プロバイダ|上流|推論|サービス).{0,40}(?:エラー|失敗|利用できません)/,
];

export function explicitScoringError(raw: string): string | null {
  const compact = raw.replace(/\s+/g, ' ').trim();
  for (const pattern of EXPLICIT_SCORING_ERROR_PATTERNS) {
    const match = compact.match(pattern);
    if (match) return match[0].slice(0, 200);
  }
  return null;
}

export function isSyntheticZeroPlaceholder(score: CodexScore): boolean {
  const values = [
    score.ai_risk,
    score.aiois.d1,
    score.aiois.d2,
    score.aiois.d3,
    score.aiois.d4,
    score.aiois.d5,
    score.aiois.d6,
    score.aiois.d7,
    score.aiois.d8,
    score.aiois.d9,
    score.aiois.d10,
    score.aiois.transformation,
    score.aiois.displacement,
  ];
  return score.confidence === 0 && values.every((value) => value === 0);
}

export function scoreToJsonLine(score: CodexScore): string {
  return JSON.stringify({
    id: score.id,
    ai_risk: score.ai_risk,
    rationale_ja: score.rationale_ja,
    confidence: score.confidence,
    aiois: {
      d1: score.aiois.d1,
      d2: score.aiois.d2,
      d3: score.aiois.d3,
      d4: score.aiois.d4,
      d5: score.aiois.d5,
      d6: score.aiois.d6,
      d7: score.aiois.d7,
      d8: score.aiois.d8,
      d9: score.aiois.d9,
      d10: score.aiois.d10,
      transformation: score.aiois.transformation,
      displacement: score.aiois.displacement,
    },
  });
}

export function buildPrompt(rubric: string, occ: OccExtract): string {
  return `${rubric.trim()}

以下の職業を AIOIS-10 v1.0 で採点してください。

出力は JSON object だけにしてください。Markdown、説明文、配列 wrapper、複数 object は禁止です。
必須 field は id, ai_risk, rationale_ja, confidence, aiois.d1..d10, aiois.transformation, aiois.displacement です。
ai_risk は aiois.transformation と厳密に同じ数値にしてください。
0-10 の score は最大 1 桁小数、confidence は 0-1 の数値です。
id は必ず ${occ.id} にしてください。

職業:
${occ.text}
`;
}

export function isTransientCliError(text: string): boolean {
  return /\b(429|rate.?limit|too many requests|temporar(?:y|ily)|timeout|timed out|ECONNRESET|ETIMEDOUT|overloaded|unavailable)\b/i.test(text);
}

export function retryDelayMs(attempt: number, transient: boolean, random = Math.random): number {
  if (!transient) return 0;
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base + random() * 500);
}

export async function scoreOccupationWithRetries(
  occ: OccExtract,
  rubric: string,
  options: Omit<CodexExecOptions, 'outputLastMessagePath'> & { readonly tmpDir: string; readonly rawDir: string },
  executor: CodexExecutor,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
): Promise<ScoreSuccess | ScoreFailure> {
  const failures: AttemptFailure[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const outputLastMessagePath = join(options.tmpDir, `${String(occ.id).padStart(4, '0')}-attempt-${attempt}.txt`);
    let raw = '';
    try {
      const result = await executor(buildPrompt(rubric, occ), { ...options, outputLastMessagePath });
      raw = result.rawText || result.stdout;
      saveRawResponse(options.rawDir, occ.id, attempt, raw);
      if (result.exitCode !== 0) {
        throw new Error(`codex exit ${result.exitCode}: ${result.stderr || result.stdout || raw}`);
      }
      const score = validateAndNormalizeResponse(raw, occ.id);
      return { ok: true, id: occ.id, score, attempts: attempt };
    } catch (err) {
      const message = (err as Error).message;
      failures.push({ attempt, message });
      saveAttemptFailure(options.rawDir, occ.id, attempt, message);
      const transient = isTransientCliError(`${message}\n${raw}`);
      const delay = retryDelayMs(attempt, transient);
      if (attempt < MAX_ATTEMPTS && delay > 0) await sleep(delay);
    } finally {
      if (existsSync(outputLastMessagePath)) {
        try {
          unlinkSync(outputLastMessagePath);
        } catch {
          // Best effort cleanup only.
        }
      }
    }
  }
  return { ok: false, id: occ.id, attempts: MAX_ATTEMPTS, failures };
}

export function saveRawResponse(rawDir: string, id: number, attempt: number, raw: string): void {
  mkdirSync(rawDir, { recursive: true });
  const path = join(rawDir, `${id}.txt`);
  const body = attempt === 1 ? raw : `\n\n--- attempt ${attempt} ---\n${raw}`;
  appendFileSync(path, body);
}

export function saveAttemptFailure(rawDir: string, id: number, attempt: number, message: string): void {
  mkdirSync(rawDir, { recursive: true });
  appendFileSync(join(rawDir, `${id}.failures.jsonl`), `${JSON.stringify({ attempt, message })}\n`);
}

export function codexExecSupportsModel(helpText: string): boolean {
  return /(?:^|\n)\s*-m,\s*--model\s+<MODEL>|(?:^|\n)\s*--model\s+<MODEL>/m.test(helpText);
}

export function probeCodexModelSupport(): CodexModelProbeResult {
  const res = spawnSync('codex', ['exec', '--help'], { encoding: 'utf8' });
  return {
    command: ['codex', 'exec', '--help'],
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    error: res.error?.message ?? null,
  };
}

export function assertCodexModelSupport(probe: CodexModelProbeResult): void {
  if (probe.error) {
    throw new Error(`unable to run ${probe.command.join(' ')}: ${probe.error}`);
  }
  if (probe.status !== 0) {
    const detail = (probe.stderr || probe.stdout).trim();
    throw new Error(
      `${probe.command.join(' ')} exited with status ${String(probe.status)}` + (detail ? `: ${detail}` : ''),
    );
  }
  if (!codexExecSupportsModel(`${probe.stdout}\n${probe.stderr}`)) {
    throw new Error('installed Codex CLI does not advertise codex exec --model <MODEL>; upgrade Codex before scoring');
  }
}

export function buildCodexExecArgs(options: CodexExecOptions): string[] {
  return [
    'exec',
    '--ephemeral',
    '--cd',
    options.cwd,
    '--color',
    'never',
    '--output-schema',
    options.outputSchemaPath,
    '--output-last-message',
    options.outputLastMessagePath,
    '--model',
    options.model,
    '-',
  ];
}

export const runCodexExec: CodexExecutor = (prompt, options) =>
  new Promise((resolveExec) => {
    const cmd = buildCodexExecArgs(options);

    const child = spawn('codex', cmd, { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      resolveExec({ exitCode: 1, stdout, stderr: `${stderr}\n${err.message}`.trim(), rawText: stdout });
    });
    child.on('close', (code) => {
      const rawText = existsSync(options.outputLastMessagePath)
        ? readFileSync(options.outputLastMessagePath, 'utf8')
        : stdout;
      resolveExec({ exitCode: code ?? 1, stdout, stderr, rawText });
    });
    child.stdin.end(prompt, 'utf8');
  });

export async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      await worker(items[idx]!, idx);
    }
  });
  await Promise.all(workers);
}

if (import.meta.main) {
  let args: CodexScoringArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    fail((err as Error).message);
  }

  const modelProbe = probeCodexModelSupport();
  try {
    assertCodexModelSupport(modelProbe);
  } catch (err) {
    fail((err as Error).message);
  }

  if (!existsSync(args.promptFile)) fail(`prompt file not found: ${args.promptFile}`);
  const rubric = readFileSync(args.promptFile, 'utf8');
  const completed = args.resume && existsSync(args.outPath) ? completedIdsFromJsonl(readFileSync(args.outPath, 'utf8')) : new Set<number>();
  const occs = selectPendingOccupations(loadOccupationExtracts(OCC_DIR), args, completed);
  if (occs.length === 0) fail('no occupations to score (all done via --resume? bad --ids?)');
  if (!args.resume) writeFileSync(args.outPath, '');

  const runDir = join(ROOT, '.cache', 'scoring', args.runName);
  const rawDir = join(runDir, 'raw');
  const tmpDir = join(runDir, 'tmp');
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  const outputSchemaPath = join(runDir, 'codex-score.schema.json');
  writeFileSync(outputSchemaPath, `${JSON.stringify(CODEX_OUTPUT_JSON_SCHEMA, null, 2)}\n`);
  writeFileSync(
    join(runDir, 'codex-model-preflight.json'),
    `${JSON.stringify(
      {
        command: modelProbe.command,
        status: modelProbe.status,
        requested_model: args.model,
        explicit_model_flag: true,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `[run-scoring-codex] ${occs.length} occupations · model=${args.model}` +
      ` · concurrency=${args.concurrency} · run=${args.runName}`,
  );
  if (completed.size) console.log(`  resume: skipping ${completed.size} completed id(s) from ${args.outPath}`);
  console.log(`  raw audit: ${rawDir}`);

  const failures: ScoreFailure[] = [];
  let ok = 0;
  await mapLimit(occs, args.concurrency, async (occ) => {
    const result = await scoreOccupationWithRetries(
      occ,
      rubric,
      { cwd: ROOT, model: args.model, outputSchemaPath, tmpDir, rawDir },
      runCodexExec,
    );
    if (result.ok) {
      appendFileSync(args.outPath, `${scoreToJsonLine(result.score)}\n`);
      ok += 1;
      console.log(`  ok id=${occ.id} attempt=${result.attempts} (${ok}/${occs.length})`);
    } else {
      failures.push(result);
      const last = result.failures[result.failures.length - 1]?.message ?? 'unknown error';
      console.error(`  fail id=${occ.id} attempts=${result.attempts}: ${last}`);
    }
  });

  console.log(`[run-scoring-codex] done — ${ok} scored → ${args.outPath}`);
  if (failures.length) {
    console.error(`  failures ${failures.length}: ${failures.map((f) => f.id).sort((a, b) => a - b).join(', ')}`);
    failures.slice(0, 20).forEach((f) => {
      const last = f.failures[f.failures.length - 1];
      console.error(`    id=${f.id}: ${last?.message ?? 'unknown error'}`);
    });
    process.exitCode = 1;
  }
  console.log(
    `  next: bun run assemble:scores --mode aiois --model ${args.model} --date <YYYY-MM-DD> ` +
      `--prompt-version AIOIS-10-v1.0-${args.model} --prompt-file ${args.promptFile} --in ${args.outPath} ` +
      `--out data/scores/occupations_${args.model}_<date>.json`,
  );
}
