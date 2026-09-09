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
import { spawn, spawnSync } from 'node:child_process';

import { SCORE_OUTPUT_JSON_SCHEMA } from '../contract.js';
import type { AskOptions, PrepareRunContext, ProviderResponse, RunPreparation, ScoringProvider } from '../provider.js';

export const CODEX_MAX_CONCURRENCY = 4;
export const CODEX_DEFAULT_MODEL = 'gpt-5.6-sol';
export const CODEX_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORTS)[number];

/** Set by prepareRun from --reasoning-effort; null keeps the frozen gpt-5.6-sol argv. */
let reasoningEffortForRun: CodexReasoningEffort | null = null;

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

export const runCodexExec = (prompt: string, options: AskOptions): Promise<ProviderResponse> =>
  new Promise((resolveExec) => {
    if (!options.outputSchemaPath) {
      resolveExec({
        exitCode: 1,
        stdout: '',
        stderr: 'codex provider requires outputSchemaPath (prepareRun did not run)',
        rawText: '',
      });
      return;
    }
    const cmd = buildCodexExecArgs({ ...options, outputSchemaPath: options.outputSchemaPath, reasoningEffort: reasoningEffortForRun });

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

export const codexProvider: ScoringProvider = {
  name: 'codex',
  description: 'OpenAI models via a locally logged-in Codex CLI subscription (no API key).',
  supportsNativeSchema: true,
  maxConcurrency: CODEX_MAX_CONCURRENCY,

  preflight(ctx: PrepareRunContext): void {
    parseReasoningEffort(ctx.options['reasoning-effort']);
    assertCodexModelSupport(probeCodexModelSupport());
  },

  prepareRun(ctx: PrepareRunContext): RunPreparation {
    reasoningEffortForRun = parseReasoningEffort(ctx.options['reasoning-effort']);
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
        codex_version: probeCodexVersion(),
      },
    };
  },

  ask: runCodexExec,
};
