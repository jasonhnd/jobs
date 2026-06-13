/**
 * src/site/score-attribution.ts — single source of truth for "which model
 * scored the current batch, and when" wording across the site.
 *
 * Same consolidation rationale as src/site/config.ts: the model name + run
 * date used to be hard-coded in 40+ surfaces (footer, hubs, FAQ, methodology,
 * sector copy …) and every score-batch upgrade had to chase them all. The
 * active attribution is derived ONCE — at BUILD TIME, in src/data/build.ts,
 * mirroring `pickLatestScore()` batch-selection semantics — and baked into the
 * generated, fs-free `_score-attribution.ts` so importers (including the few
 * Vercel Edge bundles that share chunks with page code) carry NO node:fs.
 *
 * The pure helpers below (`formatModelDisplay`, `pickAttributionBatch`) are
 * the canonical selection/formatting logic; build.ts uses them to compute the
 * baked values, and the tests pin them.
 */
import { SCORE_ATTRIBUTION_DATA } from './_score-attribution.js';

export interface ScoreAttribution {
  /** Raw model id, e.g. "claude-fable-5". */
  readonly modelId: string;
  /** Public display name, e.g. "Claude Fable 5". */
  readonly modelDisplay: string;
  /** ISO date (YYYY-MM-DD) of the active scoring run. */
  readonly runDate: string;
  /** Public standard label shown next to the model. */
  readonly standardLabel: string;
}

/**
 * "claude-opus-4-8" → "Claude Opus 4.8"; "claude-fable-5" → "Claude Fable 5".
 * Word tokens are capitalized in order; numeric tokens join into a trailing
 * dotted version. Unknown shapes degrade gracefully (never throws).
 */
export function formatModelDisplay(modelId: string): string {
  const words: string[] = [];
  const nums: string[] = [];
  for (const token of modelId.split('-')) {
    if (token === '') continue;
    if (/^\d+$/.test(token)) nums.push(token);
    else words.push(token.charAt(0).toUpperCase() + token.slice(1));
  }
  return [...words, nums.join('.')].filter(Boolean).join(' ');
}

export interface BatchMetaForAttribution {
  readonly scope: string;
  readonly model: string;
  readonly runDate: string;
  /** True when the batch carries AIOIS-10 profiles (scores entries have aiois). */
  readonly hasAiois: boolean;
}

/**
 * Pick the batch whose scores the site currently shows. Mirrors
 * `pickLatestScore()`: strictly newer run_date wins; a same-date tie prefers
 * the AIOIS-10 batch; remaining ties keep the later entry in input order.
 * Throws when no occupations batch exists (fail-fast, same as the graph).
 */
export function pickAttributionBatch(
  metas: readonly BatchMetaForAttribution[],
): BatchMetaForAttribution {
  const candidates = metas.filter((m) => m.scope === 'occupations');
  if (candidates.length === 0) {
    throw new Error('score-attribution: no occupations score batch found under data/scores/');
  }
  let chosen = candidates[0]!;
  for (let i = 1; i < candidates.length; i += 1) {
    const entry = candidates[i]!;
    if (entry.runDate > chosen.runDate) {
      chosen = entry;
    } else if (entry.runDate === chosen.runDate && (entry.hasAiois || !chosen.hasAiois)) {
      chosen = entry;
    }
  }
  return chosen;
}

/**
 * The active scoring attribution — baked at build time (fs-free at runtime).
 * `standardLabel` is constant; model + date come from the generated module.
 */
export const SCORE_ATTRIBUTION: ScoreAttribution = Object.freeze({
  modelId: SCORE_ATTRIBUTION_DATA.modelId,
  modelDisplay: SCORE_ATTRIBUTION_DATA.modelDisplay,
  runDate: SCORE_ATTRIBUTION_DATA.runDate,
  standardLabel: 'AIOIS-10',
});
