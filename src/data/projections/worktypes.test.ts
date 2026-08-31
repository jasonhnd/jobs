import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
import { buildWorktypesPayload, FAMILY_CODES } from './worktypes.js';

type AxisId = 'a1' | 'a2' | 'a3';
type DimensionKey = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6';

const GENERATED_AT = '2026-01-01T00:00:00.000Z';
const VALID_CODE = /^[CR][PD][BK]$/;
const EXPOSED = new Set(['R', 'D', 'K']);

let fixturePromise: Promise<{ indexes: Indexes; payload: ReturnType<typeof buildWorktypesPayload> }> | null = null;

async function fixture() {
  if (!fixturePromise) {
    fixturePromise = (async () => {
      const { indexes, errors } = await buildIndexes();
      assert.deepEqual(errors, []);
      return {
        indexes,
        payload: buildWorktypesPayload(indexes, { generatedAt: GENERATED_AT }),
      };
    })();
  }
  return fixturePromise;
}

function activeAioisIds(indexes: Indexes): number[] {
  return [...indexes.canonicalScoreByOcc.keys()]
    .filter((id) => indexes.canonicalScoreByOcc.get(id)?.aiois != null)
    .sort((a, b) => a - b);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function expectedThresholds(indexes: Indexes): Record<AxisId, number> {
  const ids = activeAioisIds(indexes);
  const dims: DimensionKey[] = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
  const stats = {} as Record<DimensionKey, { mean: number; stdev: number }>;

  for (const dim of dims) {
    const values = ids.map((id) => indexes.canonicalScoreByOcc.get(id)!.aiois![dim]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    stats[dim] = { mean, stdev: Math.sqrt(variance) };
  }

  const norm = (id: number, dim: DimensionKey): number => {
    const value = indexes.canonicalScoreByOcc.get(id)!.aiois![dim];
    const stat = stats[dim];
    return stat.stdev === 0 ? 0 : (value - stat.mean) / stat.stdev;
  };

  const rows = ids.map((id) => ({
    a1: norm(id, 'd6') - norm(id, 'd2'),
    a2: norm(id, 'd5') + 0.5 * norm(id, 'd4') - norm(id, 'd1'),
    a3: norm(id, 'd3') - (norm(id, 'd1') + norm(id, 'd4') + norm(id, 'd6')) / 3,
  }));

  return {
    a1: median(rows.map((row) => row.a1)),
    a2: median(rows.map((row) => row.a2)),
    a3: median(rows.map((row) => row.a3)),
  };
}

function exposure(code: string): number {
  return [...code].filter((pole) => EXPOSED.has(pole)).length;
}

describe('worktypes projection', () => {
  test('covers all 556 active AIOIS-scored occupations', async () => {
    const { indexes, payload } = await fixture();
    const activeIds = activeAioisIds(indexes);
    const payloadIds = Object.keys(payload.occupations).map(Number).sort((a, b) => a - b);

    assert.equal(activeIds.length, 556);
    assert.deepEqual(payloadIds, activeIds);
  });

  test('emits only valid 8-family codes with matching exposure and rarity', async () => {
    const { payload } = await fixture();

    for (const record of Object.values(payload.occupations)) {
      assert.match(record.code, VALID_CODE);
      assert.equal(record.exposure, exposure(record.code));
      assert.equal(record.familyId, payload.families[record.code].familyId);
      assert.equal(record.rarityPct, payload.families[record.code].pct);
    }
  });

  test('keeps calibrated family rarity inside the 3%-35% guardrails', async () => {
    const { payload } = await fixture();
    const total = Object.keys(payload.occupations).length;
    const countSum = Object.values(payload.families).reduce((sum, family) => sum + family.count, 0);

    assert.equal(countSum, total);
    for (const code of FAMILY_CODES) {
      const family = payload.families[code];
      assert.ok(family.pct >= 3, `${code} below floor: ${family.pct}`);
      assert.ok(family.pct <= 35, `${code} above ceiling: ${family.pct}`);
    }
    // Under the consensus panel the raw distribution already clears the 3%
    // floor, so the rarest family needs no smoothing and calibrated == raw.
    assert.equal(payload.calibration.raw_distribution.CDB.pct, 3.1);
    assert.equal(payload.families.CDB.pct, 3.1);
    assert.equal(payload.calibration.smoothing.adjustments.length, 0);
  });

  test('thresholds match the computed axis medians', async () => {
    const { indexes, payload } = await fixture();
    const expected = expectedThresholds(indexes);

    for (const axis of ['a1', 'a2', 'a3'] as const) {
      assert.ok(Math.abs(payload.thresholds[axis] - expected[axis]) < 1e-12, axis);
    }
  });

  test('variant mapping is present and deterministic for every family', async () => {
    const { indexes, payload } = await fixture();
    const again = buildWorktypesPayload(indexes, { generatedAt: GENERATED_AT });

    assert.deepEqual(again, payload);
    for (const code of FAMILY_CODES) {
      const mapping = payload.variants[code];
      assert.equal(Object.keys(mapping).length, 8);
      assert.equal(new Set(Object.values(mapping)).size, 3);
      assert.equal(mapping['2-1/2-1/2-1'], `${code.toLowerCase()}-balance`);
      assert.equal(mapping['3-0/3-0/3-0'], `${code.toLowerCase()}-sweep`);
      for (const variantId of Object.values(mapping)) {
        assert.ok(variantId.startsWith(`${code.toLowerCase()}-`), variantId);
      }
    }
  });
});
