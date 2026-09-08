/**
 * fable-5-1-run.ts — locked Claude Fable 5.1 scoring path on the in-agent
 * provider (same transport as claude-opus-4-8 / claude-fable-5 / grok-4.6).
 * The running Claude Fable 5.1 session scores locally; no API key, no
 * Anthropic HTTP provider, no Vercel AI Gateway. Fable 5.1 is a NEW vote
 * next to claude-fable-5, not a replacement. Scoring (pilot and full) needs
 * a separate owner go-ahead — mms-8F, Issue #404.
 */
export const FABLE_5_1_SCORING_PROVIDER = 'in-agent';
export const FABLE_5_1_MODEL_SLUG = 'claude-fable-5-1';
export const FABLE_5_1_MODEL_PROVIDER = 'anthropic';
export const FABLE_5_1_PROMPT_FILE = 'data/prompts/2026-09-08_claude-fable-5-1-aiois10.ja.md';
export const FABLE_5_1_PROMPT_VERSION = 'AIOIS-10-v1.0-claude-fable-5-1';
export const FABLE_5_1_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
/** Adaptive thinking cannot be disabled on Fable 5.1; the run report records this value. */
export const FABLE_5_1_REASONING_EFFORT = 'high';
/** The vote this model is compared against first (its own predecessor). */
export const FABLE_5_1_PREDECESSOR_SLUG = 'claude-fable-5';
