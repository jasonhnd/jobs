/**
 * providers/grok-cli.ts — xAI flagship models via a locally logged-in grok
 * CLI subscription. Same class as codex. Not an HTTP provider.
 *
 * Transport only. The AIOIS-10 contract, retry policy, and audit trail live in
 * ../contract.ts, ../errors.ts, and ../core.ts.
 *
 * grok headless has tools on by default and does not read stdin. The argv
 * below is the whole scoring interface: prompt file, inline schema, explicit
 * --model, required --reasoning-effort. Do not reuse codex's
 * parseReasoningEffort — grok's menu is a different enum, and this transport
 * does not inherit the machine's effort.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { SCORE_OUTPUT_JSON_SCHEMA } from '../contract.js';
import type { AskOptions, PrepareRunContext, ProviderResponse, RunPreparation, ScoringProvider } from '../provider.js';

export const GROK_MAX_CONCURRENCY = 4;
export const GROK_CLI_MIN_VERSION = '1.0.40';
export const GROK_REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
/**
 * grok 1.0.40 lists the flagship as `grok-4.7` and, when that slug is
 * requested, reports usage under `grok-4.7-build`. That alias is the flagship.
 * `grok-4.7-build-fast` is a different model and stays rejected.
 */
export const GROK_47_USAGE_ALIAS = 'grok-4.7-build';
export type GrokReasoningEffort = (typeof GROK_REASONING_EFFORTS)[number];

/** Set by prepareRun. Null is not an inherited default — preflight rejects a real run that has none. */
let reasoningEffortForRun: GrokReasoningEffort | null = null;

export interface GrokCliProbe {
  readonly helpCommand: readonly string[];
  readonly helpStatus: number | null;
  readonly helpStdout: string;
  readonly helpStderr: string;
  readonly helpError: string | null;
  readonly versionCommand: readonly string[];
  readonly versionStatus: number | null;
  readonly versionStdout: string;
  readonly versionStderr: string;
  readonly versionError: string | null;
}

export interface GrokExecOptions {
  /** Empty per-occupation directory. Parallel calls must not share one workspace. */
  readonly isolateCwd: string;
  readonly model: string;
  readonly promptFile: string;
  readonly reasoningEffort: GrokReasoningEffort;
  /** Minified SCORE_OUTPUT_JSON_SCHEMA. Never a file path. */
  readonly schemaJson: string;
}

export interface GrokSpawnResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

export type GrokSpawn = (args: readonly string[], cwd: string) => Promise<GrokSpawnResult>;

export type GrokAnswerKind = 'model_unavailable' | 'transport' | 'malformed';

export interface GrokInterpretation {
  readonly ok: boolean;
  readonly kind?: GrokAnswerKind;
  readonly stderr: string;
  readonly rawText: string;
  readonly envelope: unknown | null;
}

const HELP_ARGS = ['--help'] as const;
const VERSION_ARGS = ['--version'] as const;

function captureGrok(args: readonly string[]): { status: number | null; stdout: string; stderr: string; error: string | null } {
  const res = spawnSync('grok', [...args], { encoding: 'utf8', timeout: 15_000 });
  return {
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    error: res.error?.message ?? (res.signal ? `signal ${res.signal}` : null),
  };
}

export function probeGrokCli(): GrokCliProbe {
  const help = captureGrok(HELP_ARGS);
  const version = captureGrok(VERSION_ARGS);
  return {
    helpCommand: ['grok', ...HELP_ARGS],
    helpStatus: help.status,
    helpStdout: help.stdout,
    helpStderr: help.stderr,
    helpError: help.error,
    versionCommand: ['grok', ...VERSION_ARGS],
    versionStatus: version.status,
    versionStdout: version.stdout,
    versionStderr: version.stderr,
    versionError: version.error,
  };
}

export function readGrokVersion(text: string): string | null {
  const match = text.match(/\b(\d+\.\d+\.\d+)\b/);
  return match ? match[1] : null;
}

