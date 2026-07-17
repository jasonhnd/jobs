import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  addShindanOccupationContext,
  buildShindanOgImageUrl,
  buildShindanResultUrl,
  classifyShindanGap,
  parseShindanBaseState,
  parseShindanResultState,
  serializeShindanState,
} from './shindan-result-state.js';

const ORIGIN = 'https://mirai-shigoto.com';

describe('shindan result-state contract', () => {
  test('round-trips multiple exact axis patterns inside the same mixed variant', () => {
    for (const axes of ['3-0/3-0/2-1', '3-0/2-1/3-0']) {
      const params = new URLSearchParams({
        self: 'CDK',
        variant: 'researcher',
        axes,
      });
      const state = parseShindanBaseState(params);
      assert.ok(state);
      assert.equal(state.axes, axes);
      assert.equal(state.bucket, 'mixed');
      assert.equal(serializeShindanState(state).get('axes'), axes);
    }
  });

  test('rejects invalid family, variant, or aggregate axis state', () => {
    const invalid = [
      'self=BAD&variant=researcher&axes=3-0%2F2-1%2F2-1',
      'self=CDK&variant=hacker&axes=3-0%2F2-1%2F2-1',
      'self=CDK&variant=researcher&axes=2-2%2F2-1%2F2-1',
      'self=CDK&variant=researcher&axes=3-0%2F2-1',
    ];
    for (const search of invalid) {
      assert.equal(parseShindanBaseState(new URLSearchParams(search)), null, search);
    }
  });

  test('recomputes a tampered gap from the selected occupation', () => {
    const params = new URLSearchParams({
      self: 'RPK',
      variant: 'mediator',
      axes: '3-0/2-1/2-1',
      job: '133',
      gap: 'aligned',
    });
    const state = parseShindanResultState(params, { '133': { code: 'CDB' } });
    assert.ok(state);
    assert.equal(state.job, '133');
    assert.equal(state.gap, 'hidden_risk');
    assert.equal(classifyShindanGap('RPK', 'CDB').riskMismatchCount, 2);
  });

  test('invalid job or gap safely falls back to the exact result-only state', () => {
    const base = parseShindanBaseState(new URLSearchParams({
      self: 'CDK',
      variant: 'researcher',
      axes: '3-0/2-1/2-1',
    }));
    assert.ok(base);

    const invalidJob = addShindanOccupationContext(
      base,
      new URLSearchParams({ job: '133x', gap: 'aligned' }),
      { '133': { code: 'CDB' } },
    );
    const invalidGap = addShindanOccupationContext(
      base,
      new URLSearchParams({ job: '133', gap: '__proto__' }),
      { '133': { code: 'CDB' } },
    );
    assert.equal(invalidJob.job, undefined);
    assert.equal(invalidGap.job, undefined);
    assert.equal(invalidJob.axes, base.axes);
    assert.equal(invalidGap.axes, base.axes);
  });

  test('result-only and result-plus-job URLs serialize one allowlisted state', () => {
    const base = {
      family: 'CDK' as const,
      variant: 'researcher' as const,
      axes: '3-0/2-1/3-0',
      bucket: 'mixed' as const,
    };
    const withJob = { ...base, job: '133', gap: 'hidden_strength' as const };

    const resultOnly = new URL(buildShindanResultUrl(ORIGIN, base));
    const resultWithJob = new URL(buildShindanResultUrl(ORIGIN, withJob));
    const imageWithJob = new URL(buildShindanOgImageUrl(ORIGIN, withJob));

    assert.equal(resultOnly.pathname, '/shindan');
    assert.equal(resultOnly.searchParams.get('axes'), base.axes);
    assert.equal(resultOnly.searchParams.has('job'), false);
    assert.equal(resultWithJob.searchParams.get('job'), '133');
    assert.equal(resultWithJob.searchParams.get('gap'), 'hidden_strength');
    assert.equal(imageWithJob.pathname, '/api/og');
    assert.equal(imageWithJob.searchParams.get('worktype'), 'CDK');
    assert.equal(imageWithJob.searchParams.get('variant'), 'researcher');
    assert.equal(imageWithJob.searchParams.get('axes'), base.axes);
    assert.equal(imageWithJob.searchParams.get('job'), '133');
    assert.equal(imageWithJob.searchParams.get('gap'), 'hidden_strength');
    assert.deepEqual(
      [...resultWithJob.searchParams.keys()],
      ['self', 'variant', 'axes', 'job', 'gap'],
    );
  });
});
