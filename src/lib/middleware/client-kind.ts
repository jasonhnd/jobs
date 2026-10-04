/**
 * Conservative bot UA filter. Bots that don't execute JS don't send
 * browser-side gtag.js hits anyway, so adding them server-side would
 * inflate counts (bot traffic) that nobody wants in GA4.
 *
 * Sourced from a survey of crawler UAs hitting the production site
 * 2026-05-11 — see middleware.ts comments for the diagnosis trail.
 *
 * 2026-05-24 P0-1 expansion: the original list relied on `\bbot\b`
 * matching anywhere in the UA, but `\b` is a word boundary — it does
 * NOT match between two letters. So a UA like `Amazonbot/0.1` or
 * `GPTBot/1.0` never tripped the generic `bot` alternation (no
 * boundary between the last letter of "Amazon" / "GPT" and "B" of
 * "Bot"). Every modern AI / LLM / scanner bot is now enumerated
 * explicitly so `\bgptbot\b`, `\bbytespider\b`, etc. match the
 * standard `Mozilla/5.0 (compatible; XxxxBot/1.0)` shape.
 */
export const BOT_UA_RE =
  /\b(bot|crawler|spider|crawling|scrapy|scraper|scraping|curl|wget|httpie|postman|monitor|uptime|pingdom|datadog|newrelic|sentry|googlebot|bingbot|baiduspider|yandexbot|duckduckbot|applebot|petalbot|ahrefsbot|semrushbot|mj12bot|preview|prerender|chrome-lighthouse|headlesschrome|phantomjs|slimerjs|playwright|puppeteer|cypress|gptbot|chatgpt-user|bytespider|perplexitybot|anthropic-ai|claudebot|claude-web|cohere-ai|google-extended|meta-externalagent|amazonbot|linkedinbot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|facebookexternalhit|ia_archiver|zgrab|nmap|masscan|censys|shodan|expansescanner|expanse|fetcher)\b/i;

/** True iff the User-Agent string matches a known bot, AI agents included. */
export function isBotUserAgent(ua: string): boolean {
  return BOT_UA_RE.test(ua);
}

/**
 * Social unfurlers that fetch OG tags for a timeline card.
 * Narrower than `isBotUserAgent` so Googlebot still sees the canonical `/me`.
 */
const SHARE_UNFURLER_UA_RE =
  /\b(twitterbot|facebookexternalhit|slackbot|discordbot|linkedinbot|whatsapp|telegrambot)\b/i;

export function isShareUnfurlerUserAgent(ua: string): boolean {
  return SHARE_UNFURLER_UA_RE.test(ua);
}

/**
 * Known AI / LLM agents, mapped to the canonical `agent_name` sent to GA4.
 *
 * Every entry here also matches `BOT_UA_RE`; that overlap is the point.
 * `shouldSendMpHit` consults this list first, so an AI agent is *measured as a
 * delivery* instead of being dropped as a crawler.
 *
 * Why measure them at all: "which engine fetched which page" is the only
 * first-party signal that the GEO work is landing. From 2026-05-24 to
 * 2026-08-14 every one of these was discarded at the Edge, so that signal
 * existed nowhere — not in GA4, not in any log we keep (#253). AI referral
 * traffic (`geo_referrer_bucket=ai_engine`) is a different and much rarer
 * thing: 3 sessions in the 13 days to 2026-08-13. The fetch is the signal.
 *
 * Order matters, first match wins. `Applebot-Extended` (AI training) must not
 * resolve through to `applebot` (Siri / Spotlight indexing), which is an
 * ordinary search crawler and stays excluded.
 */