export function compareGrokVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => Number.parseInt(part, 10));
  const b = right.split('.').map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export function grokHelpMissingFlags(helpText: string): string[] {
  const missing: string[] = [];
  const hasModel = /(?:^|[\s,])-m(?:[\s,]|$)/m.test(helpText) || helpText.includes('--model');
  if (!hasModel) missing.push('-m/--model');
  if (!helpText.includes('--json-schema')) missing.push('--json-schema');
  if (!helpText.includes('--prompt-file')) missing.push('--prompt-file');
  if (!helpText.includes('--reasoning-effort')) missing.push('--reasoning-effort');
  return missing;
}

/**
 * grok 1.0.40 advertises `--reasoning-effort` and prints no value menu.
 * A line that lists three or more effort names is a menu; `high` must be on it.
 */
export function grokHelpRejectsHigh(helpText: string): boolean {
  for (const line of helpText.split(/\r?\n/)) {
    const found = GROK_REASONING_EFFORTS.filter((effort) =>
      new RegExp(`(?:^|[\\s,|/])${effort}(?:$|[\\s,|/])`).test(line.toLowerCase()),
    );
    if (found.length >= 3) return !found.includes('high');
  }
  return false;
}

export function assertGrokCliProbe(probe: GrokCliProbe): void {
  if (probe.helpError) {
    throw new Error(`unable to run ${probe.helpCommand.join(' ')}: ${probe.helpError}`);
  }
  if (probe.versionError) {
    throw new Error(`unable to run ${probe.versionCommand.join(' ')}: ${probe.versionError}`);
  }
  if (probe.helpStatus !== 0) {
    const detail = (probe.helpStderr || probe.helpStdout).trim();
    throw new Error(
      `${probe.helpCommand.join(' ')} exited with status ${String(probe.helpStatus)}` + (detail ? `: ${detail}` : ''),
    );
  }
  if (probe.versionStatus !== 0) {
    const detail = (probe.versionStderr || probe.versionStdout).trim();
    throw new Error(
      `${probe.versionCommand.join(' ')} exited with status ${String(probe.versionStatus)}` +
        (detail ? `: ${detail}` : ''),
    );
  }
  const version = readGrokVersion(`${probe.versionStdout}\n${probe.versionStderr}`);
  if (!version || compareGrokVersions(version, GROK_CLI_MIN_VERSION) < 0) {
    throw new Error(`grok CLI ${version ?? 'unknown'} is below ${GROK_CLI_MIN_VERSION}`);
  }
  const help = `${probe.helpStdout}\n${probe.helpStderr}`;
  const missing = grokHelpMissingFlags(help);
  if (missing.length > 0) {
    throw new Error(`installed grok CLI help is missing ${missing.join(', ')}; upgrade grok before scoring`);
  }
  if (grokHelpRejectsHigh(help)) {
    throw new Error('installed grok CLI reasoning-effort menu does not accept high; refusing to downgrade');
  }
}

export function parseGrokReasoningEffort(raw: string | undefined): GrokReasoningEffort {
  if (raw === undefined || raw === 'true' || !(GROK_REASONING_EFFORTS as readonly string[]).includes(raw)) {
    throw new Error('--reasoning-effort must be one of none|minimal|low|medium|high|xhigh|max');
  }
  return raw as GrokReasoningEffort;
}

export function grokScoreSchemaJson(): string {
  return JSON.stringify(SCORE_OUTPUT_JSON_SCHEMA);
}

/** `--sandbox strict` can read only under `--cwd`. The prompt file grok opens must live there. */
export function promptFileIsInsideIsolate(isolateCwd: string, promptFile: string): boolean {
  const rel = relative(isolateCwd, promptFile);
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
}

