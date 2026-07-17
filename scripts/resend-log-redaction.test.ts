import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { inspect } from 'node:util';

import feedbackHandler from '../api/feedback.js';
import subscribeHandler from '../api/subscribe.js';

type ConsoleMethod = 'log' | 'error' | 'warn' | 'info' | 'debug';
type ConsoleEntry = { method: ConsoleMethod; args: unknown[] };

const MANAGED_ENV_KEYS = [
  'VERCEL_ENV',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'TURNSTILE_SECRET_KEY',
  'FAIL_CLOSED_ON_RATELIMIT_ERROR',
  'FAIL_CLOSED_ON_TURNSTILE_ERROR',
  'RESEND_API_KEY',
  'RESEND_AUDIENCE_ID_JA',
  'RESEND_AUDIENCE_ID_EN',
  'FEEDBACK_TO_EMAIL',
  'FEEDBACK_FROM_EMAIL',
] as const;

const SENTINELS = {
  feedbackEmail: 'feedback.sentinel@example.invalid',
  feedbackText: 'SENTINEL_FREE_TEXT_do_not_log',
  occupation: 'OCC_SENTINEL_PII',
  feedbackTo: 'operator.sentinel@example.invalid',
  feedbackFrom: 'sender.sentinel@example.invalid',
  subscriberEmail: 'subscriber.sentinel@example.invalid',
  audienceId: 'audience_SENTINEL_do_not_log',
  upstreamMessage: 'SENTINEL_UPSTREAM_MESSAGE_do_not_log',
};

async function withEnv<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of MANAGED_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const key of MANAGED_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function captureConsole<T>(run: () => Promise<T>): Promise<{ value: T; entries: ConsoleEntry[] }> {
  const entries: ConsoleEntry[] = [];
  const originals = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  console.log = (...args: unknown[]) => { entries.push({ method: 'log', args }); };
  console.error = (...args: unknown[]) => { entries.push({ method: 'error', args }); };
  console.warn = (...args: unknown[]) => { entries.push({ method: 'warn', args }); };
  console.info = (...args: unknown[]) => { entries.push({ method: 'info', args }); };
  console.debug = (...args: unknown[]) => { entries.push({ method: 'debug', args }); };

  try {
    return { value: await run(), entries };
  } finally {
    console.log = originals.log;
    console.error = originals.error;
    console.warn = originals.warn;
    console.info = originals.info;
    console.debug = originals.debug;
  }
}

async function runEndpoint<T>(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  run: () => Promise<T>,
): Promise<{ value: T; entries: ConsoleEntry[] }> {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = fetchImpl;
    return await withEnv(env, () => captureConsole(run));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertNoSentinels(entries: ConsoleEntry[], sentinels: string[]): void {
  const rendered = inspect(entries, { depth: 20, breakLength: Infinity });
  for (const sentinel of sentinels) {
    assert.equal(rendered.includes(sentinel), false, `console output leaked ${sentinel}: ${rendered}`);
  }
}

function findFailure(entries: ConsoleEntry[], prefix: string): ConsoleEntry {
  const entry = entries.find(({ args }) => args[0] === prefix);
  assert.ok(entry, `missing stable failure log ${prefix}`);
  return entry;
}

function feedbackRequest(turnstileToken?: string): Request {
  return new Request('https://mirai-shigoto.com/api/feedback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://mirai-shigoto.com',
      'user-agent': 'sentinel-test-agent',
      'x-real-ip': '203.0.113.20',
    },
    body: JSON.stringify({
      email: SENTINELS.feedbackEmail,
      options: ['data_quality'],
      freetext: SENTINELS.feedbackText,
      occupation_id: SENTINELS.occupation,
      lang: 'en',
      htmlfield: '',
      ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : {}),
    }),
  });
}

function subscribeRequest(): Request {
  return new Request('https://mirai-shigoto.com/api/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://mirai-shigoto.com',
      'x-real-ip': '203.0.113.21',
    },
    body: JSON.stringify({
      email: SENTINELS.subscriberEmail,
      lang: 'ja',
      occupation_id: '200',
      source: 'modal_t2',
      htmlfield: '',
    }),
  });
}

function resendFailureBody(): object {
  return {
    name: 'validation_error',
    message: `${SENTINELS.upstreamMessage}: ${SENTINELS.feedbackEmail} ${SENTINELS.feedbackText}`,
    recipient: SENTINELS.feedbackTo,
    sender: SENTINELS.feedbackFrom,
    contact: SENTINELS.subscriberEmail,
    audience: SENTINELS.audienceId,
  };
}

const previewFeedbackEnv = {
  VERCEL_ENV: 'preview',
  RESEND_API_KEY: 'test-resend-key',
  FEEDBACK_TO_EMAIL: SENTINELS.feedbackTo,
  FEEDBACK_FROM_EMAIL: SENTINELS.feedbackFrom,
};

