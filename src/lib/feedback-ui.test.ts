import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { KNOWN_OPTIONS, MAX_FREETEXT_LEN } from './feedback-helpers.js';
import {
  FEEDBACK_OPTIONS,
  buildFeedbackAnalytics,
  buildFeedbackPayload,
  feedbackOutcomeForResponse,
  feedbackStatusMessage,
  occupationIdFromPathname,
} from './feedback-ui.ts';

describe('feedback form option contract', () => {
  test('renders every backend allow-listed key exactly once with a Japanese label', () => {
    assert.deepEqual(FEEDBACK_OPTIONS.map(({ key }) => key), Array.from(KNOWN_OPTIONS));
    assert.equal(new Set(FEEDBACK_OPTIONS.map(({ key }) => key)).size, KNOWN_OPTIONS.size);
    for (const option of FEEDBACK_OPTIONS) assert.notEqual(option.label, option.key);
  });
});

describe('buildFeedbackPayload', () => {
  test('filters and deduplicates options while forwarding all endpoint fields', () => {
    assert.deepEqual(buildFeedbackPayload({
      selectedOptions: ['b2c_career', 'unknown', 'b2c_career', 'data_quality'],
      freetext: '  本文は保持  ',
      email: '  User@Example.com  ',
      htmlfield: '',
      turnstileToken: 'turnstile-token',
      pathname: '/ja/156',
    }), {
      email: 'User@Example.com',
      options: ['b2c_career', 'data_quality'],
      freetext: '  本文は保持  ',
      occupation_id: '156',
      lang: 'ja',
      htmlfield: '',
      'cf-turnstile-response': 'turnstile-token',
    });
  });

  test('clips free text to the backend limit and uses null for optional fields', () => {
    const payload = buildFeedbackPayload({
      selectedOptions: ['other'],
      freetext: 'x'.repeat(MAX_FREETEXT_LEN + 5),
      pathname: '/models',
    });
    assert.equal(payload.freetext.length, MAX_FREETEXT_LEN);
    assert.equal(payload.email, null);
    assert.equal(payload.occupation_id, null);
    assert.equal(payload['cf-turnstile-response'], '');
  });
});

describe('occupationIdFromPathname', () => {
  test('supports current and legacy occupation page shapes without matching hubs', () => {
    assert.equal(occupationIdFromPathname('/156'), '156');
    assert.equal(occupationIdFromPathname('/ja/156'), '156');
    assert.equal(occupationIdFromPathname('/occupations/404'), '404');
    assert.equal(occupationIdFromPathname('/ja/occupations/404'), '404');
    assert.equal(occupationIdFromPathname('/models'), null);
    assert.equal(occupationIdFromPathname('/rankings/ai-risk-high'), null);
  });
});

describe('feedback response and status mapping', () => {
  test('maps delivered success and every required failure family', () => {
    assert.deepEqual(feedbackOutcomeForResponse(200, { ok: true, delivered: true }), {
      success: true,
      errorCode: 'none',
    });
    assert.deepEqual(feedbackOutcomeForResponse(503, {
      ok: false,
      error: 'feedback_delivery_failed',
      warn: 'config_missing',
    }), { success: false, errorCode: 'feedback_delivery_failed' });
    assert.deepEqual(feedbackOutcomeForResponse(202, {
      ok: true,
      delivered: false,
      warn: 'config_missing',
    }), { success: false, errorCode: 'config_missing' });
    assert.deepEqual(feedbackOutcomeForResponse(429, { error: 'rate_limited' }), {
      success: false,
      errorCode: 'rate_limited',
    });
    assert.deepEqual(feedbackOutcomeForResponse(0, null), {
      success: false,
      errorCode: 'network_error',
    });
  });

  test('provides explicit loading, validation, delivery, retry, and success copy', () => {
    assert.match(feedbackStatusMessage('pending'), /送信中/);
    assert.match(feedbackStatusMessage('validation-error', 'empty_feedback'), /1つ以上/);
    assert.match(feedbackStatusMessage('error', 'feedback_delivery_failed'), /配信に失敗/);
    assert.match(feedbackStatusMessage('error', 'rate_limited'), /しばらく待って/);
    assert.match(feedbackStatusMessage('success'), /ありがとうございます/);
  });
});

describe('buildFeedbackAnalytics', () => {
  test('projects only documented non-PII fields', () => {
    const payload = buildFeedbackPayload({
      selectedOptions: ['b2c_career', 'other'],
      freetext: '秘密の本文',
      email: 'private@example.com',
      pathname: '/156',
    });
    const analytics = buildFeedbackAnalytics(payload, {
      success: false,
      errorCode: 'feedback_delivery_failed',
    });

    assert.deepEqual(analytics, {
      selected_options: 'b2c_career,other',
      freetext_length: 5,
      has_email: 'true',
      language: 'ja',
      success: 'false',
      error_reason: 'feedback_delivery_failed',
    });
    assert.equal(JSON.stringify(analytics).includes('private@example.com'), false);
    assert.equal(JSON.stringify(analytics).includes('秘密の本文'), false);
  });
});
