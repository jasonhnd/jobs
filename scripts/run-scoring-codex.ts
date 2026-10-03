#!/usr/bin/env bun
/**
 * run-scoring-codex.ts — compatibility entry point for the Codex CLI path.
 *
 * The implementation now lives in `scripts/lib/scoring/`, shared with every
 * other provider:
 *   • the AIOIS-10 contract      → lib/scoring/contract.ts
 *   • the error vocabulary       → lib/scoring/errors.ts
 *   • retry / audit / resume     → lib/scoring/core.ts
 *   • Codex transport            → lib/scoring/providers/codex.ts
 *
 * This file remains because the runbook, the design doc, and
 * `run-scoring-codex.test.ts` all reference it, and because the Codex path
 * shipped the gpt-5.6-sol batch — its behaviour is frozen and pinned by that
 * test. New work should prefer:
 *
 *   bun scripts/run-scoring.ts --provider codex --model gpt-5.6-sol …
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / vercel.json.
 *
 * Usage:
 *   bun scripts/run-scoring-codex.ts \
 *     --prompt-file data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md \
 *     --out raw-scores.jsonl \
 *     [--model gpt-5.6-sol] [--limit N] [--ids 1,2,3] [--resume] [--concurrency 2]
 */
import { join, resolve } from 'node:path';

import { loadOccupationExtracts } from './scoring-occupation.js';
import { CODEX_DEFAULT_MODEL, CODEX_MAX_CONCURRENCY, codexProvider } from './lib/scoring/providers/codex.js';
import { parseArgs as parseScoringArgs, runScoring, type ScoringArgs } from './lib/scoring/core.js';

const ROOT = resolve(import.meta.dir, '..');
const OCC_DIR = join(ROOT, 'data', 'occupations');

export type CodexScoringArgs = ScoringArgs;

/** Codex-flavoured `parseArgs`: `--provider`/`--model` default to the Codex path. */
export function parseArgs(argv: readonly string[], root = ROOT, now = new Date()): CodexScoringArgs {
  return parseScoringArgs(argv, root, now, {
    provider: codexProvider.name,
    model: CODEX_DEFAULT_MODEL,
    maxConcurrency: CODEX_MAX_CONCURRENCY,
  });
}

// Re-exported so the frozen behaviour test keeps importing from one place.
export {
  assertCodexModelSupport,
  buildCodexExecArgs,
  codexExecSupportsModel,
  probeCodexModelSupport,
  runCodexExec,
  type CodexExecOptions,
  type CodexModelProbeResult,
} from './lib/scoring/providers/codex.js';
export {
  buildPrompt,
  buildRunName,
  completedIdsFromJsonl,
  mapLimit,
  retryDelayMs,
  sanitizeRunName,
  saveAttemptFailure,
  saveRawResponse,
  scoreOccupationWithRetries,
  selectPendingOccupations,
  validateAndNormalizeResponse,
  type AttemptFailure,
  type ScoreFailure,
  type ScoreSuccess,
} from './lib/scoring/core.js';
export {
  SCORE_OUTPUT_JSON_SCHEMA as CODEX_OUTPUT_JSON_SCHEMA,
  extractJsonObject,
  isSyntheticZeroPlaceholder,
  scoreToJsonLine,
  type ScoredOccupation as CodexScore,
} from './lib/scoring/contract.js';
export { explicitScoringError, isTransientCliError } from './lib/scoring/errors.js';
export type { ProviderResponse as CodexExecResult, ScoringExecutor as CodexExecutor } from './lib/scoring/provider.js';

export interface CodexCliDeps {
  readonly root: string;
  readonly occDir: string;
  readonly loadOccupations: Parameters<typeof runScoring>[2]['loadOccupations'];
  readonly run: typeof runScoring;
  readonly error: (message: string) => void;
  readonly log: (message: string) => void;
  readonly exit: (code: number) => never;
  /** Applied when scoring finished but some occupations failed (the run continues to print `next:`). */
  readonly setExitCode: (code: number) => void;
}

/** Real-process dependencies: repo-relative data dir, the real scorer, console output, `process.exit`. */
export function defaultCodexCliDeps(): CodexCliDeps {
  return {
    root: ROOT,
    occDir: OCC_DIR,
    loadOccupations: loadOccupationExtracts,
    run: runScoring,
    error: (m) => console.error(m),
    log: (m) => console.log(m),
    exit: (code) => process.exit(code),
    setExitCode: (code) => {
      process.exitCode = code;
    },
  };
}

/** Run the Codex scoring CLI; every hard failure goes through `deps.exit(1)`. */
export async function runCodexCli(argv: readonly string[], deps: CodexCliDeps): Promise<void> {
  const fail = (m: string): never => {
    deps.error(`[run-scoring-codex] FAIL — ${m}`);
    return deps.exit(1);
  };

  let args: CodexScoringArgs;
  try {
    args = parseArgs(argv, deps.root);
  } catch (err) {
    fail((err as Error).message);
  }

  try {
    const result = await deps.run(args!, codexProvider, {
      root: deps.root,
      occDir: deps.occDir,
      loadOccupations: deps.loadOccupations,
    });
    if (result.failures.length) deps.setExitCode(1);
    deps.log(
      `  next: bun run assemble:scores --mode aiois --model ${args!.model} --date <YYYY-MM-DD> ` +
        `--prompt-version AIOIS-10-v1.0-${args!.model} --prompt-file ${args!.promptFile} --in ${args!.outPath} ` +
        `--out data/scores/occupations_${args!.model}_<date>.json`,
    );
  } catch (err) {
    fail((err as Error).message);
  }
}

if (import.meta.main) {
  await runCodexCli(process.argv.slice(2), defaultCodexCliDeps());
}
