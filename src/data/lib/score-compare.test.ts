import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { displayTenths, scoreUnits } from './score-compare.js';

test('scoreUnits: FP residue on a one-decimal boundary compares equal', () => {
  assert.equal(scoreUnits(Math.abs(2.3 - 2.6)), scoreUnits(0.3));
  assert.equal(scoreUnits(1.7 - 0.7000000000000001), scoreUnits(1.0));
});

test('scoreUnits: genuine differences of a 3-vote mean stay distinct', () => {
  assert.ok(scoreUnits(0.3 + 1 / 30) > scoreUnits(0.3));
  assert.ok(scoreUnits(0.3 - 1 / 30) < scoreUnits(0.3));
});

test('displayTenths: unrounded means map to the tenths the site prints', () => {
  assert.equal(displayTenths(3.9666666666666663), 40);
  assert.equal(displayTenths(4.966666666666667), 50);
  assert.equal(displayTenths(6.966666666666667), 70);
  assert.equal(displayTenths(4.0333333333333), 40);
  assert.equal(displayTenths(0.7), 7);
});
