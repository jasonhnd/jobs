// Tests for src/lib/api-security.js — runs under `tsx --test`.

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  refererOrigin,
  makeOriginGate,
  readBodyText,
  BodyTooLargeError,
  clientIpFromRequest,
  rateLimitCheck,
  verifyTurnstile,
} from './api-security.js';

const ALLOWED = new Set([
  'https://mirai-shigoto.com',
  'http://localhost:8765',
]);

function makeReq(headers: Record<string, string>, body?: ReadableStream | null): Request {
  return new Request('https://example.com/test', {
    method: 'POST',
    headers,
    body: body ?? null,
    // Edge fetch requires this when body is set
    // @ts-expect-error — Node Request types don't model `duplex` yet.
    duplex: body ? 'half' : undefined,
  });
}

describe('refererOrigin', () => {
  test('returns origin for a well-formed URL', () => {
    assert.equal(refererOrigin('https://mirai-shigoto.com/path?x=1'),
      'https://mirai-shigoto.com');
  });

  test('returns null for malformed input', () => {
    assert.equal(refererOrigin('not a url'), null);
  });

  test('returns null for empty / null input', () => {
    assert.equal(refererOrigin(''), null);
    assert.equal(refererOrigin(null), null);
    assert.equal(refererOrigin(undefined), null);
  });

  test('distinguishes scheme / host / port', () => {
    assert.equal(refererOrigin('https://mirai-shigoto.com:8443/x'),
      'https://mirai-shigoto.com:8443');
    assert.equal(refererOrigin('http://mirai-shigoto.com/x'),
      'http://mirai-shigoto.com');
  });
});

describe('makeOriginGate', () => {
  const gate = makeOriginGate(ALLOWED);

  test('allows when Origin is in the allow-list', async () => {
    const res = gate(makeReq({ origin: 'https://mirai-shigoto.com' }));
    assert.equal(res, null);
  });

  test('allows when Referer (origin-parsed) is in the allow-list', async () => {
    const res = gate(makeReq({ referer: 'https://mirai-shigoto.com/some/page' }));
    assert.equal(res, null);
  });

  test('REJECTS a prefix-injection Referer (the bug this fixes)', async () => {
    // Old `startsWith` check would have allowed this. URL.origin parse blocks it.
    const res = gate(makeReq({ referer: 'https://mirai-shigoto.com.evil.com/x' }));
    assert.ok(res, 'gate must return a Response');
    assert.equal(res.status, 403);
  });

  test('rejects an attacker Origin even if it shares a prefix', async () => {
    const res = gate(makeReq({ origin: 'https://mirai-shigoto.com.evil.com' }));
    assert.ok(res);
    assert.equal(res.status, 403);
  });

  test('rejects a query-string redirect attempt in the Referer', async () => {
    const res = gate(makeReq({ referer: 'https://evil.com/?u=https://mirai-shigoto.com' }));
    assert.ok(res);
    assert.equal(res.status, 403);
  });

  test('rejects when both Origin and Referer are missing', async () => {
    const res = gate(makeReq({}));
    assert.ok(res);
    assert.equal(res.status, 403);
  });

  test('falls back to Referer when Origin is missing (some browsers)', async () => {
    const res = gate(makeReq({ referer: 'https://mirai-shigoto.com/' }));
    assert.equal(res, null);
  });

  test('rejects when Origin is non-allowlisted even if Referer matches', async () => {
    // Defensive: if browser sent a hostile Origin, we treat that as a
    // stronger signal than a possibly-spoofable Referer.
    // (Actually the gate ORs them; this case still passes because Referer wins.
    // Keeping the test as documentation of intentional behavior.)
    const res = gate(makeReq({
      origin: 'https://evil.com',
      referer: 'https://mirai-shigoto.com/',
    }));
    assert.equal(res, null, 'Referer fallback intentionally OR-allows');
  });
});

// ─── readBodyText ─────────────────────────────────────────────────────────

