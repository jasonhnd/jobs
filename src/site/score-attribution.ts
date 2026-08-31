/**
 * src/site/score-attribution.ts — single source of truth for "which model
 * scored the current batch, and when" wording across the site.
 *
 * Same consolidation rationale as src/site/config.ts: the model name + run
 * date used to be hard-coded in 40+ surfaces (footer, hubs, FAQ, methodology,
 * sector copy …) and every score-batch upgrade had to chase them all. The
 * active attribution is derived ONCE — at BUILD TIME, in src/data/build.ts,
 * mirroring `pickLatestScore()` batch-selection semantics for 最新観測 —
 * and baked into the generated, fs-free `_score-attribution.ts` so importers
 * (including the few Vercel Edge bundles that share chunks with page code)
 * carry NO node:fs. Canonical public scores use `pickConsensusScore()`;
 * `SCORE_PANEL` is the matching panel metadata.
 *
 * The pure helpers below (`formatModelDisplay`, `pickAttributionBatch`) are
 * the canonical selection/formatting logic; build.ts uses them to compute the
 * baked values, and the tests pin them.
 */
import { SCORE_ATTRIBUTION_DATA, SCORE_PANEL_DATA } from './_score-attribution.js';

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
 *
 * Non-unique is a real case: a model can be scored more than once. Public URLs
 * are keyed by RUN, not by model — see `runSlug` — so this stays a
 * model-level helper for surfaces that genuinely have one model in hand.
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

  const matches = new Set<string>();
  for (const modelId of knownModelIds) {
    try {
      if (modelSlug(modelId) === slug) matches.add(modelId);
    } catch {
      return null;
    }
  }
  return matches.size === 1 ? [...matches][0]! : null;
}

/** Separator between the model slug and the run date in a public run slug. */
const RUN_SLUG_SEPARATOR = '@';
const RUN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A scoring run identified by model and date — the unit a /models page shows. */
export interface ScoreRunRef {
  readonly model: string;
  readonly runDate: string;
}

/**
 * Public URL slug for one scoring RUN, e.g. `opus-5@2026-07-26`.
 *
 * A model id alone cannot address a page: `data/scores/` is append-only and the
 * runbook treats re-scoring an existing model as normal, so two runs would
 * collide on one URL. The `model@date` shape matches the key
 * `src/site/model-editorial.ts` already uses to stop a re-run inheriting
 * another run's prose. Issue #218.
 */
export function runSlug(ref: ScoreRunRef): string {
  const base = modelSlug(ref.model);
  if (!RUN_DATE_RE.test(ref.runDate)) {
    throw new Error(`score-attribution: invalid run date: ${JSON.stringify(ref.runDate)}`);
  }
  return `${base}${RUN_SLUG_SEPARATOR}${ref.runDate}`;
}

/**
 * Split a run slug back into its parts without consulting any batch list.
 * Returns null for anything that is not `<model-slug>@<YYYY-MM-DD>`.
 */
export function parseRunSlug(slug: string): { readonly modelSlug: string; readonly runDate: string } | null {
  const at = slug.lastIndexOf(RUN_SLUG_SEPARATOR);
  if (at <= 0) return null;
  const base = slug.slice(0, at);
  const runDate = slug.slice(at + RUN_SLUG_SEPARATOR.length);
  if (!RUN_DATE_RE.test(runDate)) return null;
  try {
    assertValidModelToken(base, 'model slug');
  } catch {
    return null;
  }
  return { modelSlug: base, runDate };
}

/**
 * Reverse lookup for run slugs against the known runs. Returns the matching run
 * or null. Unlike `modelIdFromSlug` this cannot be defeated by a model with two
 * runs — that is the whole point of keying on the run.
 */
export function runFromSlug(
  slug: string,
  knownRuns: readonly ScoreRunRef[],
): ScoreRunRef | null {
  const parsed = parseRunSlug(slug);
  if (parsed === null) return null;

  const matches: ScoreRunRef[] = [];
  for (const run of knownRuns) {
    if (run.runDate !== parsed.runDate) continue;
    try {
      if (modelSlug(run.model) === parsed.modelSlug) matches.push(run);
    } catch {
      return null;
    }
  }
  // Two runs sharing a model AND a date is a data defect, not a routing case;
  // batch loading rejects it with a message that names the condition.
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

export interface ScorePanel {
  /** Comparable votes in the current consensus panel. */
  readonly voteCount: number;
  /** Newest comparable run_date (window anchor). */
  readonly latestRunDate: string;
  readonly windowMonths: number;
  readonly floorVotes: number;
  /** True when floor fill pulled in votes older than the window. */
  readonly usedExpiredVotes: boolean;
}

/**
 * Consensus panel metadata — baked at build time (fs-free at runtime).
 * Distinct from `SCORE_ATTRIBUTION`, which remains the latest observation
 * batch for 最新観測 / /models.
 */
export const SCORE_PANEL: ScorePanel = Object.freeze({
  voteCount: SCORE_PANEL_DATA.voteCount,
  latestRunDate: SCORE_PANEL_DATA.latestRunDate,
  windowMonths: SCORE_PANEL_DATA.windowMonths,
  floorVotes: SCORE_PANEL_DATA.floorVotes,
  usedExpiredVotes: SCORE_PANEL_DATA.usedExpiredVotes,
});
