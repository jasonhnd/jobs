import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
import type { ScoreRun } from '../schema/index.js';
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
    const slugs = Object.keys(payload.models);

    assert.deepEqual(slugs, [
      'opus-4-7@2026-04-25', 'opus-4-8@2026-05-30', 'fable-5@2026-06-13',
      'gpt-5.6-sol@2026-07-12', 'opus-5@2026-07-26',
    ]);
    assert.deepEqual(
      slugs.map((slug) => payload.models[slug]!.covered_count),
      [552, 556, 556, 556, 556],
    );
    assert.equal(payload.models['opus-4-8@2026-05-30']!.nav.prev?.slug, 'opus-4-7@2026-04-25');
    assert.equal(payload.models['gpt-5.6-sol@2026-07-12']!.nav.prev?.slug, 'fable-5@2026-06-13');
    assert.equal(payload.models['gpt-5.6-sol@2026-07-12']!.nav.next?.slug, 'opus-5@2026-07-26');
    assert.equal(payload.models['opus-5@2026-07-26']!.nav.next, null);
  });

  test('compares only compatible AIOIS batches and never synthesizes legacy profiles', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const legacy = payload.models['opus-4-7@2026-04-25']!;
    const firstAiois = payload.models['opus-4-8@2026-05-30']!;
    const fable = payload.models['fable-5@2026-06-13']!;
    const gpt = payload.models['gpt-5.6-sol@2026-07-12']!;
    const latest = payload.models['opus-5@2026-07-26']!;

    assert.deepEqual(legacy.drift, { baseline: true, note_id: 'legacy_batch' });
    assert.deepEqual(firstAiois.drift, { baseline: true, note_id: 'first_aiois_batch' });
    assert.equal(containsKey(legacy, 'dims'), false);
    assert.equal(containsKey(legacy, 'displacement'), false);

    assert.equal('baseline' in fable.drift, false);
    if (!('baseline' in fable.drift)) {
      assert.equal(fable.drift.predecessor.model, 'claude-opus-4-8');
      assert.equal(fable.drift.compared_count, 556);
    }
    assert.equal('baseline' in gpt.drift, false);
    if (!('baseline' in gpt.drift)) {
      assert.equal(gpt.drift.predecessor.model, 'claude-fable-5');
      assert.equal(gpt.drift.compared_count, 556);
    }
    assert.equal('baseline' in latest.drift, false);
    if (!('baseline' in latest.drift)) {
      assert.equal(latest.drift.predecessor.model, 'gpt-5.6-sol');
      assert.equal(latest.drift.compared_count, 556);
    }
  });

  test('keeps distribution, lists, drift, and payload-size contracts', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const latest = payload.models['opus-5@2026-07-26']!;

    assert.equal(latest.distribution.histogram.length, 20);
    assert.equal(
      latest.distribution.histogram.reduce((sum, bin) => sum + bin.count, 0),
      latest.covered_count,
    );
    assert.equal(latest.highest.length, 10);
    assert.equal(latest.lowest.length, 10);
    assert.ok(!('baseline' in latest.drift));
    if (!('baseline' in latest.drift)) {
      assert.equal(latest.drift.predecessor.model, 'gpt-5.6-sol');
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
