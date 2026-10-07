import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { graduateShare } from './education-share.js';

test('graduateShare: the larger of 修士 / 博士, never their overlapping sum', () => {
  assert.equal(graduateShare(80.5, 56.1), 80.5);
  assert.equal(graduateShare(12, 40), 40);
  assert.equal(graduateShare(0, 0), 0);
  assert.equal(graduateShare(100, 100), 100);
});
