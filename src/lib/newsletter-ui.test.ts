import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  NEWSLETTER_SOURCE,
  MAX_TURNSTILE_TOKEN_LEN,
  buildNewsletterAnalytics,
  buildNewsletterPayload,
  isValidNewsletterEmail,
  newsletterOccupationIdFromPathname,
  newsletterOutcomeForResponse,
  newsletterStatusMessage,
} from './newsletter-ui.ts';

describe('newsletter payload contract', () => {
  test('normalizes email and forwards the complete subscribe contract', () => {
    assert.deepEqual(buildNewsletterPayload({
      email: '  Private+Report@Example.COM  ',
      htmlfield: '',
      turnstileToken: 'turnstile-token',
      pathname: '/ja/156',
    }), {
      email: 'private+report@example.com',
      lang: 'ja',
      occupation_id: '156',
      source: NEWSLETTER_SOURCE,
      htmlfield: '',
      'cf-turnstile-response': 'turnstile-token',
    });
  });

  test('extracts canonical occupation routes and leaves generic pages untagged', () => {
    assert.equal(newsletterOccupationIdFromPathname('/156'), '156');
    assert.equal(newsletterOccupationIdFromPathname('/156-example'), '156');
    assert.equal(newsletterOccupationIdFromPathname('/ja/156'), '156');
    assert.equal(newsletterOccupationIdFromPathname('/occupations/404'), '404');
    assert.equal(newsletterOccupationIdFromPathname('/ja/occupations/404'), '404');
    assert.equal(newsletterOccupationIdFromPathname('/models'), '');
  });

  test('mirrors the endpoint email validation boundaries', () => {
    assert.equal(isValidNewsletterEmail('person@example.com'), true);
    assert.equal(isValidNewsletterEmail('  person@example.com  '), true);
    assert.equal(isValidNewsletterEmail(''), false);
    assert.equal(isValidNewsletterEmail('not-an-email'), false);
    assert.equal(isValidNewsletterEmail(`${'x'.repeat(245)}@example.com`), false);
  });

  test('keeps the largest valid UTF-8 payload below the streaming body cap', () => {
    const payload = buildNewsletterPayload({
      email: `${'界'.repeat(240)}@x.jp`,
      turnstileToken: 't'.repeat(MAX_TURNSTILE_TOKEN_LEN),
      pathname: '/occupations/404',
    });
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;

    assert.equal(payload['cf-turnstile-response'].length, MAX_TURNSTILE_TOKEN_LEN);
    assert.ok(bytes <= 4 * 1024, `newsletter payload is ${bytes} bytes`);
  });
});

describe('newsletter response and status mapping', () => {
  test('recognizes new and idempotent success responses', () => {
    assert.deepEqual(newsletterOutcomeForResponse(200, { ok: true }), {
      success: true,
      errorCode: 'none',
    });
    assert.deepEqual(newsletterOutcomeForResponse(200, {
      ok: true,
      alreadySubscribed: true,
    }), {
      success: true,
      errorCode: 'none',
    });
  });

  test('preserves stable API errors and rejects ambiguous 2xx bodies', () => {
    assert.deepEqual(newsletterOutcomeForResponse(502, { error: 'subscribe_failed' }), {
      success: false,
      errorCode: 'subscribe_failed',
    });
    assert.deepEqual(newsletterOutcomeForResponse(429, { error: 'rate_limited' }), {
      success: false,
      errorCode: 'rate_limited',
    });
    assert.deepEqual(newsletterOutcomeForResponse(200, null), {
      success: false,
      errorCode: 'http_200',
    });
    assert.deepEqual(newsletterOutcomeForResponse(0, null), {
      success: false,
      errorCode: 'network_error',
    });
  });

  test('provides loading, validation, delivery, retry, security, and success copy', () => {
    assert.match(newsletterStatusMessage('pending'), /登録中/);
    assert.match(newsletterStatusMessage('validation-error', 'invalid_email'), /形式/);
    assert.match(newsletterStatusMessage('error', 'subscribe_failed'), /登録は完了していません/);
    assert.match(newsletterStatusMessage('error', 'rate_limited'), /しばらく待って/);
    assert.match(newsletterStatusMessage('error', 'turnstile_failed'), /セキュリティ確認/);
    assert.match(newsletterStatusMessage('success'), /登録を受け付けました/);
  });
});

describe('newsletter analytics projection', () => {
  test('contains only the documented non-PII fields', () => {
    const analytics = buildNewsletterAnalytics({
      success: false,
      errorCode: 'subscribe_failed',
    });

    assert.deepEqual(analytics, {
      language: 'ja',
      success: 'false',
      error_reason: 'subscribe_failed',
    });
    assert.equal(JSON.stringify(analytics).includes('private@example.com'), false);
    assert.deepEqual(Object.keys(analytics).sort(), ['error_reason', 'language', 'success']);
  });

  test('caps server-provided error codes at the GA4 value limit', () => {
    const analytics = buildNewsletterAnalytics({
      success: false,
      errorCode: 'x'.repeat(160),
    });
    assert.equal(analytics.error_reason.length, 100);
  });
});
