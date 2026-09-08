/**
 * gpt-6-astra-run.ts — locked GPT-6 Astra scoring path on the Codex CLI
 * provider (same transport as gpt-5.6-sol). The owner's locally logged-in
 * Codex CLI scores; a Cloud Agent cannot run this track. Astra is a NEW
 * vote next to gpt-5.6-sol, not a replacement, and it never becomes the
 * Codex default: `CODEX_DEFAULT_MODEL` stays `gpt-5.6-sol`, so every Astra
 * invocation passes `--model gpt-6-astra` explicitly. Scoring (pilot and
 * full) needs a separate owner go-ahead — mms-8G, Issue #404.
 */
export const ASTRA_SCORING_PROVIDER = 'codex';
export const ASTRA_MODEL_SLUG = 'gpt-6-astra';
export const ASTRA_MODEL_PROVIDER = 'openai';
export const ASTRA_PROMPT_FILE = 'data/prompts/2026-09-08_gpt-6-astra-aiois10.ja.md';
export const ASTRA_PROMPT_VERSION = 'AIOIS-10-v1.0-gpt-6-astra';
export const ASTRA_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
/**
 * Must be passed explicitly — the bundled Codex default may be `low`. The
 * mms-8G runner change carries it as `codex exec -c model_reasoning_effort=high`
 * behind an optional flag whose absence keeps the frozen gpt-5.6-sol vector.
 */
export const ASTRA_REASONING_EFFORT = 'high';
export const ASTRA_CODEX_CONFIG_OVERRIDE = 'model_reasoning_effort=high';
/** Oldest Codex CLI that accepts `-m gpt-6-astra`; 0.153.4 or newer preferred. */
export const ASTRA_CODEX_MIN_VERSION = '0.153.1';
/** The vote this model is compared against first (its own predecessor). */
export const ASTRA_PREDECESSOR_SLUG = 'gpt-5.6-sol';
