/**
 * Guards the framing of the family rarity figure (issue #235).
 *
 * The figure is the share of the 556 scored **occupations** whose AIOIS-derived
 * profile lands in a family. It is shown on the /shindan result immediately
 * after nine questions about the visitor's own preferences, where a bare
 * percentage reads as "only X% of people are like me". The site holds no user
 * distribution at all — results are never sent to a server — so that reading is
 * not merely imprecise, it describes data that does not exist.
 *
 * These assert the properties that keep the sentence honest, not its exact
 * wording, so the copy can still be revised.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { RARITY } from './worktype-copy.js';

describe('family rarity copy', () => {
  test('states the unit as occupations, so the figure cannot read as people', () => {
    for (const [key, text] of Object.entries(RARITY)) {
      assert.match(
        text,
        /職/,
        `RARITY.${key} must name occupations as the unit being counted: ${text}`,
      );
    }
  });

  test('leads with a count rather than a bare percentage', () => {
    const { familyTemplate } = RARITY;
    assert.ok(
      familyTemplate.includes('{件数}'),
      'the occupation count must appear — a percentage alone is what invited the misreading',
    );
    assert.ok(
      familyTemplate.indexOf('{件数}') < familyTemplate.indexOf('{割合}'),
      'the count must come before the percentage so the unit is established first',
    );
  });

  test('sets the occupation-data frame before any figure', () => {
    const { familyTemplate } = RARITY;
    const frame = familyTemplate.indexOf('職業データ');
    assert.ok(frame >= 0, 'the sentence must say the figure comes from the occupation data');
    assert.ok(
      frame < familyTemplate.indexOf('{件数}'),
      'the frame must precede the number, not trail it as a qualifier',
    );
  });

  test('never claims a share of people', () => {
    for (const [key, text] of Object.entries(RARITY)) {
      for (const banned of ['人の', '人が', 'あなたと同じ', '受けた人']) {
        assert.ok(
          !text.includes(banned),
          `RARITY.${key} must not describe a population of people (found "${banned}"): ${text}`,
        );
      }
    }
  });
});
