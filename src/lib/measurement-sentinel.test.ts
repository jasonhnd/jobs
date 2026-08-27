/**
 * measurement-sentinel.test.ts — pin the watchdog's pure decision
 * logic: env-presence codes, cron caller gate, canary payload contract
 * (shared with the middleware via buildMpPayload), and the redacted
 * mapping of GA4 debug-endpoint verdicts (#333).
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  authorizeCronRequest,
  buildCanaryPayload,
  evaluateDebugResponse,
  missingEnvFailures,
} from './measurement-sentinel.js';

interface CanaryShape {
  client_id: string;
  events: [{ name: string; params: Record<string, unknown> }];
}

describe('missingEnvFailures', () => {
  test('returns no failures when both env values are present', () => {
    const failures = missingEnvFailures({ measurementId: 'G-TEST', apiSecret: 's' });

    assert.deepEqual(failures, []);
  });

  test('flags each missing env value with a stable reason code', () => {
    const failures = missingEnvFailures({ measurementId: undefined, apiSecret: undefined });

    assert.deepEqual(failures, [
      'env:PUBLIC_GA4_MEASUREMENT_ID:missing',
      'env:GA4_MP_API_SECRET:missing',
    ]);
  });

  test('treats an empty string the same as a missing value', () => {
    const failures = missingEnvFailures({ measurementId: '', apiSecret: 's' });

    assert.deepEqual(failures, ['env:PUBLIC_GA4_MEASUREMENT_ID:missing']);
  });
});

describe('authorizeCronRequest', () => {
  test('fails open when no cron secret is configured', () => {
    assert.equal(authorizeCronRequest(null, undefined), true);
  });

  test('rejects a wrong bearer token when the secret is configured', () => {
    assert.equal(authorizeCronRequest('Bearer wrong', 'topsecret'), false);
  });

  test('rejects a missing header when the secret is configured', () => {
    assert.equal(authorizeCronRequest(null, 'topsecret'), false);
  });

  test('accepts the exact bearer token', () => {
    assert.equal(authorizeCronRequest('Bearer topsecret', 'topsecret'), true);
  });
});

describe('buildCanaryPayload', () => {
  test('reuses the middleware payload contract with a synthetic sentinel identity', () => {
    const payload = buildCanaryPayload('https://example.com') as CanaryShape;

    assert.equal(payload.client_id, 'sentinel.1');
    assert.equal(
      payload.events[0].params.page_location,
      'https://example.com/__measurement-sentinel',
    );
    // session_id is what makes a hit count toward a session (#253); the
    // canary must exercise the same contract production hits use.
    assert.equal(payload.events[0].params.session_id, 'sentinel-session');
    assert.equal(payload.events[0].params.client_kind, 'ai_agent');
    assert.equal(payload.events[0].params.agent_name, 'measurement-sentinel');
  });
});

describe('evaluateDebugResponse', () => {
  test('accepts a 2xx response with no validation messages', () => {
    assert.deepEqual(evaluateDebugResponse(200, { validationMessages: [] }), []);
  });

  test('flags a non-2xx status as a transport failure', () => {
    assert.deepEqual(evaluateDebugResponse(503, null), ['debug-endpoint:http-503']);
  });

  test('maps validation messages to redacted reason codes without descriptions', () => {
    const failures = evaluateDebugResponse(200, {
      validationMessages: [
        { validationCode: 'VALUE_INVALID', fieldPath: 'events', description: 'never surfaced' },
      ],
    });

    assert.deepEqual(failures, ['debug-endpoint:VALUE_INVALID:events']);
  });

  test('treats a malformed body as healthy when the status is 2xx', () => {
    assert.deepEqual(evaluateDebugResponse(200, 'not json at all'), []);
  });
});
