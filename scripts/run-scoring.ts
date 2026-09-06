#!/usr/bin/env bun
/**
 * run-scoring.ts — the provider-independent scoring entry point.
 *
 * Emits the raw JSONL contract consumed by `assemble:scores`, whichever model
 * produced the scores:
 *   {id, ai_risk, rationale_ja, confidence, aiois:{d1..d10,transformation,displacement}}
 *
 * Everything that must not vary by vendor — the AIOIS-10 contract, the formula
 * checks, the retry policy, the audit trail, resume — lives in `lib/scoring/`.
 * Vendors plug in as providers; `lib/scoring/providers/index.ts` documents how
 * to add one, and `providers/conformance.test.ts` is the suite a new provider
 * must pass.
 *
 * History: this path used to be a single-axis Anthropic Batches API script and
 * could not emit AIOIS-10 (see docs/SCORING_RUNBOOK.md). That implementation
 * remains in git history and is the natural starting point for a future
 * `anthropic-api` provider:
 *   git show 1d7d42a2:scripts/run-scoring.ts
 *
 * LOCAL dev tool — NOT wired into build / verify:gates / CI / vercel.json.
 * Executing it makes real model calls; importing it does not.
 *
 * Usage:
 *   bun scripts/run-scoring.ts --list-providers
 *
 *   # OpenAI, via the locally logged-in Codex CLI subscription
 *   bun scripts/run-scoring.ts \
 *     --provider codex --model gpt-5.6-sol \
 *     --prompt-file data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md \
 *     --out .cache/scoring/<run>/raw-scores.jsonl
 *
 *   # Any vendor through Vercel AI Gateway (AI_GATEWAY_API_KEY in .env.local)
 *   bun scripts/run-scoring.ts \
 *     --provider ai-gateway --model anthropic/claude-opus-5 \
 *     --prompt-file data/prompts/<date>_claude-opus-5-aiois10.ja.md \
 *     --out .cache/scoring/<run>/raw-scores.jsonl
 *
 *   # Scored by this agent session (no API key, no child process)
 *   bun scripts/run-scoring.ts \
 *     --provider in-agent --model claude-opus-5 \
 *     --prompt-file data/prompts/<date>_claude-opus-5-aiois10.ja.md \
 *     --out .cache/scoring/<run>/raw-scores.jsonl --ids 1,2,3
 *   # → writes each prompt and reports it pending; add answers as JSON Lines
 *   #   under .cache/scoring/<run>/answers/, then re-run with --resume.
 */
import { join, resolve } from 'node:path';

import { loadOccupationExtracts } from './scoring-occupation.js';
import { PROVIDERS, PROVIDER_NAMES, getProvider } from './lib/scoring/providers/index.js';
import { parseArgs, runScoring } from './lib/scoring/core.js';

const ROOT = resolve(import.meta.dir, '..');
const OCC_DIR = join(ROOT, 'data', 'occupations');

if (import.meta.main) {
  const fail = (m: string): never => {
    console.error(`[run-scoring] FAIL — ${m}`);
    process.exit(1);
  };

  const argv = process.argv.slice(2);

  if (argv.includes('--list-providers')) {
    console.log('providers:');
    for (const name of PROVIDER_NAMES) {
      const provider = PROVIDERS[name]!;
      console.log(`  ${name}`);
      console.log(`    ${provider.description}`);
      console.log(
        `    native schema: ${provider.supportsNativeSchema ? 'yes' : 'no'} · max concurrency: ${provider.maxConcurrency}`,
      );
    }
    process.exit(0);
  }

  try {
    const args = parseArgs(argv, ROOT);
    const provider = getProvider(args.provider);
    const result = await runScoring(args, provider, {
      root: ROOT,
      occDir: OCC_DIR,
      loadOccupations: loadOccupationExtracts,
    });

    if (result.pending.length) {
      console.log(
        `  answer them as JSON Lines under ${join(result.runDir, 'answers')}/ , then re-run the same command with --resume`,
      );
    }
    if (result.failures.length) process.exitCode = 1;
    console.log(
      `  next: bun run assemble:scores --mode aiois --model ${args.model} --date <YYYY-MM-DD> ` +
        `--prompt-version AIOIS-10-v1.0-${args.model} --prompt-file ${args.promptFile} --in ${args.outPath} ` +
        `--out data/scores/occupations_${args.model}_<date>.json`,
    );
  } catch (err) {
    fail((err as Error).message);
  }
}
