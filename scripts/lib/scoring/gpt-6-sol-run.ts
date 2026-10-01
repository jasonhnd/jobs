/**
 * gpt-6-sol-run.ts — locked GPT-6 SOL scoring path on the Codex CLI
 * provider (same transport as gpt-5.6-sol and gpt-6-astra). Owner's
 * logged-in Codex CLI only; a Cloud Agent cannot run it. GPT-6 SOL takes
 * OpenAI's flagship seat from gpt-6-astra when its batch lands (mms-12.5);
 * gpt-6-astra stays as history. Seat rule amended 2026-09-23
 * (docs/CONSENSUS_SCORE.md, mms-11.1). `CODEX_DEFAULT_MODEL` stays
 * `gpt-5.6-sol`; every call passes `--model gpt-6-sol` and
 * `--reasoning-effort high` explicitly (the owner's ~/.codex/config.toml
 * defaults to gpt-6-astra at effort low).
 * Scoring needs a separate owner GO — mms-12.2 / 12.3 / 12.4.
 */
export const GPT_6_SOL_SCORING_PROVIDER = 'codex';
export const GPT_6_SOL_MODEL_SLUG = 'gpt-6-sol';
export const GPT_6_SOL_MODEL_PROVIDER = 'openai';
export const GPT_6_SOL_PROMPT_FILE = 'data/prompts/2026-09-23_gpt-6-sol-aiois10.ja.md';
export const GPT_6_SOL_PROMPT_VERSION = 'AIOIS-10-v1.0-gpt-6-sol';
export const GPT_6_SOL_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
export const GPT_6_SOL_REASONING_EFFORT = 'high';
export const GPT_6_SOL_CODEX_CONFIG_OVERRIDE = 'model_reasoning_effort=high';
/** Codex CLI on the owner's machine when gpt-6-sol was first probed (2026-09-23). */
export const GPT_6_SOL_CODEX_MIN_VERSION = '0.156.0';
/** The OpenAI run this one supersedes in the vendor mean. */
export const GPT_6_SOL_PREDECESSOR_SLUG = 'gpt-6-astra';
/** Flagship replacement. Assemble without `--backfill`. */
export const GPT_6_SOL_BACKFILL = false;
