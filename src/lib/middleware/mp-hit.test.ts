/**
 * middleware-helpers.test.ts — pin the GA4 server-side measurement
 * decision logic. The helper exports are pure or deterministic
 * functions, so tests run without spinning up the Edge runtime.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  DELIVERY_EVENT_NAME,
  shouldSendMpHit,
  buildMpPayload,
} from './mp-hit.js';

describe('shouldSendMpHit — composite decision', () => {
  const VALID_HTML_REQ = {
    measurementId: 'G-XYZ123',
    apiSecret: 'secret-abc',
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120.0',
    accept: 'text/html,application/xhtml+xml',
    pathname: '/',
    cookieHeader: null,
  };

  test('happy path: env present + browser UA + HTML accept + page path → true', () => {
    assert.equal(shouldSendMpHit(VALID_HTML_REQ), true);
  });

  test('missing measurementId → false (env not configured)', () => {
    assert.equal(shouldSendMpHit({ ...VALID_HTML_REQ, measurementId: undefined }), false);
  });

  test('missing apiSecret → false (env not configured)', () => {
    assert.equal(shouldSendMpHit({ ...VALID_HTML_REQ, apiSecret: undefined }), false);
  });

  test('non-AI bot UA → false (scanners, SEO crawlers, monitoring)', () => {
    for (const userAgent of ['Googlebot/2.1', 'AhrefsBot/7.0', 'curl/8.4.0', 'Pingdom.com_bot_version_1.4']) {
      assert.equal(shouldSendMpHit({ ...VALID_HTML_REQ, userAgent }), false, userAgent);
    }
  });

  test('AI agent UA → true (measured on purpose, not dropped)', () => {
    // Refusing these is what left "which engine fetched what" unmeasured from
    // 2026-05-24 to 2026-08-14. They are the GEO signal, not pollution — they
    // are separated by client_kind / agent_name instead of being discarded.
    for (const userAgent of [
      'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)',
      'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
    ]) {
      assert.equal(shouldSendMpHit({ ...VALID_HTML_REQ, userAgent }), true, userAgent);
    }
  });

  test('an AI agent is still refused when it trips a non-UA rule', () => {
    // The AI carve-out is narrow: it only bypasses the bot filter.
    const gptbot = { ...VALID_HTML_REQ, userAgent: 'Mozilla/5.0 (compatible; GPTBot/1.2)' };
    assert.equal(shouldSendMpHit({ ...gptbot, accept: 'image/avif' }), false);
    assert.equal(shouldSendMpHit({ ...gptbot, pathname: '/wp-admin/setup-config.php' }), false);
    assert.equal(shouldSendMpHit({ ...gptbot, cookieHeader: 'cookieConsent=rejected' }), false);
    assert.equal(shouldSendMpHit({ ...gptbot, apiSecret: undefined }), false);
  });

  test('Accept without text/html → false (skip image / font / xhr fetches)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, accept: 'image/avif,image/webp' }),
      false,
    );
  });

  test('pathname under /api/ → false (defensive — matcher should exclude)', () => {
    assert.equal(shouldSendMpHit({ ...VALID_HTML_REQ, pathname: '/api/og' }), false);
  });

  test('pathname under /_vercel/ → false', () => {
    assert.equal(shouldSendMpHit({ ...VALID_HTML_REQ, pathname: '/_vercel/insights/script.js' }), false);
  });

  test('extensionless page path → true (e.g. /map, /privacy)', () => {
    assert.equal(shouldSendMpHit({ ...VALID_HTML_REQ, pathname: '/privacy' }), true);
  });

  // P0-2 (2026-05-24): cookieConsent=rejected suppresses the hit even
  // when every other check passes. Default-granted policy (PR #5) means
  // unset / accepted / arbitrary values let the hit through.
  test('cookieConsent=rejected → false (user opted out of analytics)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, cookieHeader: 'cookieConsent=rejected' }),
      false,
    );
  });

  test('cookieConsent=accepted → true (explicit consent honoured)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, cookieHeader: 'cookieConsent=accepted' }),
      true,
    );
  });

  test('cookieConsent unset (other cookies only) → true (default granted)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, cookieHeader: '_ga=GA1.2.123.456' }),
      true,
    );
  });

  // P0-1 (2026-05-24): vulnerability-scanner paths suppressed. Even
  // when matcher lets them through, the second-layer filter keeps GA4
  // free of "523 wp-admin pageviews / 0s engagement"-class noise.
  test('/wp-admin/install.php → false (scanner target)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, pathname: '/wp-admin/install.php' }),
      false,
    );
  });

  test('/.env → false (secret-file enumeration)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, pathname: '/.env' }),
      false,
    );
  });

  test('/.git/config → false (source-leak attempt)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, pathname: '/.git/config' }),
      false,
    );
  });

  test('arbitrary *.php → false (no PHP on this static site)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, pathname: '/random/file.php' }),
      false,
    );
  });
});

describe('buildMpPayload — GA4 Measurement Protocol shape', () => {
  const BASE_INPUT = {
    clientId: '1234567890.1685600000',
    sessionId: '1700000000',
    pageLocation: 'https://mirai-shigoto.com/156',
    pageReferrer: 'https://google.com/',
    clientIp: '203.0.113.42',
    userAgent: 'Mozilla/5.0 Chrome/120',
    clientKind: 'browser' as const,
    agentName: '(none)',
    timestampMicros: 1_700_000_000_000_000,
  };

  test('produces the documented top-level shape', () => {
    const p = buildMpPayload(BASE_INPUT) as {
      client_id: string;
      timestamp_micros: number;
      events: ReadonlyArray<unknown>;
      ip_override: string;
      user_agent: string;
    };
    assert.equal(p.client_id, BASE_INPUT.clientId);
    assert.equal(p.timestamp_micros, BASE_INPUT.timestampMicros);
    assert.equal(p.ip_override, BASE_INPUT.clientIp);
    assert.equal(p.user_agent, BASE_INPUT.userAgent);
    assert.equal(p.events.length, 1);
  });

  test('event is a single page_delivery, never page_view', () => {
    // page_view is client-side only. Sending it from here is what redefined
    // the metric mid-flight and made 18 days of sessions unreadable (#253).
    const p = buildMpPayload(BASE_INPUT) as {
      events: ReadonlyArray<{ name: string; params: Record<string, unknown> }>;
    };
    const ev = p.events[0]!;
    assert.equal(ev.name, 'page_delivery');
    assert.equal(ev.name, DELIVERY_EVENT_NAME);
    assert.notEqual(ev.name, 'page_view');
    assert.equal(ev.params.page_location, BASE_INPUT.pageLocation);
    assert.equal(ev.params.page_referrer, BASE_INPUT.pageReferrer);
  });

  test('carries client_kind and agent_name so the two populations stay separable', () => {
    const browser = buildMpPayload(BASE_INPUT) as {
      events: ReadonlyArray<{ params: Record<string, unknown> }>;
    };
    assert.equal(browser.events[0]!.params.client_kind, 'browser');
    assert.equal(browser.events[0]!.params.agent_name, '(none)');

    const agent = buildMpPayload({
      ...BASE_INPUT, clientKind: 'ai_agent' as const, agentName: 'gptbot',
    }) as { events: ReadonlyArray<{ params: Record<string, unknown> }> };
    assert.equal(agent.events[0]!.params.client_kind, 'ai_agent');
    assert.equal(agent.events[0]!.params.agent_name, 'gptbot');
  });

  test('engagement_time_msec is set to 1 (required for non-bounce session)', () => {
    // GA4 marks the session as a bounce if engagement_time_msec is
    // missing or 0. We use 1ms to opt the session into "engaged"
    // status while letting client-side events provide real duration.
    const p = buildMpPayload(BASE_INPUT) as {
      events: ReadonlyArray<{ params: { engagement_time_msec: number } }>;
    };
    assert.equal(p.events[0]!.params.engagement_time_msec, 1);
  });

  test('ssrc is "mw" so GA4 Realtime can filter server vs client hits', () => {
    const p = buildMpPayload(BASE_INPUT) as {
      events: ReadonlyArray<{ params: { ssrc: string } }>;
    };
    assert.equal(p.events[0]!.params.ssrc, 'mw');
  });

  test('timestampMicros defaults to Date.now() * 1000 when omitted', () => {
    const before = Date.now() * 1000;
    const p = buildMpPayload({ ...BASE_INPUT, timestampMicros: undefined }) as {
      timestamp_micros: number;
    };
    const after = Date.now() * 1000;
    assert.ok(p.timestamp_micros >= before, 'timestamp_micros below test start');
    assert.ok(p.timestamp_micros <= after, 'timestamp_micros above test end');
  });
});

describe('server-side identity (GA4 phantom-user fix)', () => {
  describe('buildMpPayload', () => {
    test('carries session_id, without which GA4 attaches the hit to no session', () => {
      const p = buildMpPayload({
        clientId: '1.2', sessionId: '1753600000',
        pageLocation: 'https://mirai-shigoto.com/', pageReferrer: '',
        clientIp: '', userAgent: 'UA',
        clientKind: 'browser', agentName: '(none)',
      }) as { events: ReadonlyArray<{ params: Record<string, unknown> }> };
      assert.equal(p.events[0]!.params.session_id, '1753600000');
      assert.equal(p.events[0]!.params.engagement_time_msec, 1);
    });
  });
});
