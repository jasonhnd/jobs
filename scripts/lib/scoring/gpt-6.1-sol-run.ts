/**
 * gpt-6.1-sol-run.ts — locked GPT-6.1 SOL scoring path on the Codex CLI
 * provider (same transport as gpt-5.6-sol, gpt-6-astra and gpt-6-sol).
 * Owner's logged-in Codex CLI only; a Cloud Agent cannot run it. GPT-6.1 SOL
 * takes OpenAI's flagship seat from gpt-6-sol when its batch lands
 * (mms-13.5); gpt-6-sol stays as history. `CODEX_DEFAULT_MODEL` stays
 * `gpt-5.6-sol`; every call passes `--model gpt-6.1-sol` and
 * `--reasoning-effort high` explicitly (the owner's ~/.codex/config.toml
 * defaults to gpt-6-sol at effort low).
 * Scoring needs a Supervisor GO on mms-13.2 / 13.3 / 13.4.
 */
export const GPT_6_1_SOL_SCORING_PROVIDER = 'codex';
export const GPT_6_1_SOL_MODEL_SLUG = 'gpt-6.1-sol';
export const GPT_6_1_SOL_MODEL_PROVIDER = 'openai';
export const GPT_6_1_SOL_PROMPT_FILE = 'data/prompts/2026-10-01_gpt-6.1-sol-aiois10.ja.md';
export const GPT_6_1_SOL_PROMPT_VERSION = 'AIOIS-10-v1.0-gpt-6.1-sol';
export const GPT_6_1_SOL_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
export const GPT_6_1_SOL_REASONING_EFFORT = 'high';
export const GPT_6_1_SOL_CODEX_CONFIG_OVERRIDE = 'model_reasoning_effort=high';
/** Codex CLI on the owner's machine when gpt-6.1-sol was first listed (2026-10-01). */
export const GPT_6_1_SOL_CODEX_MIN_VERSION = '0.159.2';
/** The OpenAI run this one supersedes in the vendor mean. */
export const GPT_6_1_SOL_PREDECESSOR_SLUG = 'gpt-6-sol';
/** Flagship replacement. Assemble without `--backfill`. */
export const GPT_6_1_SOL_BACKFILL = false;
