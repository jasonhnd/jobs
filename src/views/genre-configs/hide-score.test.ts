import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { LIFE_BALANCE_CONFIGS } from './life-balance.js';
import { ENTRY_PATHS_CONFIGS } from './entry-paths.js';
import { WORK_STYLES_CONFIGS } from './work-styles.js';
import { EMPLOYMENT_CONFIGS } from './employment.js';

// These custom filters return a sort key (−hours, age, workforce, cert count,
// a constant 1…), not a score worth printing (#884: 「育児両立スコア -141.00」).
test('hubs whose custom_filter returns a sort key set hide_score', () => {
  const hidden = [
    ...LIFE_BALANCE_CONFIGS,
    ...ENTRY_PATHS_CONFIGS,
    ...WORK_STYLES_CONFIGS.filter((c) => c.slug === 'shift-work'),
    ...EMPLOYMENT_CONFIGS.filter((c) => c.slug === 'public-employee'),
  ];
  assert.equal(hidden.length, 6 + 5 + 1 + 1);
  for (const c of hidden) assert.equal(c.hide_score, true, c.slug);
});

test('dimension-based hubs keep their score', () => {
  for (const c of WORK_STYLES_CONFIGS.filter((c) => c.dimension_field)) assert.notEqual(c.hide_score, true, c.slug);
});
