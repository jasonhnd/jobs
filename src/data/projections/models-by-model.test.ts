import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
import type { ScoreRun } from '../schema/index.js';
import { comparableAioisRuns, listOccupationRuns } from '../../site/occupation-runs.js';
import { buildModelsByModelPayload, modelsByModelMaxPageBytes } from './models-by-model.js';

let indexesPromise: Promise<Indexes> | null = null;

async function indexesFixture(): Promise<Indexes> {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const { indexes, errors } = await buildIndexes();
      assert.deepEqual(errors, []);
      return indexes;
    })();
  }
  return indexesPromise;
}

function containsKey(value: unknown, forbiddenKey: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsKey(item, forbiddenKey));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, child]) => key === forbiddenKey || containsKey(child, forbiddenKey));
  }
  return false;
}

describe('models-by-model projection', () => {
  test('builds one per-model page payload for each current score batch', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const runs = listOccupationRuns();
    const slugs = Object.keys(payload.models);

    assert.deepEqual(slugs, runs.map((run) => run.slug));
    assert.deepEqual(
      slugs.map((slug) => payload.models[slug]!.covered_count),
      runs.map((run) => run.coveredCount),
    );
    assert.ok(runs.length >= 2);
    for (let i = 0; i < runs.length; i += 1) {
      const page = payload.models[runs[i]!.slug]!;
      assert.equal(page.nav.prev?.slug ?? null, i === 0 ? null : runs[i - 1]!.slug);
      assert.equal(page.nav.next?.slug ?? null, i === runs.length - 1 ? null : runs[i + 1]!.slug);
    }
  });

  test('compares only compatible AIOIS batches and never synthesizes legacy profiles', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const runs = listOccupationRuns();
    const aiois = comparableAioisRuns(runs);
    const legacyRuns = runs.filter((run) => !run.hasAiois);
    assert.ok(legacyRuns.length >= 1);
    assert.ok(aiois.length >= 2);

    for (const run of legacyRuns) {
      const page = payload.models[run.slug]!;
      assert.deepEqual(page.drift, { baseline: true, note_id: 'legacy_batch' });
      assert.equal(containsKey(page, 'dims'), false);
      assert.equal(containsKey(page, 'displacement'), false);
    }

    const firstAiois = payload.models[aiois[0]!.slug]!;
    assert.deepEqual(firstAiois.drift, { baseline: true, note_id: 'first_aiois_batch' });

    for (let i = 1; i < aiois.length; i += 1) {
      const page = payload.models[aiois[i]!.slug]!;
      assert.equal('baseline' in page.drift, false);
      if (!('baseline' in page.drift)) {
        assert.equal(page.drift.predecessor.model, aiois[i - 1]!.model);
        assert.ok(page.drift.compared_count >= 1);
      }
    }
  });

  test('keeps distribution, lists, drift, and payload-size contracts', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const latest = payload.models[listOccupationRuns().at(-1)!.slug]!;

    assert.equal(latest.distribution.histogram.length, 20);
    assert.equal(
      latest.distribution.histogram.reduce((sum, bin) => sum + bin.count, 0),
      latest.covered_count,
    );
    assert.equal(latest.highest.length, 10);
    assert.equal(latest.lowest.length, 10);
    assert.ok(!('baseline' in latest.drift));
    if (!('baseline' in latest.drift)) {
      const aiois = comparableAioisRuns();
      assert.equal(latest.drift.predecessor.model, aiois[aiois.length - 2]!.model);
      assert.ok(latest.drift.movers.length <= 5);
      assert.ok(latest.drift.band_crossings.length <= 5);
    }
    assert.equal(containsKey(payload, 'rationale_ja'), false);
    assert.ok(modelsByModelMaxPageBytes(payload) <= 24 * 1024);
  });
});

// Issue #218: a model can be scored more than once — `data/scores/` is
// append-only and the runbook documents re-scoring as normal. This case used
// to crash the build with "model slug round-trip failed", a slug error that
// was not happening; the real condition was two runs sharing one model id.
describe('re-scoring a model that has already scored', () => {
  /** Clone the indexes with `run` appended, as landing a new batch would. */
  function withExtraRun(indexes: Indexes, run: ScoreRun): Indexes {
    const runsByModel = new Map(
      [...indexes.runsByModel].map(([model, runs]) => [model, [...runs]] as const),
    );
    const existing = runsByModel.get(run.scorer.model) ?? [];
    runsByModel.set(run.scorer.model, [...existing, run]);
    return { ...indexes, runsByModel } as Indexes;
  }

  function reRunOf(source: ScoreRun, runDate: string): ScoreRun {
    return { ...source, run: { ...source.run, run_date: runDate } };
  }

  async function latestRun(): Promise<ScoreRun> {
    const indexes = await indexesFixture();
    const runs = [...indexes.runsByModel.values()].flat().filter((r) => r.scope === 'occupations');
    return runs.reduce((newest, run) => (run.run.run_date > newest.run.run_date ? run : newest));
  }

  test('builds a separate page for each run instead of throwing', async () => {
    const source = await latestRun();
    const indexes = withExtraRun(await indexesFixture(), reRunOf(source, '2026-11-15'));

    const payload = buildModelsByModelPayload(indexes, '2026-11-16T00:00:00.000Z');
    const slugs = Object.keys(payload.models);

    const original = slugs.find((slug) => slug.endsWith(`@${source.run.run_date}`));
    const reRun = slugs.find((slug) => slug.endsWith('@2026-11-15'));
    assert.ok(original, `original run missing from ${JSON.stringify(slugs)}`);
    assert.ok(reRun, `re-run missing from ${JSON.stringify(slugs)}`);
    assert.notEqual(original, reRun);

    // Same model, two URLs, both carrying that model's id.
    assert.equal(payload.models[original]!.model, source.scorer.model);
    assert.equal(payload.models[reRun]!.model, source.scorer.model);
    assert.equal(payload.models[reRun]!.date, '2026-11-15');
  });

  test('orders the nav chain by run date across the repeated model', async () => {
    const source = await latestRun();
    const indexes = withExtraRun(await indexesFixture(), reRunOf(source, '2026-11-15'));
    const payload = buildModelsByModelPayload(indexes, '2026-11-16T00:00:00.000Z');

    const reRunSlug = Object.keys(payload.models).find((slug) => slug.endsWith('@2026-11-15'))!;
    const reRun = payload.models[reRunSlug]!;
    // Newest run: nothing after it, and its predecessor is the batch it repeats.
    assert.equal(reRun.nav.next, null);
    assert.equal(reRun.nav.prev?.slug.endsWith(`@${source.run.run_date}`), true);
  });

  test('two batches sharing a model AND a date fail with a message naming that', async () => {
    const source = await latestRun();
    // Same model, same run_date — a genuine data defect, unlike a re-run.
    const indexes = withExtraRun(await indexesFixture(), reRunOf(source, source.run.run_date));

    assert.throws(
      () => buildModelsByModelPayload(indexes, '2026-11-16T00:00:00.000Z'),
      (error: Error) => {
        assert.match(error.message, /duplicate scoring run/);
        assert.match(error.message, new RegExp(source.scorer.model.replace(/\./g, '\\.')));
        assert.match(error.message, new RegExp(source.run.run_date));
        // The old message blamed slug derivation, which was working correctly.
        assert.equal(/round-trip/.test(error.message), false);
        return true;
      },
    );
  });
});
