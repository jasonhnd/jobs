/**
 * opus-5-5-run.ts — locked Claude Opus 5.5 scoring path on the in-agent
 * provider (same transport as claude-fable-5-1). Every answer line is written
 * by a local `claude -p --model claude-opus-5-5 --effort high` process, one
 * chunk per process; the orchestrating session never scores. Opus 5.5 takes
 * Anthropic's flagship seat from claude-fable-5-1 when its batch lands
 * (mms-11.6); claude-fable-5-1 stays as history. Seat rule amended
 * 2026-09-23 (docs/CONSENSUS_SCORE.md, mms-11.1).
 * Scoring needs a separate owner GO — mms-11.3 / 11.4 / 11.5.
 */
export const OPUS_5_5_SCORING_PROVIDER = 'in-agent';
export const OPUS_5_5_MODEL_SLUG = 'claude-opus-5-5';
export const OPUS_5_5_MODEL_PROVIDER = 'anthropic';
export const OPUS_5_5_PROMPT_FILE = 'data/prompts/2026-09-23_claude-opus-5-5-aiois10.ja.md';
export const OPUS_5_5_PROMPT_VERSION = 'AIOIS-10-v1.0-claude-opus-5-5';
export const OPUS_5_5_RUBRIC_SOURCE = '2026-09-06_grok-4.6-aiois10.ja.md';
/** Claude Code `--effort high` on every chunk; the run report records it. */
export const OPUS_5_5_REASONING_EFFORT = 'high';
/** The Anthropic run this one supersedes in the vendor mean. */
export const OPUS_5_5_PREDECESSOR_SLUG = 'claude-fable-5-1';
/** Flagship replacement. Assemble without `--backfill`. */
export const OPUS_5_5_BACKFILL = false;
