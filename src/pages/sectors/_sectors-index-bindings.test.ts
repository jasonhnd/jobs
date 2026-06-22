import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  fmtInt as sectorsIndexFmtInt,
  riskClass as sectorsIndexRiskClass,
} from './_sectors-index-bindings.js';
import { fmtInt } from '@/lib/num';
import { riskClass } from '@/lib/risk';

describe('sectors index helpers', () => {
  test('re-exports canonical fmtInt', () => {
    assert.equal(sectorsIndexFmtInt(12_345.9), '12,345');
    assert.equal(sectorsIndexFmtInt(null), '—');
    assert.equal(sectorsIndexFmtInt(undefined), fmtInt(undefined));
  });

  test('re-exports canonical riskClass boundary behavior', () => {
    for (const score of [3.5, 3.95, 4.0, 6.5, 6.95, 7.0]) {
      assert.equal(sectorsIndexRiskClass(score), riskClass(score));
    }
  });
});
