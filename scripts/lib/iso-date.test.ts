import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { isRealIsoDate } from './iso-date.js';

test('accepts real zero-padded calendar days', () => {
  for (const d of ['2026-10-01', '2026-10-10', '2024-02-29', '2000-02-29', '1999-12-31']) {
    assert.equal(isRealIsoDate(d), true, d);
  }
});

test('rejects malformed or impossible dates', () => {
  for (const d of [
    'not-a-date',
    '2026-10-7',
    '2026-9-30',
    '26-10-07',
    '2026/10/07',
    '2026-10-07T00:00:00Z',
    ' 2026-10-07',
    '2026-02-30',
    '2025-02-29',
    '1900-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-04-31',
    '',
  ]) {
    assert.equal(isRealIsoDate(d), false, d);
  }
});
