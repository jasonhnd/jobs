/**
 * grok-run.ts — locked Grok 4.6 scoring path on the in-agent provider
 * (same transport as claude-opus-4-8 / claude-fable-5). The running Grok
 * 4.6 session scores locally. There is no Vercel AI Gateway and no
 * bespoke xAI provider file. Dry-run and full scoring still need a
 * separate owner go-ahead.
 */
export const GROK_SCORING_PROVIDER = 'in-agent';
export const GROK_MODEL_SLUG = 'grok-4.6';
export const GROK_MODEL_PROVIDER = 'xai';
export const GROK_PROMPT_FILE = 'data/prompts/2026-09-06_grok-4.6-aiois10.ja.md';
export const GROK_PROMPT_VERSION = 'AIOIS-10-v1.0-grok-4.6';
export const GROK_RUBRIC_SOURCE = '2026-07-26_claude-opus-5-aiois10.ja.md';
