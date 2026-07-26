import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
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

    assert.deepEqual(slugs, ['opus-4-7', 'opus-4-8', 'fable-5', 'gpt-5.6-sol', 'opus-5']);
    assert.deepEqual(
      slugs.map((slug) => payload.models[slug]!.covered_count),
      [552, 556, 556, 556, 556],
    );
    assert.equal(payload.models['opus-4-8']!.nav.prev?.slug, 'opus-4-7');
    assert.equal(payload.models['gpt-5.6-sol']!.nav.prev?.slug, 'fable-5');
    assert.equal(payload.models['gpt-5.6-sol']!.nav.next?.slug, 'opus-5');
    assert.equal(payload.models['opus-5']!.nav.next, null);
  });

  test('compares only compatible AIOIS batches and never synthesizes legacy profiles', async () => {
    const payload = buildModelsByModelPayload(await indexesFixture(), '2026-07-13T00:00:00.000Z');
    const legacy = payload.models['opus-4-7']!;
    const firstAiois = payload.models['opus-4-8']!;
    const fable = payload.models['fable-5']!;
    const gpt = payload.models['gpt-5.6-sol']!;
    const latest = payload.models['opus-5']!;

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
    const latest = payload.models['opus-5']!;

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
