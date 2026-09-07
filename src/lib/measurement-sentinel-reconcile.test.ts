/**
 * measurement-sentinel-reconcile.test.ts — pin phase 2's pure surface:
 * JST date math, the runReport request shape, count parsing (GA4 omits
 * zero-event ranges), the stateless verdict rules, and env reason codes
 * (#334).
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildRunReportBody,
  buildStsBody,
  jstDate,
  missingReconcileEnvFailures,
  parseReconcileCounts,
  RECONCILE_MIN_BASELINE,
  reconcileVerdict,
} from './measurement-sentinel-reconcile.js';

describe('jstDate', () => {
  test('computes JST calendar dates across the UTC midnight boundary', () => {
    // 22:17 UTC on the 27th is already 07:17 JST on the 28th.
    const cronMoment = new Date('2026-08-27T22:17:00Z');

    assert.equal(jstDate(0, cronMoment), '2026-08-28');
    assert.equal(jstDate(1, cronMoment), '2026-08-27');
    assert.equal(jstDate(2, cronMoment), '2026-08-26');
  });

  test('crosses month boundaries correctly', () => {
    assert.equal(jstDate(1, new Date('2026-08-31T22:17:00Z')), '2026-08-31');
    assert.equal(jstDate(2, new Date('2026-08-31T22:17:00Z')), '2026-08-30');
  });
});

describe('buildRunReportBody', () => {
  test('queries page_delivery eventCount over two named single-day ranges', () => {
    const body = buildRunReportBody(new Date('2026-08-27T22:17:00Z')) as {
      dateRanges: Array<{ startDate: string; endDate: string; name: string }>;
      metrics: Array<{ name: string }>;
      dimensionFilter: { filter: { fieldName: string; stringFilter: { value: string } } };
    };

    assert.deepEqual(body.dateRanges, [
      { startDate: '2026-08-27', endDate: '2026-08-27', name: 'yesterday' },
      { startDate: '2026-08-26', endDate: '2026-08-26', name: 'dayBefore' },
    ]);
    assert.deepEqual(body.metrics, [{ name: 'eventCount' }]);
    assert.equal(body.dimensionFilter.filter.fieldName, 'eventName');
    assert.equal(body.dimensionFilter.filter.stringFilter.value, 'page_delivery');
  });
});

describe('buildStsBody', () => {
  test('emits the RFC 8693 token-exchange fields', () => {
    const params = new URLSearchParams(buildStsBody('//iam.googleapis.com/projects/1/x', 'jwt-here'));

    assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:token-exchange');
    assert.equal(params.get('audience'), '//iam.googleapis.com/projects/1/x');
    assert.equal(params.get('subject_token'), 'jwt-here');
    assert.equal(params.get('subject_token_type'), 'urn:ietf:params:oauth:token-type:jwt');
  });
});

describe('parseReconcileCounts', () => {
  test('reads counts from rows tagged with the range names', () => {
    const counts = parseReconcileCounts({
      rows: [
        { dimensionValues: [{ value: 'yesterday' }], metricValues: [{ value: '812' }] },
        { dimensionValues: [{ value: 'dayBefore' }], metricValues: [{ value: '790' }] },
      ],
    });

    assert.deepEqual(counts, { yesterday: 812, dayBefore: 790 });
  });

  test('treats an absent rows array as two zero-event days, not a shape error', () => {
    // GA4 omits rows for ranges with zero events.
    assert.deepEqual(parseReconcileCounts({}), { yesterday: 0, dayBefore: 0 });
  });

  test('defaults a single missing range to zero', () => {
    const counts = parseReconcileCounts({
      rows: [{ dimensionValues: [{ value: 'dayBefore' }], metricValues: [{ value: '640' }] }],
    });

    assert.deepEqual(counts, { yesterday: 0, dayBefore: 640 });
  });

  test('returns null only for a structurally alien body', () => {
    assert.equal(parseReconcileCounts(null), null);
    assert.equal(parseReconcileCounts('nope'), null);
    assert.equal(parseReconcileCounts({ rows: 'not-an-array' }), null);
  });
});

describe('reconcileVerdict', () => {
  test('zero deliveries yesterday is always an incident', () => {
    assert.deepEqual(reconcileVerdict({ yesterday: 0, dayBefore: 700 }), [
      'reconcile:zero-deliveries(dayBefore=700)',
    ]);
  });

  test('a >60% collapse above the baseline is an incident', () => {
    assert.deepEqual(reconcileVerdict({ yesterday: 100, dayBefore: 500 }), [
      'reconcile:drop-gt-60pct(yesterday=100,dayBefore=500)',
    ]);
  });

  test('the same relative swing below the baseline is noise, not an incident', () => {
    assert.ok(RECONCILE_MIN_BASELINE > 10);
    assert.deepEqual(reconcileVerdict({ yesterday: 2, dayBefore: 10 }), []);
  });

  test('steady traffic is healthy', () => {
    assert.deepEqual(reconcileVerdict({ yesterday: 700, dayBefore: 750 }), []);
  });
});

describe('missingReconcileEnvFailures', () => {
  test('flags each missing env value with a stable reason code', () => {
    assert.deepEqual(
      missingReconcileEnvFailures({ wifAudience: undefined, saEmail: undefined, propertyId: undefined }),
      [
        'phase2-env:GCP_WIF_AUDIENCE:missing',
        'phase2-env:GCP_SA_EMAIL:missing',
        'phase2-env:GA4_PROPERTY_ID:missing',
      ],
    );
  });

  test('returns no failures when fully configured', () => {
    assert.deepEqual(
      missingReconcileEnvFailures({ wifAudience: 'a', saEmail: 'b', propertyId: 'c' }),
      [],
    );
  });
});
