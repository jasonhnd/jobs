import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatPeopleJa, formatPeopleJaText, formatShareJa, roundSignificant } from './haid-release-format.js';

describe('HAID release number formatting', () => {
  test('significant-figure rounding', () => {
    assert.equal(roundSignificant(8_300_000_000, 1), 8_000_000_000);
    assert.equal(roundSignificant(8_300_000_000, 2), 8_300_000_000);
    assert.equal(roundSignificant(1_520_000_000, 1), 2_000_000_000);
    assert.equal(roundSignificant(1_520_000_000, 2), 1_500_000_000);
    assert.equal(roundSignificant(34_000_000, 2), 34_000_000);
    assert.equal(roundSignificant(0, 1), 0);
  });

  test('億 / 万 units with the unit split off', () => {
    assert.deepEqual(formatPeopleJa(8_300_000_000, 2), { value: '83', unit: '億' });
    assert.deepEqual(formatPeopleJa(1_520_000_000, 1), { value: '20', unit: '億' });
    assert.deepEqual(formatPeopleJa(1_520_000_000, 2), { value: '15', unit: '億' });
    assert.deepEqual(formatPeopleJa(480_000_000, 2), { value: '4.8', unit: '億' });
    assert.deepEqual(formatPeopleJa(34_000_000, 2), { value: '3,400', unit: '万' });
    assert.deepEqual(formatPeopleJa(766_000_000, 2), { value: '7.7', unit: '億' });
    assert.deepEqual(formatPeopleJa(1_234, 2), { value: '1,200', unit: '人' });
    assert.equal(formatPeopleJaText(34_000_000, 2), '3,400 万');
    assert.equal(formatPeopleJaText(950, 2), '950 人');
  });

  test('shares', () => {
    assert.equal(formatShareJa(0.265), '27%');
    assert.equal(formatShareJa(0.004), '0.4%');
    assert.equal(formatShareJa(0.0096), '1.0%');
  });
});