export function buildGrokExecArgs(options: GrokExecOptions): string[] {
  if (!promptFileIsInsideIsolate(options.isolateCwd, options.promptFile)) {
    throw new Error('--prompt-file must sit inside --cwd; grok --sandbox strict cannot read outside it');
  }
  return [
    '--cwd', options.isolateCwd,
    '--sandbox', 'strict',
    '--max-turns', '1',
    '--no-subagents',
    '--no-plan',
    '--disable-web-search',
    '--verbatim',
    '--permission-mode', 'dontAsk',
    '--output-format', 'json',
    '--json-schema', options.schemaJson,
    '--prompt-file', options.promptFile,
    '--reasoning-effort', options.reasoningEffort,
    '--model', options.model,
  ];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function modelUsageMatchesRequest(requestedModel: string, keys: readonly string[]): boolean {
  if (keys.length !== 1) return false;
  const key = keys[0]!;
  if (key === requestedModel) return true;
  return requestedModel === 'grok-4.7' && key === GROK_47_USAGE_ALIAS;
}

function structuredScore(envelope: Record<string, unknown>): Record<string, unknown> | null {
  if (isPlainObject(envelope.structured_output)) return envelope.structured_output;
  if (isPlainObject(envelope.structuredOutput)) return envelope.structuredOutput;
  return null;
}

function scoreFromText(text: unknown): Record<string, unknown> | null {
  if (isPlainObject(text)) return text;
  if (typeof text !== 'string') return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function interpretGrokEnvelope(stdout: string, requestedModel: string): GrokInterpretation {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    return {
      ok: false,
      kind: 'malformed',
      stderr: 'grok envelope did not contain a JSON score object',
      rawText: '',
      envelope: null,
    };
  }
  if (!isPlainObject(envelope)) {
    return {
      ok: false,
      kind: 'malformed',
      stderr: 'grok envelope did not contain a JSON score object',
      rawText: '',
      envelope,
    };
  }
  if (envelope.num_turns !== 1) {
    return {
      ok: false,
      kind: 'transport',
      stderr: `upstream provider error: num_turns is ${JSON.stringify(envelope.num_turns)}, expected 1`,
      rawText: '',
      envelope,
    };
  }
  const keys = isPlainObject(envelope.modelUsage) ? Object.keys(envelope.modelUsage) : [];
  if (!modelUsageMatchesRequest(requestedModel, keys)) {
    const shown = keys.length > 0 ? keys.join(',') : 'missing';
    return {
      ok: false,
      kind: 'model_unavailable',
      stderr: `Requested model ${shown} is unavailable`,
      rawText: '',
      envelope,
    };
  }
  const score = structuredScore(envelope) ?? scoreFromText(envelope.text);
  if (!score) {
    return {
      ok: false,
      kind: 'malformed',
      stderr: 'grok envelope did not contain a JSON score object',
      rawText: '',
      envelope,
    };
  }
  return { ok: true, stderr: '', rawText: JSON.stringify(score), envelope };
}

export function grokIsolateDir(runDir: string, occId: number): string {
  return join(runDir, 'isolate', String(occId));
}

export function grokPromptPath(runDir: string, occId: number): string {
  return join(runDir, 'prompts', `${occId}.txt`);
}

/** Copy grok actually opens. `prompts/<id>.txt` is the audit record and sits outside the sandbox. */
export function grokSandboxPromptPath(runDir: string, occId: number): string {
  return join(grokIsolateDir(runDir, occId), 'prompt.txt');
}

export function grokEnvelopePath(options: AskOptions): string | null {
  if (options.occId == null) return null;
  const rawDir = options.rawDir ?? (options.runDir ? join(options.runDir, 'raw') : null);
  if (!rawDir) return null;
  return join(rawDir, `${options.occId}.envelope.json`);
}

const defaultGrokSpawn: GrokSpawn = (args, cwd) =>
  new Promise((resolveSpawn) => {
    let settled = false;
    const finish = (result: GrokSpawnResult): void => {
      if (settled) return;
      settled = true;
      resolveSpawn(result);
    };
    const child = spawn('grok', [...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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
      finish({ exitCode: 1, stdout, stderr, error: err.message });
    });
    child.on('close', (code) => {
      finish({ exitCode: code, stdout, stderr, error: null });
    });
  });

function unprepared(stderr: string): ProviderResponse {
  return { exitCode: 1, stdout: '', stderr, rawText: '' };
}

export async function executeGrokAsk(
  prompt: string,
  options: AskOptions,
  reasoningEffort: GrokReasoningEffort,
  spawnGrok: GrokSpawn = defaultGrokSpawn,
): Promise<ProviderResponse> {
  if (!options.outputSchemaPath || options.occId == null || !options.runDir) {
    return unprepared('grok provider requires outputSchemaPath (prepareRun did not run)');
  }
  const auditPrompt = grokPromptPath(options.runDir, options.occId);
  const promptFile = grokSandboxPromptPath(options.runDir, options.occId);
  const isolateCwd = grokIsolateDir(options.runDir, options.occId);
  mkdirSync(join(options.runDir, 'prompts'), { recursive: true });
  mkdirSync(isolateCwd, { recursive: true });
  writeFileSync(auditPrompt, prompt, 'utf8');
  writeFileSync(promptFile, prompt, 'utf8');
  const args = buildGrokExecArgs({
    isolateCwd,
    model: options.model,
    promptFile,
    reasoningEffort,
    schemaJson: grokScoreSchemaJson(),
  });
  const spawned = await spawnGrok(args, options.cwd);
  if (spawned.error) {
    return { exitCode: 1, stdout: spawned.stdout, stderr: `${spawned.stderr}\n${spawned.error}`.trim(), rawText: '' };
  }
  const interpreted = interpretGrokEnvelope(spawned.stdout, options.model);
  const envelopeFile = grokEnvelopePath(options);
  if (interpreted.envelope !== null && envelopeFile) {
    mkdirSync(dirname(envelopeFile), { recursive: true });
    writeFileSync(envelopeFile, `${JSON.stringify(interpreted.envelope, null, 2)}\n`, 'utf8');
  }
  if (!interpreted.ok) {
    return { exitCode: 1, stdout: spawned.stdout, stderr: interpreted.stderr, rawText: '' };
  }
  if (spawned.exitCode !== 0) {
    return {
      exitCode: spawned.exitCode ?? 1,
      stdout: spawned.stdout,
      stderr: spawned.stderr || 'upstream provider error: grok exited non-zero',
      rawText: '',
    };
  }
  return { exitCode: 0, stdout: spawned.stdout, stderr: spawned.stderr, rawText: interpreted.rawText };
}

export const grokCliProvider: ScoringProvider = {
  name: 'grok-cli',
  description: 'xAI flagship models via a locally logged-in grok CLI subscription (no API key).',
  supportsNativeSchema: true,
  maxConcurrency: GROK_MAX_CONCURRENCY,

  preflight(ctx: PrepareRunContext): void {
    assertGrokCliProbe(probeGrokCli());
    parseGrokReasoningEffort(ctx.options['reasoning-effort']);
  },

  prepareRun(ctx: PrepareRunContext): RunPreparation {
    let reasoningEffort: GrokReasoningEffort | null = null;
    try {
      reasoningEffort = parseGrokReasoningEffort(ctx.options['reasoning-effort']);
    } catch {
      reasoningEffort = null;
    }
    reasoningEffortForRun = reasoningEffort;
    const outputSchemaPath = join(ctx.runDir, 'grok-score.schema.json');
    writeFileSync(outputSchemaPath, `${JSON.stringify(SCORE_OUTPUT_JSON_SCHEMA, null, 2)}\n`);
    const probe = probeGrokCli();
    return {
      outputSchemaPath,
      audit: {
        command: probe.helpCommand,
        status: probe.helpStatus,
        error: probe.helpError,
        version_command: probe.versionCommand,
        version_status: probe.versionStatus,
        version_error: probe.versionError,
        grok_version: (probe.versionStdout || probe.versionStderr).trim(),
        reasoning_effort: reasoningEffort,
        reasoning_effort_source: reasoningEffort ? 'cli-flag' : 'missing',
      },
    };
  },

  ask(prompt: string, options: AskOptions): Promise<ProviderResponse> {
    if (!reasoningEffortForRun) {
      return Promise.resolve(unprepared('grok provider requires --reasoning-effort (prepareRun did not run)'));
    }
    return executeGrokAsk(prompt, options, reasoningEffortForRun);
  },
};
