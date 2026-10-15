import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { EDU } from '../data/domain/distribution-labels.js';
import { gradPct } from './ranking/utilities.js';
import type { Occupation } from './ranking/config.js';

test('ranking gradPct stays within 100% on multi-answer data (院卒 137% case, #863)', () => {
  const occ = { education_pct: { [EDU.masters]: 80.5, [EDU.doctorate]: 56.1 } } as unknown as Occupation;
  assert.equal(gradPct(occ), 80.5);
  assert.equal(gradPct({ education_pct: null } as unknown as Occupation), 0);
});
