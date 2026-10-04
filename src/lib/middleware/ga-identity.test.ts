/**
 * middleware-helpers.test.ts — pin the GA4 server-side measurement
 * decision logic. The helper exports are pure or deterministic
 * functions, so tests run without spinning up the Edge runtime.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  SESSION_WINDOW_SECONDS,
  deriveSessionId,
  ga4SessionCookieName,
  parseGa4SessionId,
  stableHash,
  isConsentRejected,
  parseGaClientId,
  deliveryIdentity,
  clientIpFromRequest,
} from './ga-identity.js';

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('https://mirai-shigoto.com/', { headers });
}

describe('parseGaClientId — _ga cookie parsing', () => {
  test('parses canonical _ga cookie shape (GA1.1.<id>.<ts>)', () => {
    assert.equal(parseGaClientId('_ga=GA1.1.1234567890.1685600000; other=foo'), '1234567890.1685600000');
  });

  test('parses _ga with version digit 2 (GA1.2.*)', () => {
    // Older / mobile-app GA installs use GA1.2 instead of GA1.1.
    assert.equal(parseGaClientId('_ga=GA1.2.987654321.1234567890'), '987654321.1234567890');
  });

  test('parses _ga when it is one of many cookies', () => {
    assert.equal(parseGaClientId('session_id=abc; _ga=GA1.1.55.99; other=xyz'), '55.99');
  });

  test('returns null when there is no usable _ga', () => {
    assert.equal(parseGaClientId(null), null);
    assert.equal(parseGaClientId('session=xyz; other=abc'), null);
    assert.equal(parseGaClientId('_ga=garbage'), null);
  });

  test('does NOT match a _gid cookie (different GA cookie variant)', () => {
    // _gid is a separate GA cookie family. The regex looks for _ga=GA1.*.
    assert.equal(parseGaClientId('_gid=GA1.1.1.1'), null);
  });
});

describe('deliveryIdentity — join a real session, or bucket; never per-request', () => {
  const BASE = {
    measurementId: 'G-TEST123456',
    clientKind: 'browser' as const,
    agentName: '(none)',
    referrerBucket: 'search',
    nowSeconds: 1_786_000_000,
  };

  test('joins the visitor real identity when _ga is present', () => {
    const id = deliveryIdentity({ ...BASE, cookieHeader: '_ga=GA1.1.1234567890.1685600000' });
    assert.equal(id.clientId, '1234567890.1685600000');
    assert.equal(id.joined, true);
  });

  test('two requests without _ga in the same day share one identity', () => {
    // The defect this replaces minted a fresh id per request, producing ~1,100
    // single-event sessions a day and burying the real population (#253).
    const a = deliveryIdentity({ ...BASE, cookieHeader: null });
    const b = deliveryIdentity({ ...BASE, cookieHeader: null, nowSeconds: BASE.nowSeconds + 3600 });
    assert.equal(a.clientId, b.clientId);
    assert.equal(a.sessionId, b.sessionId);
    assert.equal(a.joined, false);
  });

  test('identity is per (kind x referrer bucket), so sources stay separable', () => {
    const search = deliveryIdentity({ ...BASE, cookieHeader: null, referrerBucket: 'search' });
    const direct = deliveryIdentity({ ...BASE, cookieHeader: null, referrerBucket: 'direct' });
    assert.notEqual(search.clientId, direct.clientId);
  });

  test('AI agents bucket by agent, not by referrer', () => {
    const gpt = deliveryIdentity({
      ...BASE, cookieHeader: null, clientKind: 'ai_agent', agentName: 'gptbot', referrerBucket: 'direct',
    });
    const claude = deliveryIdentity({
      ...BASE, cookieHeader: null, clientKind: 'ai_agent', agentName: 'claudebot', referrerBucket: 'direct',
    });
    assert.notEqual(gpt.clientId, claude.clientId);

    // Referrer must not split an agent's identity — one agent, one session/day.
    const gptElsewhere = deliveryIdentity({
      ...BASE, cookieHeader: null, clientKind: 'ai_agent', agentName: 'gptbot', referrerBucket: 'search',
    });
    assert.equal(gpt.clientId, gptElsewhere.clientId);
  });

  test('an AI agent never borrows a _ga cookie it happens to carry', () => {
    const id = deliveryIdentity({
      ...BASE,
      cookieHeader: '_ga=GA1.1.1234567890.1685600000',
      clientKind: 'ai_agent',
      agentName: 'gptbot',
    });
    assert.equal(id.joined, false);
    assert.notEqual(id.clientId, '1234567890.1685600000');
  });

  test('identity rolls over daily so a bucket cannot accumulate history', () => {
    const today = deliveryIdentity({ ...BASE, cookieHeader: null });
    const tomorrow = deliveryIdentity({ ...BASE, cookieHeader: null, nowSeconds: BASE.nowSeconds + 86_400 });
    assert.notEqual(today.clientId, tomorrow.clientId);
  });

  test('bucket ids keep gtag <id>.<ts> shape', () => {
    const id = deliveryIdentity({ ...BASE, cookieHeader: null });
    assert.match(id.clientId, /^\d+\.\d+$/);
    assert.match(id.sessionId, /^\d+$/);
  });
});

describe('clientIpFromRequest — infrastructure-safe precedence', () => {
  test('prefers x-real-ip over forwarded chains', () => {
    const request = requestWithHeaders({
      'x-real-ip': '203.0.113.42',
      'x-vercel-forwarded-for': '198.51.100.7, 192.0.2.1',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });
    assert.equal(clientIpFromRequest(request), '203.0.113.42');
  });

  test('uses the last Vercel-controlled hop before raw XFF', () => {
    const request = requestWithHeaders({
      'x-vercel-forwarded-for': '198.51.100.7, 203.0.113.42',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });
    assert.equal(clientIpFromRequest(request), '203.0.113.42');
  });

  test('uses the last raw XFF hop and trims whitespace', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': ' 203.0.113.42, 198.51.100.7, 192.0.2.1 ',
    });
    assert.equal(clientIpFromRequest(request), '192.0.2.1');
  });

  test('returns anonymous when no usable IP header exists', () => {
    assert.equal(clientIpFromRequest(requestWithHeaders({})), 'anonymous');
    assert.equal(
      clientIpFromRequest(requestWithHeaders({ 'x-forwarded-for': ' , ' })),
      'anonymous',
    );
  });
});

describe('isConsentRejected — cookieConsent parsing', () => {
  test('null cookie header → not rejected (default granted)', () => {
    assert.equal(isConsentRejected(null), false);
  });

  test('empty cookie header → not rejected', () => {
    assert.equal(isConsentRejected(''), false);
  });

  test('cookieConsent=rejected → rejected (alone or alongside other cookies)', () => {
    assert.equal(isConsentRejected('cookieConsent=rejected'), true);
    assert.equal(isConsentRejected('foo=bar; cookieConsent=rejected'), true);
    assert.equal(isConsentRejected('cookieConsent=rejected; foo=bar'), true);
    assert.equal(isConsentRejected('foo=bar; cookieConsent=rejected; baz=qux'), true);
  });

  test('cookieConsent=accepted → not rejected (explicit consent)', () => {
    assert.equal(isConsentRejected('cookieConsent=accepted'), false);
  });

  test('cookieConsent unset → not rejected (default granted policy)', () => {
    assert.equal(isConsentRejected('_ga=GA1.2.123.456; foo=bar'), false);
  });

  test('substring "rejected" in unrelated cookies does NOT trip the matcher', () => {
    // Only the discrete cookie name `cookieConsent` with value `rejected`
    // counts. A different cookie that contains the literal string
    // "rejected" must not block analytics.
    assert.equal(isConsentRejected('otherCookie=rejected'), false);
    assert.equal(isConsentRejected('preferences=rejected-newsletter'), false);
    assert.equal(isConsentRejected('mailRejected=true'), false);
  });
});

/**
 * The server-side stream reported 48,746 users against 15 sessions in the 28
 * days to 2026-07-26 — an impossible shape that inflated every user-scoped
 * metric roughly threefold. Two causes, pinned here: a client_id minted fresh
 * on every request, and events carrying no session_id at all.
 */
