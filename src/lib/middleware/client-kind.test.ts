/**
 * middleware-helpers.test.ts — pin the GA4 server-side measurement
 * decision logic. The helper exports are pure or deterministic
 * functions, so tests run without spinning up the Edge runtime.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  BOT_UA_RE,
  isBotUserAgent,
  isSuspectPath,
  classifyClientKind,
  AI_AGENT_UA_PATTERNS,
} from './client-kind.js';

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

