import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { topN } from './detail.js';
import type { LabelEntry } from '../schema/labels.js';

function label(ja: string): LabelEntry {
  return { ja, en: ja };
}

describe('topN', () => {
  test('returns null for nullish blocks', () => {
    assert.equal(topN(null, new Map(), 3), null);
    assert.equal(topN(undefined, new Map(), 3), null);
  });

  test('sorts by score descending, breaks ties by key, labels entries, and slices', () => {
    const labels = new Map<string, LabelEntry>([
      ['a_key', label('A label')],
      ['c_key', label('C label')],
    ]);

    assert.deepEqual(
      topN(
        {
          z_key: 1,
          c_key: 3,
          a_key: 3,
          b_key: 2,
        },
        labels,
        3,
      ),
      [
        { key: 'a_key', label_ja: 'A label', score: 3 },
        { key: 'c_key', label_ja: 'C label', score: 3 },
        { key: 'b_key', label_ja: 'b_key', score: 2 },
      ],
    );
  });
});
