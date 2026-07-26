/**
 * core.ts — the provider-independent scoring runner.
 *
 * Owns everything that must behave identically no matter which model is
 * scoring: prompt assembly, contract validation, retry accounting, backoff,
 * the raw/failure audit trail, resume, concurrency, and the output JSONL.
 *
 * Providers plug in through `ScoringProvider` (see provider.ts); they supply
 * transport only.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

import {
  ScoreSchema,
  extractJsonObject,
  isSyntheticZeroPlaceholder,
  scoreToJsonLine,
  type ScoredOccupation,
} from './contract.js';
import {
  ScoringError,
  classifyErrorText,
  explicitScoringError,
  kindOf,
  shouldBackoff,
  shouldRetry,
  type ScoringErrorKind,
} from './errors.js';
import type { AskOptions, ScoringExecutor, ScoringProvider } from './provider.js';
import type { OccExtract } from '../../scoring-occupation.js';

export const MAX_ATTEMPTS = 3;

export interface ScoringArgs {
  readonly provider: string;
  readonly promptFile: string;
  readonly outPath: string;
  readonly model: string;
  readonly limit: number | null;
  readonly ids: readonly number[] | null;
  readonly resume: boolean;
  readonly concurrency: number;
  readonly runName: string;
  /** Every parsed flag, forwarded to the provider for vendor-specific options. */
  readonly providerOptions: Readonly<Record<string, string>>;
}

export interface AttemptFailure {
  readonly attempt: number;
  readonly kind: ScoringErrorKind;
  readonly message: string;
}

export interface ScoreSuccess {
  readonly ok: true;
  readonly id: number;
  readonly score: ScoredOccupation;
  readonly attempts: number;
}

export interface ScoreFailure {
  readonly ok: false;
  readonly id: number;
  readonly attempts: number;
  readonly failures: readonly AttemptFailure[];
}

// ─── argument parsing ────────────────────────────────────────────

export function parseArgs(
  argv: readonly string[],
  root: string,
  now = new Date(),
  defaults: {
    readonly provider?: string;
    readonly model?: string;
    /** Cap applied at parse time so `--concurrency 99` is normalised before it is logged. */
    readonly maxConcurrency?: number;
  } = {},
): ScoringArgs {
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
  const provider = raw['provider'] ?? defaults.provider ?? '';
  if (!provider || provider === 'true') {
    throw new Error('missing required --provider <name>');
  }
  const model = raw['model'] ?? defaults.model ?? '';
  if (!model || model === 'true') {
    throw new Error('missing required --model <name>');
  }
  const promptFile = resolve(root, raw['prompt-file']);
  const outPath = resolve(raw['out'] ?? join(root, 'raw-scores.jsonl'));
  const limit = raw['limit'] ? parsePositiveInt(raw['limit'], '--limit') : null;
  const concurrency = Math.min(
    parsePositiveInt(raw['concurrency'] ?? '2', '--concurrency'),
    defaults.maxConcurrency ?? Number.MAX_SAFE_INTEGER,
  );
  const ids = raw['ids'] ? raw['ids'].split(',').map((s) => parsePositiveInt(s.trim(), '--ids')) : null;
  const runName = raw['run-name'] ?? buildRunName(model, outPath, now);
  return {
    provider,
    promptFile,
    outPath,
    model,
    limit,
    ids,
    resume: raw['resume'] === 'true',
    concurrency,
    runName: sanitizeRunName(runName),
    providerOptions: Object.freeze({ ...raw }),
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
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'scoring';
}

// ─── resume ──────────────────────────────────────────────────────

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
  args: Pick<ScoringArgs, 'ids' | 'limit'>,
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

// ─── prompt ──────────────────────────────────────────────────────

/**
 * Assemble the per-occupation prompt: frozen rubric + contract instructions +
 * the occupation extract.
 *
 * BYTE-STABLE ON PURPOSE. The rubric file's hash is recorded in every batch's
 * provenance, but the text appended here is not — so changing a character
 * below silently makes past batches unreproducible. Providers with native
 * schema enforcement get the same text; the redundancy costs a few tokens and
 * keeps one prompt shape across vendors.
 */
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

// ─── validation ──────────────────────────────────────────────────

export function validateAndNormalizeResponse(raw: string, expectedId: number): ScoredOccupation {
  const reportedError = explicitScoringError(raw);
  if (reportedError) {
    throw new ScoringError(
      classifyErrorText(reportedError),
      `scoring response reported an upstream error/refusal: ${reportedError}`,
    );
  }
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new ScoringError('malformed', `invalid JSON: ${(err as Error).message}`);
  }
  const result = ScoreSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
    throw new ScoringError('contract_violation', `schema validation failed: ${issues}`);
  }
  if (result.data.id !== expectedId) {
    throw new ScoringError('contract_violation', `id mismatch: expected ${expectedId}, got ${result.data.id}`);
  }
  if (isSyntheticZeroPlaceholder(result.data)) {
    throw new ScoringError('refusal', 'scoring response is a synthetic all-zero placeholder');
  }
  return result.data;
}