export const AI_AGENT_UA_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\boai-searchbot\b/i, 'oai_searchbot'],
  [/\bchatgpt-user\b/i, 'chatgpt_user'],
  [/\bgptbot\b/i, 'gptbot'],
  [/\bclaude-searchbot\b/i, 'claude_searchbot'],
  [/\bclaude-user\b/i, 'claude_user'],
  [/\bclaude-web\b/i, 'claude_web'],
  [/\bclaudebot\b/i, 'claudebot'],
  [/\banthropic-ai\b/i, 'anthropic_ai'],
  [/\bperplexity-user\b/i, 'perplexity_user'],
  [/\bperplexitybot\b/i, 'perplexitybot'],
  [/\bgoogle-extended\b/i, 'google_extended'],
  [/\bapplebot-extended\b/i, 'applebot_extended'],
  [/\bmeta-externalagent\b/i, 'meta_externalagent'],
  [/\bbytespider\b/i, 'bytespider'],
  [/\bcohere-ai\b/i, 'cohere_ai'],
  [/\bduckassistbot\b/i, 'duckassistbot'],
  [/\bmistralai-user\b/i, 'mistralai_user'],
  [/\byoubot\b/i, 'youbot'],
];

/**
 * What kind of client this delivery is going to.
 *
 * `other_bot` is the only kind the middleware refuses to measure — scanners,
 * SEO crawlers, monitoring probes, headless test runners, social unfurlers.
 */
export type ClientKind = 'browser' | 'ai_agent' | 'other_bot';

/** Value used for `agent_name` when the client is not a named AI agent. */
const NO_AGENT = '(none)';

export interface ClientClassification {
  readonly kind: ClientKind;
  readonly agentName: string;
}

/** Classify a User-Agent into the `client_kind` / `agent_name` pair GA4 receives. */
export function classifyClientKind(ua: string): ClientClassification {
  for (const [pattern, agentName] of AI_AGENT_UA_PATTERNS) {
    if (pattern.test(ua)) return { kind: 'ai_agent', agentName };
  }
  if (isBotUserAgent(ua)) return { kind: 'other_bot', agentName: NO_AGENT };
  return { kind: 'browser', agentName: NO_AGENT };
}

/**
 * Paths that legitimate visitors never request. Almost every hit to
 * these is a vulnerability scanner (WordPress, Drupal, Joomla, Git
 * config exfil, secret-file enumeration, etc.).
 *
 * Two regexes split by concern:
 *
 *   - `SUSPECT_PATH_PREFIX_RE` — well-known scanner targets identified
 *     by path prefix (`/wp-admin/...`, `/.env`, `/.git/config`).
 *
 *   - `SUSPECT_EXT_RE` — file extensions a static Astro site never
 *     legitimately serves (`.php`, `.bak`, `.sql`, etc.). The route
 *     matcher in `middleware.ts` already excludes image / font / json /
 *     map extensions, but it does NOT exclude `.php`, `.asp`, `.bak`,
 *     etc. — those reach the middleware and need a second-layer filter.
 *
 * Wired into `shouldSendMpHit`; not surfaced to the user (a 404 still
 * happens — we only skip the GA4 MP hit so scanners don't pollute
 * analytics with "523 wp-admin pageviews / 0s engagement"-class noise).
 */
const SUSPECT_PATH_PREFIX_RE =
  /^\/(?:wp-admin|wp-login|wp-content|wp-includes|wp-json|xmlrpc\.php|\.env|\.git|\.aws|\.docker|\.idea|\.vscode|\.svn|\.hg|\.htaccess|\.htpasswd|\.well-known\/security|phpmyadmin|administrator|adminer|drupal|joomla|laravel|node_modules|vendor|composer\.json|package(?:-lock)?\.json|yarn\.lock|backup|backups|dump|sql|web\.config|appsettings\.json|_profiler|server-status|server-info|owa|cgi-bin|setup\.php|install\.php|elmah\.axd|trace\.axd|fckeditor|ckeditor|tinymce|aws-secret|aws\.json|secrets\.json|config\.json|application\.properties|application\.yml|telescope|debug\/default\/view|actuator\/env|api\/v1\/namespaces)(?:\/|$|\?|\.)/i;

const SUSPECT_EXT_RE =
  /\.(?:php|asp|aspx|jsp|cgi|bak|swp|swo|orig|sh|sql|db|sqlite|tar|gz|tgz|zip|7z|rar|backup|conf|ini|inc|log|key|pem|crt|p12|pfx)(?:\/|\?|$)/i;

/** True iff the pathname looks like a vulnerability scanner target. */
export function isSuspectPath(pathname: string): boolean {
  return SUSPECT_PATH_PREFIX_RE.test(pathname) || SUSPECT_EXT_RE.test(pathname);
}

