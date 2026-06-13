/**
 * src/site/score-attribution.ts — single source of truth for "which model
 * scored the current batch, and when" wording across the site.
 *
 * Same consolidation rationale as src/site/config.ts: the model name + run
 * date used to be hard-coded in 40+ surfaces (footer, hubs, FAQ, JSON-LD,
 * methodology, sector copy …) and every score-batch upgrade had to chase
 * them all. This module derives the attribution ONCE from the score batches
 * themselves, mirroring `pickLatestScore()` batch-selection semantics
 * (latest `run.run_date`; same-date tie prefers the AIOIS-10 batch).
 *
 * BUILD-TIME ONLY: reads data/scores/*.json via node:fs at module load.
 * Edge-runtime code (src/middleware.ts, /api/og dispatch and renderers)
 * must NOT import this module — edge surfaces use standard-only wording
 * (AIOIS-10) without a model name instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

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

function readAttribution(): ScoreAttribution {
  const scoresDir = path.join(process.cwd(), 'data', 'scores');
  const metas: BatchMetaForAttribution[] = readdirSync(scoresDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(path.join(scoresDir, f), 'utf8')) as {
        scope?: string;
        scorer?: { model?: string };
        run?: { run_date?: string };
        scores?: Record<string, { aiois?: unknown }>;
      };
      return {
        scope: raw.scope ?? '',
        model: raw.scorer?.model ?? '',
        runDate: raw.run?.run_date ?? '',
        hasAiois: Object.values(raw.scores ?? {}).some((s) => s.aiois != null),
      };
    });
  const batch = pickAttributionBatch(metas);
  return Object.freeze({
    modelId: batch.model,
    modelDisplay: formatModelDisplay(batch.model),
    runDate: batch.runDate,
    standardLabel: 'AIOIS-10',
  });
}

/** The active scoring attribution — frozen at module load (build time). */
export const SCORE_ATTRIBUTION: ScoreAttribution = readAttribution();
