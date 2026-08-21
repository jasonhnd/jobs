import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { GAP } from '../../site/worktype-copy.js';
import { classifyShindanGap } from '../../site/shindan-result-state.js';
import { buildWorktypeContextCopy, buildWorktypeFeatureLabel } from './worktype.js';

test('worktype OG context uses recomputed job gap copy', () => {
  const gap = classifyShindanGap('RPK', 'CDB').kind;
  const context = buildWorktypeContextCopy(gap, GAP[gap].label, {
    title: 'データ職業',
    worktypeCode: 'CDB',
    worktypeName: 'ものづくり設計家',
    score: 8.1,
  });

  assert.equal(gap, 'hidden_risk');
  assert.equal(buildWorktypeFeatureLabel('RPK'), 'AI働き方診断 / 段取りの世話役');
  assert.match(context, /データ職業 \/ ものづくり設計家/);
  assert.match(context, /働き方を更新する余地があります/);
});


