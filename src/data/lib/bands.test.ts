/**
 * Unit tests for bands.ts.
 * Run with `npm test` (uses node --test via tsx).
 *
 * Boundary values match scripts/lib/bands.py constants exactly.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { riskBand, workforceBand, demandBand } from './bands.js';

test('riskBand: null/undefined returns null', () => {
  assert.equal(riskBand(null), null);
  assert.equal(riskBand(undefined), null);
});

test('riskBand: low boundary (0.0–3.9)', () => {
  assert.equal(riskBand(0), 'low');
  assert.equal(riskBand(3.9), 'low');
});

test('riskBand: mid boundary (4.0–6.9)', () => {
  assert.equal(riskBand(4.0), 'mid');
  assert.equal(riskBand(5), 'mid');
  assert.equal(riskBand(6.9), 'mid');
});

test('riskBand: high boundary (7.0–10)', () => {
  assert.equal(riskBand(7.0), 'high');
  assert.equal(riskBand(10), 'high');
});

test('workforceBand: null/undefined returns null', () => {
  assert.equal(workforceBand(null), null);
  assert.equal(workforceBand(undefined), null);
});

test('workforceBand: small (< 20,000)', () => {
  assert.equal(workforceBand(0), 'small');
  assert.equal(workforceBand(19_999), 'small');
});

test('workforceBand: mid (20,000–99,999)', () => {
  assert.equal(workforceBand(20_000), 'mid');
  assert.equal(workforceBand(50_000), 'mid');
  assert.equal(workforceBand(99_999), 'mid');
});

test('workforceBand: large (≥ 100,000)', () => {
  assert.equal(workforceBand(100_000), 'large');
  assert.equal(workforceBand(1_000_000), 'large');
});

test('demandBand: null/undefined returns null', () => {
  assert.equal(demandBand(null), null);
  assert.equal(demandBand(undefined), null);
});

test('demandBand: cold (< 1.0)', () => {
  assert.equal(demandBand(0), 'cold');
  assert.equal(demandBand(0.99), 'cold');
});

test('demandBand: normal (1.0–1.99)', () => {
  assert.equal(demandBand(1.0), 'normal');
  assert.equal(demandBand(1.5), 'normal');
  assert.equal(demandBand(1.99), 'normal');
});

test('demandBand: hot (≥ 2.0)', () => {
  assert.equal(demandBand(2.0), 'hot');
  assert.equal(demandBand(5.0), 'hot');
});
