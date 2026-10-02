/**
 * grok-4.7-run.ts — locked Grok 4.7 scoring path on the grok CLI
 * provider (same class as codex, not an HTTP provider). Owner's logged-in
 * grok CLI only; a Cloud Agent cannot run it. Grok 4.7 replaces Grok 4.6
 * as xAI's flagship in the vendor mean when its batch lands (mms-10.6).
 * grok-4.6 and the grok-4.5 backfill stay on in-agent.
 *
 * The frozen call passes `--model grok-4.7-build-fast`
 * (`GROK_4_7_MODEL_SLUG`) and `--reasoning-effort xhigh`
 * (`GROK_4_7_REASONING_EFFORT`). The published batch, assemble slug, and
 * public name stay `grok-4.7`. The CLI default model is not a scoring
 * model. `run.backfill` stays false.
 *
 * Usage identity is `modelUsageMatchesRequest` (one key only):
 * - request `grok-4.7-build-fast` matches only the exact key
 *   `grok-4.7-build-fast`;
 * - request `grok-4.7` matches exact `grok-4.7` or the alias
 *   `grok-4.7-build` (`GROK_47_USAGE_ALIAS`);
 * - a `grok-4.7` request whose key is `grok-4.7-build-fast` does not match.
 * Any other key is `model_unavailable`. Do not relabel an existing batch.
 *
 * Scoring needs a separate owner GO — mms-10.3 / 10.4 / 10.5.
 */
export const GROK_4_7_SCORING_PROVIDER = 'grok-cli';
/**
 * CLI id for the fast transport. The published batch name is `grok-4.7`,
 * the same shape as `grok-4.6` and `grok-4.5`.
 */
export const GROK_4_7_MODEL_SLUG = 'grok-4.7-build-fast';
export const GROK_4_7_MODEL_PROVIDER = 'xai';
export const GROK_4_7_PROMPT_FILE = 'data/prompts/2026-09-22_grok-4.7-aiois10.ja.md';
export const GROK_4_7_PROMPT_VERSION = 'AIOIS-10-v1.0-grok-4.7';
export const GROK_4_7_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
/** Owner set the full run to xhigh on 2026-09-22. */
export const GROK_4_7_REASONING_EFFORT = 'xhigh';
/** Oldest grok CLI observed with `-m`, `--json-schema`, `--prompt-file`, and `--reasoning-effort`. */
export const GROK_4_7_MIN_CLI_VERSION = '1.0.40';
export const GROK_4_7_PREDECESSOR_SLUG = 'grok-4.6';
/** Flagship replacement. Assemble without `--backfill`. */
export const GROK_4_7_BACKFILL = false;
