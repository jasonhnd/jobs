/**
 * occupation-display.test.ts — pin the stat-cell formatters.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildOccupationDisplay,
  type OccupationDisplayInput,
} from './occupation-display.js';

const baseInput: OccupationDisplayInput = {
  aiRisk: null,
  salaryMan: null,
  workers: null,
  age: null,
  hours: null,
  recruitRatio: null,
  hourlyWage: null,
};

describe('buildOccupationDisplay', () => {
  test('all-null input → every field is em-dash', () => {
    const out = buildOccupationDisplay(baseInput);
    assert.equal(out.riskStr, '—');
    assert.equal(out.riskClass, 'risk-na');
    assert.equal(out.riskNumDisp, '—');
    assert.equal(out.salaryInt, '—');
    assert.equal(out.ageDisp, '—');
    assert.equal(out.hoursDisp, '—');
    assert.equal(out.recruitDisp, '—');
    assert.equal(out.hourlyDisp, '—');
    assert.equal(out.workersCell, '—');
    assert.equal(out.ageCell, '—');
    assert.equal(out.hoursCell, '—');
    assert.equal(out.salaryCell, '—'); // 2026-05-17 H2 fix: was '—（— 万円）' double-fallback
  });

  test('aiRisk: numeric → "N/10" + class "risk-N"', () => {
    const out = buildOccupationDisplay({ ...baseInput, aiRisk: 7 });
    assert.equal(out.riskStr, '7/10');
    assert.equal(out.riskClass, 'risk-7');
    assert.equal(out.riskNumDisp, 7);
  });

  test('aiRisk = 0 still treated as numeric (not falsy)', () => {
    const out = buildOccupationDisplay({ ...baseInput, aiRisk: 0 });
    assert.equal(out.riskStr, '0/10');
    assert.equal(out.riskClass, 'risk-0');
    assert.equal(out.riskNumDisp, 0);
  });

  test('salary: 540 万円 → cell "¥5,400,000（540 万円）"', () => {
    const out = buildOccupationDisplay({ ...baseInput, salaryMan: 540 });
    assert.equal(out.salaryInt, 540);
    assert.equal(out.salaryCell, '¥5,400,000（540 万円）');
  });

  test('salary truncates fractional 万円 to integer for the inline label', () => {
    const out = buildOccupationDisplay({ ...baseInput, salaryMan: 540.7 });
    assert.equal(out.salaryInt, 540);
    // ¥(Math.trunc(540.7 * 10000)) = ¥5,407,000
    assert.equal(out.salaryCell, '¥5,407,000（540 万円）');
  });

  test('workers: 1,234,567 → "1,234,567 人"', () => {
    const out = buildOccupationDisplay({ ...baseInput, workers: 1_234_567 });
    assert.equal(out.workersCell, '1,234,567 人');
  });

  test('age: 42 → "42 歳"', () => {
    const out = buildOccupationDisplay({ ...baseInput, age: 42 });
    assert.equal(out.ageCell, '42 歳');
    assert.equal(out.ageDisp, 42);
  });

  test('hours: 165 → "165 時間/月"; fractional truncates', () => {
    const out = buildOccupationDisplay({ ...baseInput, hours: 165.7 });
    assert.equal(out.hoursDisp, 165);
    assert.equal(out.hoursCell, '165 時間/月');
  });

  test('recruitRatio: 2.5 → bare number; null/undefined → em-dash', () => {
    const out = buildOccupationDisplay({ ...baseInput, recruitRatio: 2.5 });
    assert.equal(out.recruitDisp, 2.5);
    const naOut = buildOccupationDisplay({ ...baseInput, recruitRatio: null });
    assert.equal(naOut.recruitDisp, '—');
  });

  test('hourlyWage: 1500 → "¥1,500"', () => {
    const out = buildOccupationDisplay({ ...baseInput, hourlyWage: 1500 });
    assert.equal(out.hourlyDisp, '¥1,500');
  });
});
