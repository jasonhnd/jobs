/**
 * grok-4-5-run.ts — locked Grok 4.5 BACKFILL scoring path on the in-agent
 * provider (same transport as grok-4.6). Grok 4.5 predates Grok 4.6 and was
 * never scored; this run enters xAI history only. The batch carries
 * `run.backfill: true` and never becomes the vendor flagship or the site's
 * latest run (docs/CONSENSUS_SCORE.md 改訂 3, mms-9). Scoring needs a separate
 * owner GO — mms-9.11 / 9.12.
 */
export const GROK_4_5_SCORING_PROVIDER = 'in-agent';
export const GROK_4_5_MODEL_SLUG = 'grok-4.5';
export const GROK_4_5_MODEL_PROVIDER = 'xai';
export const GROK_4_5_PROMPT_FILE = 'data/prompts/2026-09-10_grok-4.5-aiois10.ja.md';
export const GROK_4_5_PROMPT_VERSION = 'AIOIS-10-v1.0-grok-4.5';
export const GROK_4_5_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
/** This batch is history: it must be assembled with `--backfill true`. */
export const GROK_4_5_BACKFILL = true;
/** The xAI flagship this backfill sits behind in the lane. */
export const GROK_4_5_SUCCESSOR_SLUG = 'grok-4.6';
