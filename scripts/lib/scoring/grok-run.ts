/**
 * grok-run.ts — locked Grok 4.6 scoring path on the AI Gateway provider
 * (mms-7a / #385). Transport is `ai-gateway`; there is no bespoke xAI
 * provider. Dry-run and full scoring still need a separate owner go-ahead
 * and an API key created at execution time.
 */
export const GROK_GATEWAY_MODEL = 'spacexai/grok-4.6';
export const GROK_MODEL_SLUG = 'grok-4.6';
export const GROK_MODEL_PROVIDER = 'xai';
export const GROK_PROMPT_FILE = 'data/prompts/2026-09-06_grok-4.6-aiois10.ja.md';
export const GROK_PROMPT_VERSION = 'AIOIS-10-v1.0-grok-4.6';
export const GROK_RUBRIC_SOURCE = '2026-07-26_claude-opus-5-aiois10.ja.md';
