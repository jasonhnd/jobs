#!/usr/bin/env bun
/**
 * check-model-redirects.ts — keeps the bare-model-slug redirects in vercel.json
 * in step with data/scores/.
 *
 * Public model pages are keyed by RUN (`/models/opus-5@2026-07-26`) so that a
 * model scored twice gets two URLs instead of colliding on one — see issue
 * #218. The bare `/models/<model-slug>` URLs that shipped before that change
 * are preserved as permanent redirects to each model's LATEST run.
 *
 * That mapping is derived from the batches, so it goes stale the moment a new
 * batch lands. A hand-maintained list is exactly the failure mode issue #217
 * catalogued, so this gate derives the expected set and diffs it rather than
 * trusting anyone to remember.
 *
 * Exits 0 when the redirect block matches, 1 otherwise.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ScoreRunSchema, type ScoreRun } from '../src/data/schema/index.js';
import { modelSlug, runSlug } from '../src/site/score-attribution.js';

const ROOT = join(import.meta.dir, '..');

interface VercelRedirect {
  readonly source: string;
  readonly destination: string;
  readonly permanent?: boolean;
}

function fail(message: string): never {
  console.error(`[check-model-redirects] FAIL: ${message}`);
  process.exit(1);
}

function loadScoreRuns(): ScoreRun[] {
  const dir = join(ROOT, 'data', 'scores');
  const runs: ScoreRun[] = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    runs.push(ScoreRunSchema.parse(JSON.parse(readFileSync(join(dir, name), 'utf-8'))));
  }
  return runs;
}

/** `/models/<bare slug>` → `/models/<run slug of that model's newest batch>`. */
function expectedRedirects(runs: readonly ScoreRun[]): Map<string, string> {
  const latestByModel = new Map<string, ScoreRun>();
  for (const run of runs) {
    if (run.scope !== 'occupations') continue;
    const current = latestByModel.get(run.scorer.model);
    if (current === undefined || run.run.run_date > current.run.run_date) {
      latestByModel.set(run.scorer.model, run);
    }
  }
  if (latestByModel.size === 0) {
    fail('no occupations batches found under data/scores/; the redirect set would be empty');
  }

  const expected = new Map<string, string>();
  for (const [model, run] of latestByModel) {
    const bare = `/models/${modelSlug(model)}`;
    const target = `/models/${runSlug({ model, runDate: run.run.run_date })}`;
    // Two distinct model ids sharing a bare slug would need one of them to lose
    // its redirect. That is a naming collision to resolve, not something to
    // silently pick a winner for.
    const clash = expected.get(bare);
    if (clash !== undefined && clash !== target) {
      fail(`two models share the bare slug ${bare} (${clash} vs ${target}); rename one model id`);
    }
    expected.set(bare, target);
  }
  return expected;
}

function loadRedirects(): VercelRedirect[] {
  const raw = readFileSync(join(ROOT, 'vercel.json'), 'utf-8');
  const parsed = JSON.parse(raw) as { redirects?: VercelRedirect[] };
  if (!Array.isArray(parsed.redirects)) {
    fail('vercel.json has no redirects array');
  }
  return parsed.redirects;
}

function main(): void {
  const expected = expectedRedirects(loadScoreRuns());
  const actual = new Map<string, VercelRedirect>();
  for (const redirect of loadRedirects()) {
    if (!redirect.source.startsWith('/models/')) continue;
    if (actual.has(redirect.source)) {
      fail(`vercel.json declares ${redirect.source} twice; the second is dead`);
    }
    actual.set(redirect.source, redirect);
  }

  const problems: string[] = [];
  for (const [source, destination] of expected) {
    const found = actual.get(source);
    if (found === undefined) {
      problems.push(`missing: ${source} → ${destination}`);
      continue;
    }
    if (found.destination !== destination) {
      problems.push(`stale:   ${source} → ${found.destination} (latest run is ${destination})`);
    }
    if (found.permanent !== true) {
      problems.push(`not permanent: ${source} should be a 308, not a temporary redirect`);
    }
  }
  for (const source of actual.keys()) {
    if (!expected.has(source)) {
      problems.push(`orphan:  ${source} has no matching model under data/scores/`);
    }
  }

  if (problems.length > 0) {
    console.error('[check-model-redirects] vercel.json /models redirects are out of step with data/scores/:');
    for (const problem of problems) console.error(`    ${problem}`);
    console.error('  Every model keeps its pre-#218 bare URL pointing at that model\'s newest run.');
    process.exit(1);
  }

  console.log(`[check-model-redirects] OK - ${expected.size} bare model slug(s) redirect to their latest run`);
}

if (import.meta.main) {
  main();
}
