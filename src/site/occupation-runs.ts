/**
 * Occupation scoring runs listed from `data/scores/`.
 *
 * Test helpers use this so a new batch landing does not require rewriting
 * hardcoded model names, slugs, or roster lengths. Production pages still
 * go through projections / SCORE_PANEL.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatModelDisplay,
  isWhitelistedVendor,
  runSlug,
  VENDOR_WHITELIST,
} from './score-attribution.js';

export interface OccupationRunSummary {
  readonly model: string;
  readonly modelDisplay: string;
  readonly provider: string;
  readonly runDate: string;
  readonly slug: string;
  readonly hasAiois: boolean;
  readonly coveredCount: number;
  readonly backfill: boolean;
}

interface ScoreFileLite {
  readonly scope?: string;
  readonly scorer?: { readonly model?: string; readonly model_provider?: string };
  readonly run?: { readonly run_date?: string; readonly backfill?: boolean };
  readonly scores?: Record<string, { readonly aiois?: unknown }>;
}

function summarize(file: ScoreFileLite, source: string): OccupationRunSummary {
  const model = file.scorer?.model;
  const runDate = file.run?.run_date;
  const provider = file.scorer?.model_provider;
  if (!model || !runDate) {
    throw new Error(`occupation-runs: ${source} is missing scorer.model or run.run_date`);
  }
  if (!provider) {
    throw new Error(`occupation-runs: ${source} is missing scorer.model_provider`);
  }
  const scores = file.scores ?? {};
  return {
    model,
    modelDisplay: formatModelDisplay(model),
    provider,
    runDate,
    slug: runSlug({ model, runDate }),
    hasAiois: Object.values(scores).some((entry) => entry?.aiois != null),
    coveredCount: Object.keys(scores).length,
    backfill: file.run?.backfill === true,
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

/** Runs that may become "latest": everything except backfill batches (mms-9). */
export function activeOccupationRuns(
  runs: readonly OccupationRunSummary[] = listOccupationRuns(),
): OccupationRunSummary[] {
  return runs.filter((run) => !run.backfill);
}

export function latestOccupationRun(
  runs: readonly OccupationRunSummary[] = listOccupationRuns(),
): OccupationRunSummary {
  const active = activeOccupationRuns(runs);
  const latest = active[active.length - 1];
  if (!latest) throw new Error('occupation-runs: no occupations batches in data/scores/');
  return latest;
}

export function latestAioisPair(
  runs: readonly OccupationRunSummary[] = listOccupationRuns(),
): { readonly baseline: OccupationRunSummary; readonly candidate: OccupationRunSummary } {
  const aiois = comparableAioisRuns(activeOccupationRuns(runs));
  const candidate = aiois[aiois.length - 1];
  const baseline = aiois[aiois.length - 2];
  if (!candidate || !baseline) {
    throw new Error('occupation-runs: need at least two AIOIS-10 occupation batches');
  }
  return { baseline, candidate };
}

/** One latest comparable AIOIS-10 run per whitelisted vendor, in whitelist order. */
export function latestRunPerVendor(
  runs: readonly OccupationRunSummary[] = listOccupationRuns(),
): OccupationRunSummary[] {
  const latest = new Map<string, OccupationRunSummary>();
  for (const run of comparableAioisRuns(activeOccupationRuns(runs))) {
    if (!isWhitelistedVendor(run.provider)) continue;
    const prev = latest.get(run.provider);
    if (
      !prev
      || run.runDate > prev.runDate
      || (run.runDate === prev.runDate && run.model.localeCompare(prev.model) > 0)
    ) {
      latest.set(run.provider, run);
    }
  }
  return VENDOR_WHITELIST
    .map((vendor) => latest.get(vendor))
    .filter((run): run is OccupationRunSummary => run != null);
}
