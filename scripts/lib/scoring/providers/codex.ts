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
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { SCORE_OUTPUT_JSON_SCHEMA } from '../contract.js';
import type { AskOptions, PrepareRunContext, ProviderResponse, RunPreparation, ScoringProvider } from '../provider.js';

export const CODEX_MAX_CONCURRENCY = 4;
export const CODEX_DEFAULT_MODEL = 'gpt-5.6-sol';

export interface CodexModelProbeResult {
  readonly command: readonly string[];
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

export interface CodexExecOptions extends AskOptions {
  readonly outputSchemaPath: string;
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
    const cmd = buildCodexExecArgs({ ...options, outputSchemaPath: options.outputSchemaPath });

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

  preflight(): void {
    assertCodexModelSupport(probeCodexModelSupport());
  },

  prepareRun(ctx: PrepareRunContext): RunPreparation {
    const outputSchemaPath = join(ctx.runDir, 'codex-score.schema.json');
    writeFileSync(outputSchemaPath, `${JSON.stringify(SCORE_OUTPUT_JSON_SCHEMA, null, 2)}\n`);
    const probe = probeCodexModelSupport();
    return {
      outputSchemaPath,
      audit: { command: probe.command, status: probe.status },
    };
  },

  ask: runCodexExec,
};
