import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  CONSENSUS_AGING_NOTE,
  CONSENSUS_HEADLINE_LABEL,
  LATEST_OBSERVATION_THRESHOLD,
  formatLatestObservationLine,
} from './consensus-copy.js';

describe('formatLatestObservationLine', () => {
  test('omits the row when |Δ| is below the locked threshold', () => {
    assert.equal(formatLatestObservationLine(5.0, 0.9), null);
    assert.equal(formatLatestObservationLine(5.0, -0.99), null);
  });

  test('shows 大きく when latest is above consensus by the threshold', () => {
    assert.equal(
      formatLatestObservationLine(6.8, 2.55),
      '最新のAIは、この仕事の変化をより大きく見ています（6.8）',
    );
    assert.equal(LATEST_OBSERVATION_THRESHOLD, 1.0);
  });

  test('shows 小さく when latest is below consensus by the threshold', () => {
    assert.equal(
      formatLatestObservationLine(3.4, -1.0),
      '最新のAIは、この仕事の変化をより小さく見ています（3.4）',
    );
  });

  test('locked headline and aging strings are verbatim', () => {
    assert.equal(CONSENSUS_HEADLINE_LABEL, '複数のAIによる総合');
    assert.equal(
      CONSENSUS_AGING_NOTE,
      'この総合値には、採点日から6ヶ月を超えた票が含まれています。',
    );
  });
});
