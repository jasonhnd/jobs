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
 * "claude-opus-4-8" → "Claude Opus 4.8"; "gpt-5.6-sol" → "GPT 5.6 SOL".
 * Trailing numeric tokens join into a dotted version. Numeric tokens that
 * appear before later word tokens stay in place. Unknown shapes degrade
 * gracefully (never throws).
 */
export function formatModelDisplay(modelId: string): string {
  const tokens = modelId.split('-').filter(Boolean);
  const firstNumeric = tokens.findIndex((token) => /^\d+(?:\.\d+)?$/.test(token));
  if (
    firstNumeric >= 0 &&
    tokens.slice(firstNumeric).every((token) => /^\d+(?:\.\d+)?$/.test(token))
  ) {
    return [
      ...tokens.slice(0, firstNumeric).map(displayModelToken),
      tokens.slice(firstNumeric).join('.'),
    ].filter(Boolean).join(' ');
  }
  return tokens.map(displayModelToken).join(' ');
}

function assertValidModelToken(value: string, label: string): void {
  if (value.length === 0 || value.includes('/') || /\s/.test(value)) {
    throw new Error(`score-attribution: invalid ${label}: ${JSON.stringify(value)}`);
  }
}

/**
 * Public URL slug for a scorer model id. Only the leading `claude-` provider
 * prefix is hidden; every other model id is already the public slug.
 */
export function modelSlug(modelId: string): string {
  assertValidModelToken(modelId, 'model id');
  return modelId.startsWith('claude-') ? modelId.slice('claude-'.length) : modelId;
}

/**
 * Reverse lookup for model slugs. Unknown, invalid, or non-unique slugs return
 * null; callers must not infer a provider prefix mechanically.
 */
export function modelIdFromSlug(
  slug: string,
  knownModelIds: readonly string[],
): string | null {
  try {
    assertValidModelToken(slug, 'model slug');
  } catch {
    return null;
  }

  const matches: string[] = [];
  for (const modelId of knownModelIds) {
    try {
      if (modelSlug(modelId) === slug) matches.push(modelId);
    } catch {
      return null;
    }
  }
  return matches.length === 1 ? matches[0]! : null;
}

function displayModelToken(token: string): string {
  if (token.toLowerCase() === 'gpt') return 'GPT';
  if (token.toLowerCase() === 'sol') return 'SOL';
  return token.charAt(0).toUpperCase() + token.slice(1);
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
