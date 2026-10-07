/**
 * providers/codex.ts — OpenAI models via a locally logged-in Codex CLI
 * subscription.
 *
 * Transport only. The AIOIS-10 contract, retry policy, and audit trail live in
 * ../contract.ts, ../errors.ts, and ../core.ts.
 *
 * Native schema mechanism: `codex exec --output-schema <file>`.
 *
 * BEHAVIOUR-FROZEN: `buildCodexExecArgs` produces exactly the argument vector
 * that shipped the gpt-5.6-sol batch, and `run-scoring-codex.test.ts` pins it.
 * Do not "tidy" the flag order.
 * The optional --reasoning-effort flag (mms-8.12) inserts "-c model_reasoning_effort=<e>" before "--model"; with the flag absent the argv is unchanged.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { CLI_CALL_TIMEOUT_MS, parseCallTimeoutMs, runCliProcess } from '../cli-spawn.js';
import { SCORE_OUTPUT_JSON_SCHEMA } from '../contract.js';
import type { AskOptions, PrepareRunContext, ProviderResponse, RunPreparation, ScoringProvider } from '../provider.js';

export const CODEX_MAX_CONCURRENCY = 4;
export const CODEX_DEFAULT_MODEL = 'gpt-5.6-sol';
export const CODEX_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORTS)[number];

/** Set by prepareRun from --reasoning-effort; null keeps the frozen gpt-5.6-sol argv. */
let reasoningEffortForRun: CodexReasoningEffort | null = null;
/** Set by prepareRun from --call-timeout-sec. */
let callTimeoutMsForRun = CLI_CALL_TIMEOUT_MS;

export interface CodexModelProbeResult {
  readonly command: readonly string[];
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

export interface CodexExecOptions extends AskOptions {
  readonly outputSchemaPath: string;
  /** When set, inserts `-c model_reasoning_effort=<effort>` immediately before `--model`. */
  readonly reasoningEffort?: CodexReasoningEffort | null;
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

/**
 * A Codex build without explicit model selection would silently score with its
 * own default model while we label the output with the requested one. That is
 * the silent-fallback failure docs/SCORING_RUNBOOK.md forbids, so it is fatal.
 */
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
  const effort = options.reasoningEffort ? ['-c', `model_reasoning_effort=${options.reasoningEffort}`] : [];
  return [
    'exec',
    '--ephemeral',
    '--cd', options.cwd,
    '--color', 'never',
    '--output-schema', options.outputSchemaPath,
    '--output-last-message', options.outputLastMessagePath,
    ...effort,
    '--model', options.model,
    '-',
  ];
}

export function parseReasoningEffort(raw: string | undefined): CodexReasoningEffort | null {
  if (raw === undefined) return null;
  if (raw === 'true' || !(CODEX_REASONING_EFFORTS as readonly string[]).includes(raw)) {
    throw new Error('--reasoning-effort must be one of low|medium|high|xhigh');
  }
  return raw as CodexReasoningEffort;
}

export function probeCodexVersion(): string {
  const res = spawnSync('codex', ['--version'], { encoding: 'utf8' });
  if (res.error) return `error: ${res.error.message}`;
  return (res.stdout || res.stderr || '').trim();
}

export async function runCodexExec(
  prompt: string,
  options: AskOptions,
  timeoutMs: number = callTimeoutMsForRun,
): Promise<ProviderResponse> {
  if (!options.outputSchemaPath) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'codex provider requires outputSchemaPath (prepareRun did not run)',
      rawText: '',
    };
  }
  const cmd = buildCodexExecArgs({ ...options, outputSchemaPath: options.outputSchemaPath, reasoningEffort: reasoningEffortForRun });
  const res = await runCliProcess('codex', cmd, { cwd: options.cwd, input: prompt, timeoutMs });
  if (res.timedOut) {
    // Only the timeout text is classified, so partial stderr cannot turn a
    // retryable transport failure into another kind.
    return { exitCode: 1, stdout: res.stdout, stderr: res.error ?? 'codex timed out', rawText: '' };
  }
  if (res.error) {
    return { exitCode: 1, stdout: res.stdout, stderr: `${res.stderr}\n${res.error}`.trim(), rawText: res.stdout };
  }
  const rawText = existsSync(options.outputLastMessagePath)
    ? readFileSync(options.outputLastMessagePath, 'utf8')
    : res.stdout;
  return { exitCode: res.exitCode ?? 1, stdout: res.stdout, stderr: res.stderr, rawText };
}

export const codexProvider: ScoringProvider = {
  name: 'codex',
  description: 'OpenAI models via a locally logged-in Codex CLI subscription (no API key).',
  supportsNativeSchema: true,
  maxConcurrency: CODEX_MAX_CONCURRENCY,

  preflight(ctx: PrepareRunContext): void {
    parseReasoningEffort(ctx.options['reasoning-effort']);
    parseCallTimeoutMs(ctx.options['call-timeout-sec']);
    assertCodexModelSupport(probeCodexModelSupport());
  },

  prepareRun(ctx: PrepareRunContext): RunPreparation {
    reasoningEffortForRun = parseReasoningEffort(ctx.options['reasoning-effort']);
    callTimeoutMsForRun = parseCallTimeoutMs(ctx.options['call-timeout-sec']);
    const outputSchemaPath = join(ctx.runDir, 'codex-score.schema.json');
    writeFileSync(outputSchemaPath, `${JSON.stringify(SCORE_OUTPUT_JSON_SCHEMA, null, 2)}\n`);
    const probe = probeCodexModelSupport();
    return {
      outputSchemaPath,
      audit: {
        command: probe.command,
        status: probe.status,
        reasoning_effort: reasoningEffortForRun,
        reasoning_effort_source: reasoningEffortForRun ? 'cli-flag' : 'inherited-from-user-config',
        call_timeout_sec: callTimeoutMsForRun / 1000,
        codex_version: probeCodexVersion(),
      },
    };
  },

  ask: (prompt: string, options: AskOptions) => runCodexExec(prompt, options),
};
