import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
import type { ScoreRun } from '../schema/index.js';
import { activeOccupationRuns, comparableAioisRuns, latestOccupationRun, latestRunPerVendor, listOccupationRuns } from '../../site/occupation-runs.js';
import { VENDOR_WHITELIST } from '../../site/score-attribution.js';
import { ModelsByModelProjectionSchema } from '../../lib/projection-schemas.js';
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
    const aiois = comparableAioisRuns(activeOccupationRuns(runs));
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

  test('marks exactly one latest comparable run per vendor as in_panel', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const panel = latestRunPerVendor();
    const inPanel = Object.values(payload.models).filter((model) => model.in_panel);
    assert.equal(inPanel.length, panel.length);
    assert.deepEqual(
      inPanel.map((model) => `${model.model}@${model.date}`).sort(),
      panel.map((run) => `${run.model}@${run.runDate}`).sort(),
    );
    const historyRun = comparableAioisRuns().find(
      (run) => run.provider === 'anthropic' && !panel.some((entry) => entry.slug === run.slug),
    );
    assert.ok(historyRun);
    const historyPage = Object.values(payload.models).find((model) => model.model === historyRun.model);
    assert.ok(historyPage);
    assert.equal(historyPage.in_panel, false);
    assert.ok(modelsByModelMaxPageBytes(payload) <= 24 * 1024);
  });

  test('a later Anthropic batch flips the older Anthropic run out of the panel', async () => {
    const indexes = await indexesFixture();
    const currentAnthropic = latestRunPerVendor().find((run) => run.provider === 'anthropic')!;
    const current = [...indexes.runsByModel.values()]
      .flat()
      .find((run) => run.scorer.model === currentAnthropic.model && run.scope === 'occupations');
    assert.ok(current);
    const incomingModel = 'claude-fable-5-2';
    const extra: ScoreRun = {
      ...current,
      scorer: { ...current.scorer, model: incomingModel },
      run: { ...current.run, run_date: '2026-11-15', run_id: 'synthetic-fable-5-2' },
    };
    const runsByModel = new Map(
      [...indexes.runsByModel].map(([model, runs]) => [model, [...runs]] as const),
    );
    runsByModel.set(extra.scorer.model, [...(runsByModel.get(extra.scorer.model) ?? []), extra]);
    const payload = buildModelsByModelPayload(
      { ...indexes, runsByModel } as Indexes,
      '2026-11-16T00:00:00.000Z',
    );
    const older = Object.values(payload.models).find((model) => model.model === currentAnthropic.model);
    const newer = Object.values(payload.models).find((model) => model.model === incomingModel);
    assert.ok(older);
    assert.ok(newer);
    assert.equal(older.in_panel, false);
    assert.equal(newer.in_panel, true);
    assert.equal(
      Object.values(payload.models).filter((model) => model.in_panel).length,
      VENDOR_WHITELIST.length,
    );
  });

  test('keeps distribution, lists, drift, and payload-size contracts', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const latest = payload.models[latestOccupationRun().slug]!;

    assert.equal(latest.distribution.histogram.length, 20);
    assert.equal(
      latest.distribution.histogram.reduce((sum, bin) => sum + bin.count, 0),
      latest.covered_count,
    );
    assert.equal(latest.highest.length, 10);
    assert.equal(latest.lowest.length, 10);
    assert.ok(!('baseline' in latest.drift));
    if (!('baseline' in latest.drift)) {
      const aiois = comparableAioisRuns(activeOccupationRuns());
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
    const runs = [...indexes.runsByModel.values()]
      .flat()
      .filter((r) => r.scope === 'occupations' && r.run.backfill !== true);
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
    const indexes = withExtraRun(await indexesFixture(), reRunOf(source, '2098-01-01'));
    const payload = buildModelsByModelPayload(indexes, '2098-01-02T00:00:00.000Z');

    const reRunSlug = Object.keys(payload.models).find((slug) => slug.endsWith('@2098-01-01'))!;
    const reRun = payload.models[reRunSlug]!;
    // Newest run: nothing after it; prev is the immediately earlier date in the chain.
    assert.equal(reRun.nav.next, null);
    assert.ok(reRun.nav.prev);
    assert.equal(reRun.model, source.scorer.model);
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

describe('backfill batch is history-only (mms-9.8)', () => {
  function clip(value: number): number {
    return Math.min(10, value + 0.5);
  }

  function syntheticGrok45(source: ScoreRun): ScoreRun {
    const scores: ScoreRun['scores'] = {};
    for (const [id, entry] of Object.entries(source.scores)) {
      scores[id] = {
        ...entry,
        ai_risk: clip(entry.ai_risk),
        aiois: entry.aiois == null ? null : {
          ...entry.aiois,
          transformation: clip(entry.aiois.transformation),
        },
      };
    }
    return {
      ...source,
      scorer: { ...source.scorer, model: 'grok-4.5' },
      run: {
        ...source.run,
        run_date: '2099-12-31',
        run_id: 'grok-4.5-synthetic',
        backfill: true,
      },
      scores,
    };
  }

  async function withSynthetic(): Promise<{ live: ReturnType<typeof buildModelsByModelPayload>; withBackfill: ReturnType<typeof buildModelsByModelPayload> }> {
    const indexes = await indexesFixture();
    const grok = [...indexes.runsByModel.values()]
      .flat()
      .find((run) => run.scorer.model === 'grok-4.6' && run.scope === 'occupations');
    assert.ok(grok);
    const extra = syntheticGrok45(grok);
    const runsByModel = new Map(
      [...indexes.runsByModel].map(([model, runs]) => [model, [...runs]] as const),
    );
    runsByModel.set(extra.scorer.model, [...(runsByModel.get(extra.scorer.model) ?? []), extra]);
    const live = buildModelsByModelPayload(indexes, '2026-09-10T00:00:00.000Z');
    const withBackfill = buildModelsByModelPayload(
      { ...indexes, runsByModel } as Indexes,
      '2026-09-10T00:00:00.000Z',
    );
    return { live, withBackfill };
  }

  test('in_panel stays false and drift is the backfill note; existing pages do not move', async () => {
    const { live, withBackfill } = await withSynthetic();
    const backfill = withBackfill.models['grok-4.5@2099-12-31'];
    assert.ok(backfill);
    assert.equal(backfill.in_panel, false);
    assert.deepEqual(backfill.drift, { baseline: true, note_id: 'backfill_batch' });

    const grokLive = live.models['grok-4.6@2026-09-07'];
    const grokAfter = withBackfill.models['grok-4.6@2026-09-07'];
    assert.ok(grokLive);
    assert.ok(grokAfter);
    assert.equal(grokAfter.in_panel, true);
    assert.deepEqual(grokAfter.drift, grokLive.drift);

    const astraLive = live.models['gpt-6-astra@2026-09-10'];
    const astraAfter = withBackfill.models['gpt-6-astra@2026-09-10'];
    assert.ok(astraLive);
    assert.ok(astraAfter);
    assert.deepEqual(astraAfter.drift, astraLive.drift);
    const ordered = Object.values(withBackfill.models).sort(
      (a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model),
    );
    const astraIndex = ordered.findIndex((model) => model.slug === astraAfter.slug);
    const next = ordered[astraIndex + 1];
    assert.deepEqual(
      astraAfter.nav.next,
      next ? { slug: next.slug, modelDisplay: next.modelDisplay } : null,
    );
    assert.equal(withBackfill.models['grok-4.5@2099-12-31']!.nav.next, null);

    const inPanel = Object.values(withBackfill.models).filter((model) => model.in_panel);
    const grok6 = listOccupationRuns().find((run) => run.model === 'grok-4.6')!;
    const syntheticSummary = {
      ...grok6,
      model: 'grok-4.5',
      modelDisplay: 'Grok 4.5',
      runDate: '2099-12-31',
      slug: 'grok-4.5@2099-12-31',
      backfill: true,
    };
    assert.deepEqual(
      inPanel.map((model) => model.slug).sort(),
      latestRunPerVendor([...listOccupationRuns(), syntheticSummary]).map((run) => run.slug).sort(),
    );
  });

  test('schema accepts note_id backfill_batch and rejects unknown', async () => {
    const { withBackfill } = await withSynthetic();
    const parsed = ModelsByModelProjectionSchema.safeParse(withBackfill);
    assert.equal(parsed.success, true);

    const page = withBackfill.models['grok-4.5@2099-12-31']!;
    const bad = {
      ...withBackfill,
      models: {
        ...withBackfill.models,
        'grok-4.5@2099-12-31': {
          ...page,
          drift: { baseline: true as const, note_id: 'unknown' },
        },
      },
    };
    assert.equal(ModelsByModelProjectionSchema.safeParse(bad).success, false);
  });
});