// ─── retry ───────────────────────────────────────────────────────

export function retryDelayMs(attempt: number, transient: boolean, random = Math.random): number {
  if (!transient) return 0;
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base + random() * 500);
}

export async function scoreOccupationWithRetries(
  occ: OccExtract,
  rubric: string,
  options: Omit<AskOptions, 'outputLastMessagePath' | 'occId' | 'attempt'> & {
    readonly tmpDir: string;
    readonly rawDir: string;
    /** Defaults to MAX_ATTEMPTS; deterministic providers pass 1. */
    readonly maxAttempts?: number;
  },
  executor: ScoringExecutor,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  classifyError?: (text: string) => ScoringErrorKind | null,
): Promise<ScoreSuccess | ScoreFailure> {
  const failures: AttemptFailure[] = [];
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outputLastMessagePath = join(options.tmpDir, `${String(occ.id).padStart(4, '0')}-attempt-${attempt}.txt`);
    let raw = '';
    try {
      const result = await executor(buildPrompt(rubric, occ), {
        ...options,
        outputLastMessagePath,
        occId: occ.id,
        attempt,
      });
      raw = result.rawText || result.stdout;
      saveRawResponse(options.rawDir, occ.id, attempt, raw);
      if (result.exitCode !== 0) {
        const detail = result.stderr || result.stdout || raw;
        throw new ScoringError(
          classifyError?.(detail) ?? classifyErrorText(detail),
          `provider exit ${result.exitCode}: ${detail}`,
        );
      }
      const score = validateAndNormalizeResponse(raw, occ.id);
      return { ok: true, id: occ.id, score, attempts: attempt };
    } catch (err) {
      const message = (err as Error).message;
      const kind = classifyError?.(`${message}\n${raw}`) ?? kindOf(err, raw);
      failures.push({ attempt, kind, message });
      saveAttemptFailure(options.rawDir, occ.id, attempt, message, kind);
      if (!shouldRetry(kind)) break;
      const delay = retryDelayMs(attempt, shouldBackoff(kind, `${message}\n${raw}`));
      if (attempt < maxAttempts && delay > 0) await sleep(delay);
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
  return { ok: false, id: occ.id, attempts: failures.length, failures };
}

// ─── audit trail ─────────────────────────────────────────────────

export function saveRawResponse(rawDir: string, id: number, attempt: number, raw: string): void {
  mkdirSync(rawDir, { recursive: true });
  const path = join(rawDir, `${id}.txt`);
  const body = attempt === 1 ? raw : `\n\n--- attempt ${attempt} ---\n${raw}`;
  appendFileSync(path, body);
}

export function saveAttemptFailure(
  rawDir: string,
  id: number,
  attempt: number,
  message: string,
  kind?: ScoringErrorKind,
): void {
  mkdirSync(rawDir, { recursive: true });
  appendFileSync(join(rawDir, `${id}.failures.jsonl`), `${JSON.stringify({ attempt, kind, message })}\n`);
}

// ─── concurrency ─────────────────────────────────────────────────

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

// ─── orchestration ───────────────────────────────────────────────

export interface RunScoringDeps {
  readonly root: string;
  readonly occDir: string;
  readonly loadOccupations: (occDir: string) => OccExtract[];
  readonly log?: (message: string) => void;
  readonly logError?: (message: string) => void;
}

export interface RunScoringResult {
  readonly scored: number;
  readonly failures: readonly ScoreFailure[];
  readonly pending: readonly number[];
  readonly runDir: string;
}

/**
 * Score every pending occupation with `provider`, appending validated lines to
 * `args.outPath`. Shared by every entry point so no runner can drift from the
 * contract, the retry policy, or the audit layout.
 */
export async function runScoring(
  args: ScoringArgs,
  provider: ScoringProvider,
  deps: RunScoringDeps,
): Promise<RunScoringResult> {
  const log = deps.log ?? ((m: string) => console.log(m));
  const logError = deps.logError ?? ((m: string) => console.error(m));

  if (!existsSync(args.promptFile)) throw new Error(`prompt file not found: ${args.promptFile}`);
  const rubric = readFileSync(args.promptFile, 'utf8');

  const runDir = join(deps.root, '.cache', 'scoring', args.runName);
  const rawDir = join(runDir, 'raw');
  const tmpDir = join(runDir, 'tmp');
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  const prepareCtx = { cwd: deps.root, model: args.model, runDir, options: args.providerOptions };
  provider.preflight(prepareCtx);
  const prep = provider.prepareRun(prepareCtx);
  writeFileSync(
    join(runDir, 'provider-preflight.json'),
    `${JSON.stringify(
      {
        provider: provider.name,
        requested_model: args.model,
        explicit_model_flag: true,
        supports_native_schema: provider.supportsNativeSchema,
        ...(prep.audit ?? {}),
      },
      null,
      2,
    )}\n`,
  );

  const completed =
    args.resume && existsSync(args.outPath) ? completedIdsFromJsonl(readFileSync(args.outPath, 'utf8')) : new Set<number>();
  const occs = selectPendingOccupations(deps.loadOccupations(deps.occDir), args, completed);
  if (occs.length === 0) throw new Error('no occupations to score (all done via --resume? bad --ids?)');
  if (!args.resume) writeFileSync(args.outPath, '');

  const concurrency = Math.min(args.concurrency, provider.maxConcurrency);
  log(
    `[run-scoring] ${occs.length} occupations · provider=${provider.name} · model=${args.model}` +
      ` · concurrency=${concurrency} · run=${args.runName}`,
  );
  if (completed.size) log(`  resume: skipping ${completed.size} completed id(s) from ${args.outPath}`);
  log(`  raw audit: ${rawDir}`);

  const failures: ScoreFailure[] = [];
  const pending: number[] = [];
  let scored = 0;
  await mapLimit(occs, concurrency, async (occ) => {
    const result = await scoreOccupationWithRetries(
      occ,
      rubric,
      {
        cwd: deps.root,
        model: args.model,
        outputSchemaPath: prep.outputSchemaPath,
        runDir,
        tmpDir,
        rawDir,
        maxAttempts: provider.deterministic ? 1 : MAX_ATTEMPTS,
      },
      provider.ask,
      undefined,
      provider.classifyError?.bind(provider),
    );
    if (result.ok) {
      appendFileSync(args.outPath, `${scoreToJsonLine(result.score)}\n`);
      scored += 1;
      log(`  ok id=${occ.id} attempt=${result.attempts} (${scored}/${occs.length})`);
      return;
    }
    if (result.failures.some((f) => f.kind === 'missing_answer')) {
      pending.push(occ.id);
      return;
    }
    failures.push(result);
    const last = result.failures[result.failures.length - 1];
    logError(`  fail id=${occ.id} attempts=${result.attempts} [${last?.kind ?? 'unknown'}]: ${last?.message ?? ''}`);
  });

  log(`[run-scoring] done — ${scored} scored → ${args.outPath}`);
  if (pending.length) {
    log(`  pending ${pending.length} awaiting answers: ${pending.slice(0, 20).join(', ')}${pending.length > 20 ? ' …' : ''}`);
  }
  if (failures.length) {
    logError(`  failures ${failures.length}: ${failures.map((f) => f.id).sort((a, b) => a - b).join(', ')}`);
    failures.slice(0, 20).forEach((f) => {
      const last = f.failures[f.failures.length - 1];
      logError(`    id=${f.id} [${last?.kind ?? 'unknown'}]: ${last?.message ?? 'unknown error'}`);
    });
  }
  return { scored, failures, pending, runDir };
}