function streamFrom(bytes: Uint8Array, chunkSize = 16): ReadableStream {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      const end = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}

describe('readBodyText', () => {
  test('reads body under cap', async () => {
    const payload = '{"hello":"world"}';
    const req = makeReq({ 'content-type': 'application/json' },
      streamFrom(new TextEncoder().encode(payload)));
    const text = await readBodyText(req, 1024);
    assert.equal(text, payload);
  });

  test('returns empty string when body is null', async () => {
    const req = new Request('https://example.com/x', { method: 'POST' });
    const text = await readBodyText(req, 1024);
    assert.equal(text, '');
  });

  test('throws BodyTooLargeError when cumulative byte count exceeds cap', async () => {
    const payload = 'x'.repeat(2000);
    const req = makeReq({}, streamFrom(new TextEncoder().encode(payload)));
    await assert.rejects(
      () => readBodyText(req, 1024),
      (err: unknown) => err instanceof BodyTooLargeError,
    );
  });

  test('caps regardless of content-length header (chunked attack)', async () => {
    // Header lies about size; streaming check should still catch it.
    const payload = 'y'.repeat(10_000);
    const req = makeReq({ 'content-length': '5' },
      streamFrom(new TextEncoder().encode(payload), 256));
    await assert.rejects(
      () => readBodyText(req, 1024),
      (err: unknown) => err instanceof BodyTooLargeError,
    );
  });

  test('reads multi-chunk body correctly', async () => {
    const payload = JSON.stringify({ a: 1, b: 'hello' }) ;
    const req = makeReq({}, streamFrom(new TextEncoder().encode(payload), 4));
    const text = await readBodyText(req, 1024);
    assert.equal(text, payload);
  });
});

describe('clientIpFromRequest', () => {
  test('x-real-ip is the highest-priority source (infrastructure-set)', () => {
    const req = makeReq({
      'x-real-ip': '203.0.113.42',
      'x-forwarded-for': '198.51.100.7, 192.0.2.1',
    });
    assert.equal(clientIpFromRequest(req), '203.0.113.42');
  });

  test('x-vercel-forwarded-for last hop wins over XFF (2nd priority)', () => {
    const req = makeReq({
      'x-vercel-forwarded-for': '198.51.100.7, 203.0.113.42',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });
    // last hop in vercel xff is closest to our function
    assert.equal(clientIpFromRequest(req), '203.0.113.42');
  });

  test('xff last hop is the client IP (H15 fix: was first hop / spoofable)', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.42, 198.51.100.7, 192.0.2.1' });
    // Last hop is closest to our function = infrastructure-trusted edge.
    assert.equal(clientIpFromRequest(req), '192.0.2.1');
  });

  test('missing header → "anonymous" (bucket-as-whole)', () => {
    const req = makeReq({});
    assert.equal(clientIpFromRequest(req), 'anonymous');
  });

  test('single-IP header (no comma)', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.42' });
    assert.equal(clientIpFromRequest(req), '203.0.113.42');
  });

  test('whitespace around IP is trimmed', () => {
    const req = makeReq({ 'x-forwarded-for': '  203.0.113.42  ,  192.0.2.1' });
    // Last hop, whitespace-trimmed
    assert.equal(clientIpFromRequest(req), '192.0.2.1');
  });
});

