/**
 * middleware-helpers.test.ts — pin the GA4 server-side measurement
 * decision logic. All four exports from `middleware-helpers.ts` are
 * pure functions, so tests run without spinning up the Edge runtime.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  BOT_UA_RE,
  isBotUserAgent,
  deriveClientId,
  shouldSendMpHit,
  buildMpPayload,
} from './middleware-helpers.js';

describe('isBotUserAgent — BOT_UA_RE coverage', () => {
  test('matches the canonical search-engine crawlers', () => {
    assert.equal(isBotUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)'), true);
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'), true);
    assert.equal(isBotUserAgent('Baiduspider/2.0'), true);
    assert.equal(isBotUserAgent('Yandexbot/3.0'), true);
    assert.equal(isBotUserAgent('DuckDuckBot/1.1'), true);
  });

  test('matches the SEO-tool crawlers we care about', () => {
    assert.equal(isBotUserAgent('AhrefsBot/7.0'), true);
    assert.equal(isBotUserAgent('SemrushBot/7.0'), true);
    assert.equal(isBotUserAgent('MJ12bot/v1.4.8'), true);
  });

  test('matches the headless-browser / scraper UAs (synthetic traffic)', () => {
    assert.equal(isBotUserAgent('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0'), true);
    assert.equal(isBotUserAgent('Playwright/1.49.0'), true);
    assert.equal(isBotUserAgent('Puppeteer/21.0'), true);
    assert.equal(isBotUserAgent('curl/8.4.0'), true);
    assert.equal(isBotUserAgent('Wget/1.21'), true);
  });

  test('matches uptime / monitoring services', () => {
    assert.equal(isBotUserAgent('Pingdom.com_bot_version_1.4'), true);
    assert.equal(isBotUserAgent('Datadog/HTTP-Health-Check'), true);
  });

  test('does NOT match real-browser UAs', () => {
    assert.equal(
      isBotUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
      false,
    );
    assert.equal(
      isBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
      false,
    );
    assert.equal(
      isBotUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      ),
      false,
    );
  });

  test('case-insensitive matching (regex /i flag pinned)', () => {
    assert.equal(isBotUserAgent('GOOGLEBOT/2.1'), true);
    assert.equal(isBotUserAgent('GoogleBot/2.1'), true);
    assert.equal(isBotUserAgent('CURL/8.4.0'), true);
  });

  test('word boundary protects against false positives', () => {
    // The pattern uses \b…\b — a string containing "bot" as part of
    // a larger word (e.g. "robot" or "robothunter") should not match
    // since "bot" is at a word boundary. But "robot" itself starts
    // with "r" so the \b lookbehind doesn't kick in — let's pin the
    // CURRENT behavior so a regex tweak that loosens this stays
    // visible. "robotMicroservice" contains "bot" at non-word-
    // boundary → no match.
    // (\b matches between word-char and non-word-char; both "r" and
    // "b" are word-chars, so \b does NOT match between them.)
    assert.equal(isBotUserAgent('robotMicroservice/1.0'), false);
  });

  test('BOT_UA_RE export is reusable (same regex object)', () => {
    // Ensure callers that import the regex directly (for e.g. their
    // own filter pipeline) get the same instance.
    assert.equal(BOT_UA_RE.test('Googlebot'), true);
    assert.equal(BOT_UA_RE.test('Mozilla/5.0'), false);
  });
});

describe('deriveClientId — _ga cookie parsing', () => {
  test('parses canonical _ga cookie shape (GA1.1.<id>.<ts>)', () => {
    const cookie = '_ga=GA1.1.1234567890.1685600000; other=foo';
    assert.equal(deriveClientId(cookie), '1234567890.1685600000');
  });

  test('parses _ga with version digit 2 (GA1.2.*)', () => {
    // Older / mobile-app GA installs use GA1.2 instead of GA1.1.
    const cookie = '_ga=GA1.2.987654321.1234567890';
    assert.equal(deriveClientId(cookie), '987654321.1234567890');
  });

  test('parses _ga when it is one of many cookies', () => {
    const cookie = 'session_id=abc; _ga=GA1.1.55.99; other=xyz';
    assert.equal(deriveClientId(cookie), '55.99');
  });

  test('falls back to pseudo-id when cookie header is null', () => {
    const id = deriveClientId(null);
    // Format: <random>.<unix-ts> — both numeric.
    assert.match(id, /^\d+\.\d+$/);
  });

  test('falls back to pseudo-id when _ga cookie is missing', () => {
    const id = deriveClientId('session=xyz; other=abc');
    assert.match(id, /^\d+\.\d+$/);
  });

  test('falls back to pseudo-id when _ga cookie is malformed', () => {
    // Missing the version + random + ts triple. Bad shape → fallback.
    const id = deriveClientId('_ga=garbage');
    assert.match(id, /^\d+\.\d+$/);
  });

  test('does NOT match a _gid cookie (different GA cookie variant)', () => {
    // _gid is a separate GA cookie family. The regex specifically
    // looks for _ga=GA1.*, not _gid.
    const id = deriveClientId('_gid=GA1.1.1.1');
    // Falls back to pseudo-id, NOT the _gid value.
    assert.match(id, /^\d+\.\d+$/);
    assert.notEqual(id, '1.1');
  });
});

describe('shouldSendMpHit — composite decision', () => {
  const VALID_HTML_REQ = {
    measurementId: 'G-XYZ123',
    apiSecret: 'secret-abc',
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120.0',
    accept: 'text/html,application/xhtml+xml',
    pathname: '/',
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

  test('bot UA → false (do not pollute GA4 with crawler hits)', () => {
    assert.equal(
      shouldSendMpHit({ ...VALID_HTML_REQ, userAgent: 'Googlebot/2.1' }),
      false,
    );
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
});

describe('buildMpPayload — GA4 Measurement Protocol shape', () => {
  const BASE_INPUT = {
    clientId: '1234567890.1685600000',
    pageLocation: 'https://mirai-shigoto.com/ja/156',
    pageReferrer: 'https://google.com/',
    clientIp: '203.0.113.42',
    userAgent: 'Mozilla/5.0 Chrome/120',
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

  test('event is a single page_view', () => {
    const p = buildMpPayload(BASE_INPUT) as {
      events: ReadonlyArray<{ name: string; params: Record<string, unknown> }>;
    };
    const ev = p.events[0]!;
    assert.equal(ev.name, 'page_view');
    assert.equal(ev.params.page_location, BASE_INPUT.pageLocation);
    assert.equal(ev.params.page_referrer, BASE_INPUT.pageReferrer);
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