describe('server-side identity (GA4 phantom-user fix)', () => {
  describe('deliveryIdentity', () => {
    const BASE = {
      measurementId: 'G-TEST123456',
      clientKind: 'browser' as const,
      agentName: '(none)',
      referrerBucket: 'direct',
      nowSeconds: 1_786_000_000,
    };

    test('still prefers the _ga cookie so delivery and client hits are one user', () => {
      const id = deliveryIdentity({ ...BASE, cookieHeader: '_ga=GA1.1.1234567890.1685600000; other=x' });
      assert.equal(id.clientId, '1234567890.1685600000');
      assert.equal(id.joined, true);
    });

    test('no request-scoped input reaches the id at all', () => {
      // The IP + UA + Accept-Language fingerprint is gone (#253). Identity now
      // depends only on (kind, agent, referrer bucket, day), so nothing about an
      // individual request can fragment it.
      const id = deliveryIdentity({ ...BASE, cookieHeader: null });
      const same = deliveryIdentity({ ...BASE, cookieHeader: 'unrelated=1', nowSeconds: BASE.nowSeconds + 7200 });
      assert.equal(id.clientId, same.clientId);
    });

    test('always carries a session_id, so no event lands outside a session', () => {
      // Omitting session_id is what produced 48,746 users against 15 sessions.
      for (const cookieHeader of [null, '_ga=GA1.1.1234567890.1685600000']) {
        const id = deliveryIdentity({ ...BASE, cookieHeader });
        assert.match(id.sessionId, /^\d+$/);
        assert.ok(id.sessionId.length > 0);
      }
    });
  });

  describe('stableHash', () => {
    test('is deterministic and spreads distinct inputs apart', () => {
      assert.equal(stableHash('abc'), stableHash('abc'));
      assert.notEqual(stableHash('abc'), stableHash('abd'));
      assert.notEqual(stableHash(''), stableHash('a'));
    });

    test('stays an unsigned 32-bit integer', () => {
      for (const s of ['', 'a', 'ja-JP,ja;q=0.9', '203.0.113.42|Mozilla/5.0']) {
        const h = stableHash(s);
        assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff, `${s} -> ${h}`);
      }
    });
  });

  describe('parseGa4SessionId', () => {
    test('reads gtag session state so server hits join the client session', () => {
      const cookie = '_ga=GA1.1.1.2; _ga_GLDNBDPF13=GS1.1.1753600000.7.1.1753600300.60.0.0';
      assert.equal(parseGa4SessionId(cookie, 'G-GLDNBDPF13'), '1753600000');
    });

    test('handles the GS2 encoding, where the id is `s`-prefixed', () => {
      // Both encodings are live. Missing GS2 would send those browsers down the
      // synthetic-window path and open a session parallel to gtag's.
      const cookie = '_ga_GLDNBDPF13=GS2.1.s1753600000$o7$g1$t1753600300$j0$l0$h0';
      assert.equal(parseGa4SessionId(cookie, 'G-GLDNBDPF13'), '1753600000');
    });

    test('returns null when gtag never ran, or for another property', () => {
      assert.equal(parseGa4SessionId(null, 'G-GLDNBDPF13'), null);
      assert.equal(parseGa4SessionId('_ga=GA1.1.1.2', 'G-GLDNBDPF13'), null);
      assert.equal(parseGa4SessionId('_ga_OTHER=GS1.1.123.1.1.1', 'G-GLDNBDPF13'), null);
    });

    test('derives the cookie name from the measurement id', () => {
      assert.equal(ga4SessionCookieName('G-GLDNBDPF13'), '_ga_GLDNBDPF13');
      assert.equal(ga4SessionCookieName('GLDNBDPF13'), '_ga_GLDNBDPF13');
    });
  });

  describe('deriveSessionId', () => {
    test('reuses gtag session id when present', () => {
      const cookie = '_ga_GLDNBDPF13=GS1.1.1753600000.7.1.1753600300.60.0.0';
      assert.equal(deriveSessionId(cookie, 'G-GLDNBDPF13', 'cid', 1753600400), '1753600000');
    });

    test('consecutive views inside the window share one session', () => {
      const a = deriveSessionId(null, 'G-GLDNBDPF13', 'cid-1', 1753600000);
      const b = deriveSessionId(null, 'G-GLDNBDPF13', 'cid-1', 1753600000 + 900);
      assert.equal(a, b, 'a 15-minute gap must not start a new session');
    });

    test('a gap beyond the window starts a new session', () => {
      const a = deriveSessionId(null, 'G-GLDNBDPF13', 'cid-1', 1753600000);
      const b = deriveSessionId(null, 'G-GLDNBDPF13', 'cid-1', 1753600000 + SESSION_WINDOW_SECONDS * 2);
      assert.notEqual(a, b);
    });

    test('two visitors in the same window get different sessions', () => {
      const a = deriveSessionId(null, 'G-GLDNBDPF13', 'cid-1', 1753600000);
      const b = deriveSessionId(null, 'G-GLDNBDPF13', 'cid-2', 1753600000);
      assert.notEqual(a, b);
    });

    test('always returns digits — GA4 rejects a non-numeric session_id', () => {
      assert.match(deriveSessionId(null, 'G-GLDNBDPF13', 'cid', 1753600000), /^\d+$/);
    });
  });

});