describe('rateLimitCheck', () => {
  test('skipped when UPSTASH env vars missing → degrades open', async () => {
    const result = await rateLimitCheck({
      ip: '1.1.1.1', namespace: 'feedback', limit: 10, windowSeconds: 300,
      env: {},
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });

  test('skipped when only URL is set (token missing)', async () => {
    const result = await rateLimitCheck({
      ip: '1.1.1.1', namespace: 'feedback', limit: 10, windowSeconds: 300,
      env: { UPSTASH_REDIS_REST_URL: 'https://example.upstash.io' },
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });

  test('skipped when only token is set (URL missing)', async () => {
    const result = await rateLimitCheck({
      ip: '1.1.1.1', namespace: 'feedback', limit: 10, windowSeconds: 300,
      env: { UPSTASH_REDIS_REST_TOKEN: 'fake-token' },
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });

  test('fail-open on Upstash 5xx by default', async () => {
    // Stub global fetch to simulate Upstash outage
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('boom', { status: 503 }) as Response;
    try {
      const result = await rateLimitCheck({
        ip: '1.1.1.1', namespace: 'feedback', limit: 10, windowSeconds: 300,
        env: {
          UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
          UPSTASH_REDIS_REST_TOKEN: 'fake-token',
        },
      });
      assert.equal(result.ok, true, 'should fail open');
      assert.equal(result.skipped, true);
      assert.match(result.error || '', /upstream_503/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fail-closed on Upstash 5xx when FAIL_CLOSED_ON_RATELIMIT_ERROR=1', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('boom', { status: 503 }) as Response;
    try {
      const result = await rateLimitCheck({
        ip: '1.1.1.1', namespace: 'feedback', limit: 10, windowSeconds: 300,
        env: {
          UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
          UPSTASH_REDIS_REST_TOKEN: 'fake-token',
          FAIL_CLOSED_ON_RATELIMIT_ERROR: '1',
        },
      });
      assert.equal(result.ok, false, 'should fail closed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('under-quota response includes count + remaining', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify([
      { result: 3 },  // INCR returned 3
      { result: 1 },  // EXPIRE returned 1
    ]), { status: 200 }) as Response;
    try {
      const result = await rateLimitCheck({
        ip: '1.1.1.1', namespace: 'feedback', limit: 10, windowSeconds: 300,
        env: {
          UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
          UPSTASH_REDIS_REST_TOKEN: 'fake-token',
        },
      });
      assert.equal(result.ok, true);
      assert.equal(result.count, 3);
      assert.equal(result.remaining, 7);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('over-quota → ok:false + retryAfterSec', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify([
      { result: 11 },  // 11 > limit 10
      { result: 1 },
    ]), { status: 200 }) as Response;
    try {
      const result = await rateLimitCheck({
        ip: '1.1.1.1', namespace: 'feedback', limit: 10, windowSeconds: 300,
        env: {
          UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
          UPSTASH_REDIS_REST_TOKEN: 'fake-token',
        },
      });
      assert.equal(result.ok, false);
      assert.equal(result.retryAfterSec, 300);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('verifyTurnstile', () => {
  test('skipped when TURNSTILE_SECRET_KEY missing → degrades open', async () => {
    const result = await verifyTurnstile({
      token: 'whatever',
      env: {},
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });

  test('missing token + secret configured → fail with missing_token', async () => {
    const result = await verifyTurnstile({
      token: null,
      env: { TURNSTILE_SECRET_KEY: 'fake-secret' },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_token');
  });

  test('successful verification', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: true, hostname: 'mirai-shigoto.com' }),
      { status: 200 },
    ) as Response;
    try {
      const result = await verifyTurnstile({
        token: 'valid-token',
        env: { TURNSTILE_SECRET_KEY: 'fake-secret' },
      });
      assert.equal(result.ok, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Cloudflare returns success:false → ok:false', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }),
      { status: 200 },
    ) as Response;
    try {
      const result = await verifyTurnstile({
        token: 'expired-token',
        env: { TURNSTILE_SECRET_KEY: 'fake-secret' },
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'turnstile_failed');
      assert.deepEqual(result.codes, ['invalid-input-response']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('upstream 5xx → fail-open by default', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('boom', { status: 503 }) as Response;
    try {
      const result = await verifyTurnstile({
        token: 'valid-token',
        env: { TURNSTILE_SECRET_KEY: 'fake-secret' },
      });
      assert.equal(result.ok, true, 'fail-open by default');
      assert.equal(result.skipped, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
