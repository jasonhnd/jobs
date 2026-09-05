/**
 * Occupation scoring runs listed from `data/scores/`.
 *
 * Test helpers use this so a new batch landing does not require rewriting
 * hardcoded model names, slugs, or roster lengths. Production pages still
 * go through projections / SCORE_PANEL.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatModelDisplay, runSlug } from './score-attribution.js';

export interface OccupationRunSummary {
  readonly model: string;
  readonly modelDisplay: string;
  readonly runDate: string;
  readonly slug: string;
  readonly hasAiois: boolean;
  readonly coveredCount: number;
}

interface ScoreFileLite {
  readonly scope?: string;
  readonly scorer?: { readonly model?: string };
  readonly run?: { readonly run_date?: string };
  readonly scores?: Record<string, { readonly aiois?: unknown }>;
}

function summarize(file: ScoreFileLite, source: string): OccupationRunSummary {
  const model = file.scorer?.model;
  const runDate = file.run?.run_date;
  if (!model || !runDate) {
    throw new Error(`occupation-runs: ${source} is missing scorer.model or run.run_date`);
  }
  const scores = file.scores ?? {};
  return {
    model,
    modelDisplay: formatModelDisplay(model),
    runDate,
    slug: runSlug({ model, runDate }),
    hasAiois: Object.values(scores).some((entry) => entry?.aiois != null),
    coveredCount: Object.keys(scores).length,
  };
}

export function listOccupationRuns(root = process.cwd()): OccupationRunSummary[] {
  const dir = join(root, 'data', 'scores');
  const runs: OccupationRunSummary[] = [];
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, name), 'utf-8')) as ScoreFileLite;
    if (parsed.scope !== 'occupations') continue;
    runs.push(summarize(parsed, name));
  }
  return runs.sort((a, b) => a.runDate.localeCompare(b.runDate) || a.model.localeCompare(b.model));
}

export function comparableAioisRuns(
  runs: readonly OccupationRunSummary[] = listOccupationRuns(),
): OccupationRunSummary[] {
  return runs.filter((run) => run.hasAiois);
}

export function latestOccupationRun(
  runs: readonly OccupationRunSummary[] = listOccupationRuns(),
): OccupationRunSummary {
  const latest = runs[runs.length - 1];
  if (!latest) throw new Error('occupation-runs: no occupations batches in data/scores/');
  return latest;
}

export function latestAioisPair(
  runs: readonly OccupationRunSummary[] = listOccupationRuns(),
): { readonly baseline: OccupationRunSummary; readonly candidate: OccupationRunSummary } {
  const aiois = comparableAioisRuns(runs);
  const candidate = aiois[aiois.length - 1];
  const baseline = aiois[aiois.length - 2];
  if (!candidate || !baseline) {
    throw new Error('occupation-runs: need at least two AIOIS-10 occupation batches');
  }
  return { baseline, candidate };
}