const previewSubscribeEnv = {
  VERCEL_ENV: 'preview',
  RESEND_API_KEY: 'test-resend-key',
  RESEND_AUDIENCE_ID_JA: SENTINELS.audienceId,
};

describe('Resend diagnostic redaction', () => {
  test('feedback preview rejection preserves 202 payload without logging upstream or submitted PII', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify(resendFailureBody()), { status: 422 })) as typeof fetch;
    const { value: response, entries } = await runEndpoint(
      previewFeedbackEnv,
      fetchImpl,
      () => feedbackHandler(feedbackRequest()),
    );

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { ok: true, delivered: false, warn: 'delivery_failed' });
    assert.deepEqual(findFailure(entries, '[feedback] Resend failure').args, [
      '[feedback] Resend failure',
      { endpoint: 'emails', status: 422, code: 'feedback_delivery_failed' },
    ]);
    assertNoSentinels(entries, Object.values(SENTINELS));
  });

  test('feedback production rejection preserves 503 payload and stable failure metadata', async () => {
    const turnstileToken = 'test-turnstile-token';
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/pipeline')) {
        return new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 });
      }
      if (url.includes('/set/ts:')) {
        return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
      }
      if (url.includes('/turnstile/v0/siteverify')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url === 'https://api.resend.com/emails') {
        return new Response(JSON.stringify(resendFailureBody()), { status: 422 });
      }
      throw new Error(`unexpected test URL: ${url}`);
    }) as typeof fetch;
    const { value: response, entries } = await runEndpoint(
      {
        ...previewFeedbackEnv,
        VERCEL_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://sentinel-test.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'test-upstash-token',
        TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
      },
      fetchImpl,
      () => feedbackHandler(feedbackRequest(turnstileToken)),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'feedback_delivery_failed',
      warn: 'delivery_failed',
    });
    assert.deepEqual(findFailure(entries, '[feedback] Resend failure').args[1], {
      endpoint: 'emails',
      status: 422,
      code: 'feedback_delivery_failed',
    });
    assertNoSentinels(entries, Object.values(SENTINELS));
  });

  test('feedback fetch exception does not log the thrown message or submitted PII', async () => {
    const fetchImpl = (async () => {
      throw new Error(`${SENTINELS.upstreamMessage}: ${SENTINELS.feedbackEmail} ${SENTINELS.feedbackText}`);
    }) as typeof fetch;
    const { value: response, entries } = await runEndpoint(
      previewFeedbackEnv,
      fetchImpl,
      () => feedbackHandler(feedbackRequest()),
    );

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { ok: true, delivered: false, warn: 'delivery_error' });
    assert.deepEqual(findFailure(entries, '[feedback] Resend failure').args[1], {
      endpoint: 'emails',
      status: null,
      code: 'feedback_delivery_failed',
    });
    assertNoSentinels(entries, Object.values(SENTINELS));
  });

  test('newsletter rejection preserves 502 payload without logging contact or upstream detail', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify(resendFailureBody()), { status: 422 })) as typeof fetch;
    const { value: response, entries } = await runEndpoint(
      previewSubscribeEnv,
      fetchImpl,
      () => subscribeHandler(subscribeRequest()),
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'subscribe_failed' });
    assert.deepEqual(findFailure(entries, '[subscribe] Resend failure').args, [
      '[subscribe] Resend failure',
      { endpoint: 'contacts', status: 422, code: 'subscribe_failed' },
    ]);
    assertNoSentinels(entries, Object.values(SENTINELS));
  });

  test('newsletter still parses duplicate detail in memory without logging it', async () => {
    const duplicateBody = {
      name: 'validation_error',
      message: `contact already exists: ${SENTINELS.subscriberEmail} ${SENTINELS.upstreamMessage}`,
    };
    const fetchImpl = (async () => new Response(JSON.stringify(duplicateBody), { status: 422 })) as typeof fetch;
    const { value: response, entries } = await runEndpoint(
      previewSubscribeEnv,
      fetchImpl,
      () => subscribeHandler(subscribeRequest()),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, alreadySubscribed: true });
    assert.deepEqual(entries, []);
    assertNoSentinels(entries, [SENTINELS.subscriberEmail, SENTINELS.upstreamMessage]);
  });

  test('newsletter fetch exception preserves 500 payload without logging the thrown message', async () => {
    const fetchImpl = (async () => {
      throw new Error(`${SENTINELS.upstreamMessage}: ${SENTINELS.subscriberEmail}`);
    }) as typeof fetch;
    const { value: response, entries } = await runEndpoint(
      previewSubscribeEnv,
      fetchImpl,
      () => subscribeHandler(subscribeRequest()),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error' });
    assert.deepEqual(findFailure(entries, '[subscribe] Resend failure').args[1], {
      endpoint: 'contacts',
      status: null,
      code: 'server_error',
    });
    assertNoSentinels(entries, Object.values(SENTINELS));
  });
});
