/**
 * grok-4.7-run.ts — locked Grok 4.7 scoring path on the grok CLI
 * provider (same class as codex, not an HTTP provider). Owner's logged-in
 * grok CLI only; a Cloud Agent cannot run it. Grok 4.7 replaces Grok 4.6
 * as xAI's flagship in the vendor mean when its batch lands (mms-10.6).
 * grok-4.6 and the grok-4.5 backfill stay on in-agent. Every call passes
 * `--model grok-4.7` and `--reasoning-effort high`. The CLI default model
 * is not a scoring model. `run.backfill` stays false.
 * Scoring needs a separate owner GO — mms-10.3 / 10.4 / 10.5.
 */
export const GROK_4_7_SCORING_PROVIDER = 'grok-cli';
export const GROK_4_7_MODEL_SLUG = 'grok-4.7';
export const GROK_4_7_MODEL_PROVIDER = 'xai';
export const GROK_4_7_PROMPT_FILE = 'data/prompts/2026-09-22_grok-4.7-aiois10.ja.md';
export const GROK_4_7_PROMPT_VERSION = 'AIOIS-10-v1.0-grok-4.7';
export const GROK_4_7_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
export const GROK_4_7_REASONING_EFFORT = 'high';
/** Oldest grok CLI observed with `-m`, `--json-schema`, `--prompt-file`, and `--reasoning-effort`. */
export const GROK_4_7_MIN_CLI_VERSION = '1.0.40';
export const GROK_4_7_PREDECESSOR_SLUG = 'grok-4.6';
/** Flagship replacement. Assemble without `--backfill`. */
export const GROK_4_7_BACKFILL = false;
