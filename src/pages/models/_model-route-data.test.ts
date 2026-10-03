import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadModelBatchMetas, knownRuns, type ModelBatchMeta } from './_model-route-data.ts';

describe('loadModelBatchMetas', () => {
  test('returns well-formed occupation batch metas sorted by date then model', async () => {
    const metas = await loadModelBatchMetas();
    assert.ok(metas.length > 0);
    for (const m of metas) {
      assert.match(m.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(m.model.length > 0);
      assert.ok(m.slug.endsWith(m.date));
      assert.ok(m.covered_count > 0);
    }
    for (let i = 1; i < metas.length; i++) {
      const a = metas[i - 1]!;
      const b = metas[i]!;
      assert.ok(a.date.localeCompare(b.date) || a.model.localeCompare(b.model) <= 0);
    }
  });
});

describe('knownRuns', () => {
  test('maps metas to model/runDate refs', () => {
    const metas: ModelBatchMeta[] = [{ model: 'm-1', slug: 'm-1_2026-01-01', date: '2026-01-01', covered_count: 3 }];
    assert.deepEqual(knownRuns(metas), [{ model: 'm-1', runDate: '2026-01-01' }]);
    assert.deepEqual(knownRuns([]), []);
  });
});
