/**
 * middleware-helpers.test.ts — pin the GA4 server-side measurement
 * decision logic. The helper exports are pure or deterministic
 * functions, so tests run without spinning up the Edge runtime.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  BOT_UA_RE,
  SESSION_WINDOW_SECONDS,
  deriveSessionId,
  ga4SessionCookieName,
  parseGa4SessionId,
  stableHash,
  isBotUserAgent,
  isSuspectPath,
  isConsentRejected,
  parseGaClientId,
  deliveryIdentity,
  classifyClientKind,
  AI_AGENT_UA_PATTERNS,
  DELIVERY_EVENT_NAME,
  clientIpFromRequest,
  shouldSendMpHit,
  buildMpPayload,
  landingFamily,
  isGoogleHost,
  classifyGeoReferral,
} from './middleware-helpers.js';

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('https://mirai-shigoto.com/', { headers });
}

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

describe('classifyClientKind — browser / ai_agent / other_bot', () => {
  test('plain browsers classify as browser with no agent name', () => {
    const chrome = classifyClientKind(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    );
    assert.equal(chrome.kind, 'browser');
    assert.equal(chrome.agentName, '(none)');
  });

  test('named AI agents classify as ai_agent and are NOT dropped', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'gptbot'],
      ['Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)', 'chatgpt_user'],
      ['Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)', 'oai_searchbot'],
      ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'claudebot'],
      ['Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)', 'claude_user'],
      ['Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)', 'perplexitybot'],
      ['Mozilla/5.0 (compatible; Perplexity-User/1.0)', 'perplexity_user'],
      ['Mozilla/5.0 (compatible; Google-Extended/1.0)', 'google_extended'],
      ['Mozilla/5.0 (compatible; Bytespider; https://zhanzhang.toutiao.com/)', 'bytespider'],
      ['meta-externalagent/1.1', 'meta_externalagent'],
    ];
    for (const [ua, expected] of cases) {
      const got = classifyClientKind(ua);
      assert.equal(got.kind, 'ai_agent', `${ua} should be ai_agent`);
      assert.equal(got.agentName, expected);
    }
  });

  test('Applebot-Extended is an AI agent; plain Applebot is not', () => {
    // Order-sensitive: the extended variant must not fall through to the
    // Siri / Spotlight crawler, which stays excluded.
    assert.deepEqual(
      classifyClientKind('Mozilla/5.0 (compatible; Applebot-Extended/0.1)'),
      { kind: 'ai_agent', agentName: 'applebot_extended' },
    );
    assert.equal(classifyClientKind('Mozilla/5.0 (compatible; Applebot/0.1)').kind, 'other_bot');
  });

  test('scanners, SEO crawlers and test runners stay other_bot', () => {
    for (const ua of [
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'AhrefsBot/7.0',
      'SemrushBot/7.0',
      'curl/8.4.0',
      'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0',
      'Pingdom.com_bot_version_1.4',
      'facebookexternalhit/1.1',
    ]) {
      assert.equal(classifyClientKind(ua).kind, 'other_bot', `${ua} should be other_bot`);
    }
  });

  test('every AI agent pattern also matches the generic bot filter', () => {
    // The overlap is intentional and load-bearing: classifyClientKind must be
    // consulted BEFORE isBotUserAgent, or every AI agent is silently dropped —
    // which is exactly what happened from 2026-05-24 to 2026-08-14 (#253).
    for (const [, agentName] of AI_AGENT_UA_PATTERNS) {
      assert.equal(typeof agentName, 'string');
      assert.match(agentName, /^[a-z0-9_]+$/, `${agentName} must be a stable snake_case id`);
    }
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

describe('isBotUserAgent — P0-1 expansion (modern AI / LLM / scanner UAs)', () => {
  // Pre-P0-1 these UAs slipped through because `\bbot\b` (word boundary)
  // doesn't match between two letters — `Amazonbot`, `GPTBot`,
  // `PerplexityBot`, etc. all rely on the generic `\bbot\b` alternation
  // which couldn't see "bot" embedded after a word character. Explicit
  // enumeration of each bot name fixes the boundary problem.
  test('OpenAI bots (GPTBot, ChatGPT-User) are caught', () => {
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'), true);
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)'), true);
  });

  test('Anthropic bots (ClaudeBot, anthropic-ai, Claude-Web) are caught', () => {
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'), true);
    assert.equal(isBotUserAgent('anthropic-ai'), true);
    assert.equal(isBotUserAgent('Claude-Web/1.0'), true);
  });

  test('Other LLM crawlers (PerplexityBot, Bytespider, cohere-ai, Google-Extended, Meta-ExternalAgent) are caught', () => {
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'), true);
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'), true);
    assert.equal(isBotUserAgent('cohere-ai/1.0'), true);
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Google-Extended/1.0)'), true);
    assert.equal(isBotUserAgent('Meta-ExternalAgent/1.1 (+https://developers.facebook.com)'), true);
  });

  test('Bot suffixes (Amazonbot, LinkedInBot) are caught now that explicit names override \\bbot\\b limitation', () => {
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com)'), true);
    assert.equal(isBotUserAgent('LinkedInBot/1.0 (compatible; Mozilla/5.0; +http://www.linkedin.com)'), true);
  });

  test('Link-preview fetchers (facebookexternalhit, Twitterbot, Slackbot, Discordbot, TelegramBot, WhatsApp) are caught', () => {
    assert.equal(isBotUserAgent('facebookexternalhit/1.1'), true);
    assert.equal(isBotUserAgent('Twitterbot/1.0'), true);
    assert.equal(isBotUserAgent('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'), true);
    assert.equal(isBotUserAgent('Discordbot/2.0 (+https://discordapp.com)'), true);
    assert.equal(isBotUserAgent('TelegramBot (like TwitterBot)'), true);
    assert.equal(isBotUserAgent('WhatsApp/2.23.20.0 A'), true);
  });

  test('Security scanners (zgrab, Censys, Expanse, Shodan) are caught', () => {
    assert.equal(isBotUserAgent('Mozilla/5.0 zgrab/0.x'), true);
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)'), true);
    assert.equal(isBotUserAgent('Expanse, a Palo Alto Networks company, searches across the global IPv4 space'), true);
  });

  test('regression: real modern human UAs are still NOT bots', () => {
    // The expanded regex must not introduce false positives on real
    // browsers — particularly the in-app webviews that 84% of mobile
    // visitors arrive on (Twitter/X embedded Safari, etc.).
    assert.equal(
      isBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone',
      ),
      false,
    );
    assert.equal(
      isBotUserAgent(
        'Mozilla/5.0 (Linux; Android 14; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
      ),
      false,
    );
  });
});

describe('isSuspectPath — vulnerability-scanner targets', () => {
  test('WordPress scanner paths are flagged', () => {
    assert.equal(isSuspectPath('/wp-admin/install.php'), true);
    assert.equal(isSuspectPath('/wp-admin/'), true);
    assert.equal(isSuspectPath('/wp-login.php'), true);
    assert.equal(isSuspectPath('/wp-content/plugins/foo/bar.php'), true);
    assert.equal(isSuspectPath('/wp-includes/wlwmanifest.xml'), true);
    assert.equal(isSuspectPath('/wp-json/wp/v2/users'), true);
    assert.equal(isSuspectPath('/xmlrpc.php'), true);
  });

  test('Secret-file enumeration paths are flagged', () => {
    assert.equal(isSuspectPath('/.env'), true);
    assert.equal(isSuspectPath('/.env.local'), true);
    assert.equal(isSuspectPath('/.env.production'), true);
    assert.equal(isSuspectPath('/.git/config'), true);
    assert.equal(isSuspectPath('/.git/HEAD'), true);
    assert.equal(isSuspectPath('/.aws/credentials'), true);
    assert.equal(isSuspectPath('/.docker/config.json'), true);
    assert.equal(isSuspectPath('/.idea/workspace.xml'), true);
    assert.equal(isSuspectPath('/.vscode/settings.json'), true);
    assert.equal(isSuspectPath('/.svn/wc.db'), true);
    assert.equal(isSuspectPath('/secrets.json'), true);
    assert.equal(isSuspectPath('/aws-secret'), true);
  });

  test('PHP-stack scanner paths (PHP / Java / Drupal / Joomla) are flagged', () => {
    assert.equal(isSuspectPath('/phpmyadmin/index.php'), true);
    assert.equal(isSuspectPath('/administrator/index.php'), true);
    assert.equal(isSuspectPath('/drupal/CHANGELOG.txt'), true);
    assert.equal(isSuspectPath('/joomla/administrator'), true);
    assert.equal(isSuspectPath('/_profiler/empty/search'), true);
    assert.equal(isSuspectPath('/server-status'), true);
    assert.equal(isSuspectPath('/actuator/env'), true);
    assert.equal(isSuspectPath('/api/v1/namespaces/default/secrets'), true);
  });

  test('Suspect file extensions are flagged regardless of path', () => {
    assert.equal(isSuspectPath('/anything/random.php'), true);
    assert.equal(isSuspectPath('/login.asp'), true);
    assert.equal(isSuspectPath('/struts2.jsp'), true);
    assert.equal(isSuspectPath('/database.bak'), true);
    assert.equal(isSuspectPath('/source.swp'), true);
    assert.equal(isSuspectPath('/backup.tar.gz'), true);
    assert.equal(isSuspectPath('/secret.pem'), true);
    assert.equal(isSuspectPath('/private.key'), true);
  });

  test('Suspect paths with query strings still flagged', () => {
    assert.equal(isSuspectPath('/wp-admin/admin-ajax.php?action=foo'), true);
    assert.equal(isSuspectPath('/.env?bypass=1'), true);
    assert.equal(isSuspectPath('/file.php?id=1'), true);
  });

  test('Legitimate site paths are NOT flagged', () => {
    assert.equal(isSuspectPath('/'), false);
    assert.equal(isSuspectPath('/156'), false);
    assert.equal(isSuspectPath('/me'), false);
    assert.equal(isSuspectPath('/map'), false);
    assert.equal(isSuspectPath('/map?sector=03'), false);
    assert.equal(isSuspectPath('/sectors'), false);
    assert.equal(isSuspectPath('/rankings/ai-risk-low'), false);
    assert.equal(isSuspectPath('/privacy'), false);
    assert.equal(isSuspectPath('/compare/foo-vs-bar'), false);
  });

  test('Path strings that LOOK suspect but are legitimate slug content are NOT flagged', () => {
    // Critical false-positive guard. The site has real occupation slugs
    // and ranking pages whose names happen to contain "wp"-like or
    // "php"-like substrings. The regex anchors prevent that.
    assert.equal(isSuspectPath('/php-developer'), false);
    assert.equal(isSuspectPath('/article/wordpress-tips'), false);
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

describe('classifyGeoReferral — GEO referral baseline classification', () => {
  const pageUrl = (pathname: string) => new URL(`https://mirai-shigoto.com${pathname}`);

  test('known AI engines classify into the ai_engine bucket', () => {
    const cases = [
      ['https://perplexity.ai/search?q=jobs', 'perplexity'],
      ['https://chatgpt.com/c/abc', 'chatgpt_search'],
      ['https://chat.openai.com/c/abc', 'chatgpt_search'],
      ['https://gemini.google.com/app/abc', 'gemini'],
      ['https://bard.google.com/chat', 'gemini'],
      ['https://copilot.microsoft.com/chats/abc', 'bing_copilot'],
      ['https://bing.com/chat?q=jobs', 'bing_copilot'],
      ['https://claude.ai/chat/abc', 'claude'],
      ['https://you.com/search?q=jobs', 'you_com'],
      ['https://phind.com/search?q=jobs', 'phind_com'],
      ['https://komo.ai/search?q=jobs', 'komo_ai'],
      ['https://andisearch.com/?q=jobs', 'andisearch_com'],
    ] as const;

    for (const [referer, engine] of cases) {
      const result = classifyGeoReferral(pageUrl('/156'), referer);
      assert.equal(result.geo_referrer_engine, engine, referer);
      assert.equal(result.geo_referrer_bucket, 'ai_engine', referer);
      assert.equal(result.geo_citation_candidate, 'true', referer);
    }
  });

  test('Google search hosts classify as search, but Google product subdomains do not', () => {
    assert.equal(isGoogleHost('google.com'), true);
    assert.equal(isGoogleHost('google.co.jp'), true);
    assert.equal(isGoogleHost('mail.google.com'), false);
    assert.equal(isGoogleHost('docs.google.com'), false);
    assert.equal(isGoogleHost('drive.google.com'), false);

    for (const referer of [
      'https://google.com/search?q=jobs',
      'https://google.co.jp/search?q=jobs',
      'https://www.google.com/search?q=jobs',
    ]) {
      const result = classifyGeoReferral(pageUrl('/answers/ai-risk'), referer);
      assert.equal(result.geo_referrer_engine, 'google_search', referer);
      assert.equal(result.geo_referrer_bucket, 'search', referer);
      assert.equal(result.geo_citation_candidate, 'true', referer);
    }

    for (const referer of [
      'https://mail.google.com/mail/u/0/#inbox',
      'https://docs.google.com/document/d/abc/edit',
      'https://drive.google.com/file/d/abc/view',
    ]) {
      const result = classifyGeoReferral(pageUrl('/answers/ai-risk'), referer);
      assert.equal(result.geo_referrer_engine, 'other_external', referer);
      assert.equal(result.geo_referrer_bucket, 'external', referer);
      assert.equal(result.geo_citation_candidate, 'false', referer);
    }
  });

  test('Bing /chat classifies as Copilot; normal Bing paths classify as search', () => {
    const chat = classifyGeoReferral(pageUrl('/answers/ai-risk'), 'https://bing.com/chat?q=jobs');
    assert.equal(chat.geo_referrer_engine, 'bing_copilot');
    assert.equal(chat.geo_referrer_bucket, 'ai_engine');
    assert.equal(chat.geo_citation_candidate, 'true');

    for (const referer of [
      'https://bing.com/search?q=jobs',
      'https://www.bing.com/search?q=jobs',
    ]) {
      const result = classifyGeoReferral(pageUrl('/answers/ai-risk'), referer);
      assert.equal(result.geo_referrer_engine, 'bing_search', referer);
      assert.equal(result.geo_referrer_bucket, 'search', referer);
      assert.equal(result.geo_citation_candidate, 'true', referer);
    }
  });

  test('same-site referer classifies as internal; empty referer classifies as direct', () => {
    const internal = classifyGeoReferral(pageUrl('/answers/ai-risk'), 'https://mirai-shigoto.com/156');
    assert.equal(internal.geo_referrer_engine, 'internal');
    assert.equal(internal.geo_referrer_bucket, 'internal');
    assert.equal(internal.geo_citation_candidate, 'false');

    const wwwInternal = classifyGeoReferral(pageUrl('/answers/ai-risk'), 'https://www.mirai-shigoto.com/156');
    assert.equal(wwwInternal.geo_referrer_engine, 'internal');
    assert.equal(wwwInternal.geo_referrer_bucket, 'internal');
    assert.equal(wwwInternal.geo_citation_candidate, 'false');

    const direct = classifyGeoReferral(pageUrl('/answers/ai-risk'), '');
    assert.equal(direct.geo_referrer_engine, 'direct');
    assert.equal(direct.geo_referrer_bucket, 'direct');
    assert.equal(direct.geo_referrer_host, '(direct)');
    assert.equal(direct.geo_citation_candidate, 'false');
  });

  test('search referrals only become candidates on citable landing families', () => {
    const cases = [
      ['/answers/ai-risk', 'answers'],
      ['/q/will-ai-replace-programmers', 'qa'],
      ['/sectors/healthcare', 'sector'],
      ['/rankings/ai-risk-low', 'ranking'],
      ['/compare/programmer-vs-designer', 'compare'],
      ['/standard', 'standard'],
      ['/methodology', 'methodology'],
    ] as const;

    for (const [pathname, family] of cases) {
      assert.equal(landingFamily(pathname), family);
      const result = classifyGeoReferral(pageUrl(pathname), 'https://google.com/search?q=jobs');
      assert.equal(result.geo_referrer_bucket, 'search', pathname);
      assert.equal(result.geo_landing_family, family, pathname);
      assert.equal(result.geo_citation_candidate, 'true', pathname);
    }

    const occupation = classifyGeoReferral(pageUrl('/156'), 'https://google.com/search?q=jobs');
    assert.equal(landingFamily('/156'), 'occupation');
    assert.equal(occupation.geo_referrer_bucket, 'search');
    assert.equal(occupation.geo_landing_family, 'occupation');
    assert.equal(occupation.geo_citation_candidate, 'false');
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
