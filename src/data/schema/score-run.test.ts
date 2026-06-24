import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Aiois10Schema } from './score-run.js';

const baseAiois = {
  d1: 4.8,
  d2: 4.4,
  d3: 5.0,
  d4: 6.5,
  d5: 5.8,
  d6: 3.0,
  d7: 4.2,
  d8: 3.6,
  d9: 2.8,
  d10: 3.5,
  transformation: 4.6,
  displacement: 1.7,
};

describe('Aiois10Schema', () => {
  test('accepts one-decimal transformation within the ±0.05 index tolerance', () => {
    // Arrange: mean(1.2, 3.5) = 2.35, stored as one decimal.
    const roundedUp = { ...baseAiois, d1: 1.2, d2: 3.5, transformation: 2.4 };
    const roundedDown = { ...baseAiois, d1: 1.2, d2: 3.5, transformation: 2.3 };

    // Act / Assert
    assert.equal(Aiois10Schema.safeParse(roundedUp).success, true);
    assert.equal(Aiois10Schema.safeParse(roundedDown).success, true);
  });

  test('rejects transformation that drifts beyond the index tolerance', () => {
    // Arrange
    const invalid = { ...baseAiois, d1: 1.2, d2: 3.5, transformation: 2.5 };

    // Act
    const parsed = Aiois10Schema.safeParse(invalid);

    // Assert
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.deepEqual(parsed.error.issues[0]?.path, ['transformation']);
    }
  });
});
