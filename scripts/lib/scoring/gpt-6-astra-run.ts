/**
 * gpt-6-astra-run.ts — locked GPT-6 Astra scoring path on the Codex CLI
 * provider (same transport as gpt-5.6-sol). Owner's logged-in Codex CLI only;
 * a Cloud Agent cannot run it. Astra becomes OpenAI's flagship entry in the
 * vendor mean when its batch lands (mms-8.35); gpt-5.6-sol stays as history.
 * `CODEX_DEFAULT_MODEL` stays `gpt-5.6-sol`; every Astra call passes
 * `--model gpt-6-astra` and `--reasoning-effort high` explicitly (mms-8.12).
 * Scoring needs a separate owner GO — mms-8.31 / 8.32 / 8.33.
 */
export const ASTRA_SCORING_PROVIDER = 'codex';
export const ASTRA_MODEL_SLUG = 'gpt-6-astra';
export const ASTRA_MODEL_PROVIDER = 'openai';
export const ASTRA_PROMPT_FILE = 'data/prompts/2026-09-08_gpt-6-astra-aiois10.ja.md';
export const ASTRA_PROMPT_VERSION = 'AIOIS-10-v1.0-gpt-6-astra';
export const ASTRA_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
export const ASTRA_REASONING_EFFORT = 'high';
export const ASTRA_CODEX_CONFIG_OVERRIDE = 'model_reasoning_effort=high';
/** Oldest Codex CLI that accepts `-m gpt-6-astra`; 0.153.4 observed on the owner's machine 2026-09-08. */
export const ASTRA_CODEX_MIN_VERSION = '0.153.1';
export const ASTRA_PREDECESSOR_SLUG = 'gpt-5.6-sol';
