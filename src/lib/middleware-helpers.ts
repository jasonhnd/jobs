/**
 * src/lib/middleware-helpers.ts — pure helpers for `middleware.ts`
 * (Vercel Edge middleware that fires server-side GA4 page_view hits
 * via the Measurement Protocol).
 *
 * Extracted from middleware.ts so the decision-making logic is unit-
 * testable without spinning up an Edge runtime context. The middleware
 * itself is the I/O wrapper: read headers + env → call these pure
 * helpers → POST to GA4 via `context.waitUntil`.
 *
 * Three concerns covered here:
 *
 *   1. Bot UA detection (`BOT_UA_RE`, `isBotUserAgent`) — skip
 *      server-side measurement for known crawlers so they don't
 *      inflate GA4 with non-human traffic.
 *
 *   2. GA `_ga` cookie parsing (`deriveClientId`) — reuse the
 *      client-side client_id when present so server hits + client
 *      hits dedupe into one GA4 user.
 *
 *   3. Should-measure decision (`shouldSendMpHit`) — composes the
 *      env + UA + Accept + URL pathname filters into one pure
 *      boolean. Side-effect-free; the middleware just calls
 *      `context.waitUntil(...)` when this returns true.
 *
 * No I/O happens here. No `fetch`, no env reads (env values are passed
 * in by the caller), no `console.warn`.
 */

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

/** True iff the User-Agent string matches a known bot. */
export function isBotUserAgent(ua: string): boolean {
  return BOT_UA_RE.test(ua);
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
export const SUSPECT_PATH_PREFIX_RE =
  /^\/(?:wp-admin|wp-login|wp-content|wp-includes|wp-json|xmlrpc\.php|\.env|\.git|\.aws|\.docker|\.idea|\.vscode|\.svn|\.hg|\.htaccess|\.htpasswd|\.well-known\/security|phpmyadmin|administrator|adminer|drupal|joomla|laravel|node_modules|vendor|composer\.json|package(?:-lock)?\.json|yarn\.lock|backup|backups|dump|sql|web\.config|appsettings\.json|_profiler|server-status|server-info|owa|cgi-bin|setup\.php|install\.php|elmah\.axd|trace\.axd|fckeditor|ckeditor|tinymce|aws-secret|aws\.json|secrets\.json|config\.json|application\.properties|application\.yml|telescope|debug\/default\/view|actuator\/env|api\/v1\/namespaces)(?:\/|$|\?|\.)/i;

export const SUSPECT_EXT_RE =
  /\.(?:php|asp|aspx|jsp|cgi|bak|swp|swo|orig|sh|sql|db|sqlite|tar|gz|tgz|zip|7z|rar|backup|conf|ini|inc|log|key|pem|crt|p12|pfx)(?:\/|\?|$)/i;

/** True iff the pathname looks like a vulnerability scanner target. */
export function isSuspectPath(pathname: string): boolean {
  return SUSPECT_PATH_PREFIX_RE.test(pathname) || SUSPECT_EXT_RE.test(pathname);
}

/**
 * True when the browser has set `cookieConsent=rejected`. The consent
 * banner in `BaseLayout.astro` writes this cookie alongside its
 * localStorage entry so the Edge middleware (which cannot read
 * localStorage) can honour an explicit reject.
 *
 * Default policy (PR #5, 2026-05-23): consent is GRANTED when the
 * cookie is unset or `accepted` — `isConsentRejected` returns false
 * for both. Only an explicit `rejected` value suppresses the
 * server-side hit. This mirrors what gtag.js sees client-side.
 */
export function isConsentRejected(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)cookieConsent=rejected(?:\s*;|$)/.test(cookieHeader);
}

/**
 * Best-effort GA4 `client_id` derivation from a Cookie header.
 *
 * `_ga` cookie shape: `GA1.1.<randomId>.<creationTimestamp>` (10+ chars
 * each, separated by dots). The canonical client_id is
 * `<randomId>.<creationTimestamp>`. When the cookie is missing (first
 * visit, or browser blocked gtag.js entirely), fall back to a fresh
 * pseudo-id so the server-side hit still has a non-empty cid (GA4
 * requires it).
 *
 * The fallback shape mirrors what gtag.js would have generated client-
 * side: `<random>.<unix-ts>`. Not stable across visits without a
 * cookie, so server-only visitors look like new users each session —
 * acceptable since they're a tiny minority.
 *
 * The fallback uses `Date.now()` + `Math.random()` directly so callers
 * can monkey-patch those in tests. Pure inputs (cookie header)
 * produce a deterministic output via the regex match path.
 */
export function deriveClientId(cookieHeader: string | null): string {
  if (cookieHeader) {
    const match = cookieHeader.match(/_ga=GA1\.\d\.(\d+)\.(\d+)/);
    if (match) return `${match[1]}.${match[2]}`;
  }
  const ts = Math.floor(Date.now() / 1000);
  const rand = Math.floor(Math.random() * 1_000_000_000);
  return `${rand}.${ts}`;
}

/** Inputs that decide whether the middleware fires a server-side MP hit. */
export interface ShouldSendMpHitInput {
  /** `process.env.PUBLIC_GA4_MEASUREMENT_ID` */
  readonly measurementId: string | undefined;
  /** `process.env.GA4_MP_API_SECRET` */
  readonly apiSecret: string | undefined;
  /** `request.headers.get('user-agent')` */
  readonly userAgent: string;
  /** `request.headers.get('accept')` */
  readonly accept: string;
  /** `new URL(request.url).pathname` */
  readonly pathname: string;
  /** `request.headers.get('cookie')` — used to read `cookieConsent=rejected`. */
  readonly cookieHeader: string | null;
}

/**
 * Pure decision: should the middleware fire a server-side MP hit for
 * this request? Returns false (and the middleware should skip) when
 * ANY of these hold:
 *
 *   - GA4 env not configured (no measurementId or no apiSecret)
 *   - User explicitly rejected cookie consent (`cookieConsent=rejected`)
 *   - User-Agent is a known bot
 *   - Accept header doesn't include `text/html` (image / font / xhr)
 *   - Pathname is `/api/*` or `/_vercel/*` (defensive — the route
 *     matcher in `config.matcher` should already exclude these)
 *   - Pathname matches a known vulnerability-scanner target
 *     (`/wp-admin/...`, `/.env`, `/.git/config`, `.php`, etc.)
 */
export function shouldSendMpHit(input: ShouldSendMpHitInput): boolean {
  if (!input.measurementId || !input.apiSecret) return false;
  if (isConsentRejected(input.cookieHeader)) return false;
  if (isBotUserAgent(input.userAgent)) return false;
  if (!input.accept.includes('text/html')) return false;
  if (input.pathname.startsWith('/api/') || input.pathname.startsWith('/_vercel/')) return false;
  if (isSuspectPath(input.pathname)) return false;
  return true;
}

/** Inputs to the GA4 MP page_view payload. */
export interface MpPayloadInput {
  readonly clientId: string;
  readonly pageLocation: string;
  readonly pageReferrer: string;
  readonly clientIp: string;
  readonly userAgent: string;
  /** Defaults to `Date.now() * 1000` when omitted — overridable for tests. */
  readonly timestampMicros?: number;
}

/**
 * Build a GA4 Measurement Protocol page_view payload. The shape is
 * what `mp/collect` expects on the server side; see GA4 docs for the
 * full field list. Notable choices:
 *
 *   - `engagement_time_msec: 1` is REQUIRED for the event to count
 *     toward "engaged session". Without it, GA4 marks the session as
 *     a bounce. We use the smallest valid value (1 ms) so client-side
 *     enhanced-measurement events can add the actual engagement time
 *     when they fire.
 *   - `ssrc: 'mw'` marks the event as middleware-sourced so GA4
 *     Realtime can filter server vs. client hits (`ssrc=mw`).
 *   - `ip_override` + `user_agent` at the top level are documented
 *     pass-throughs for server-side hits — they ensure geo + device
 *     attribution match what a real client-side hit would record.
 */
export function buildMpPayload(input: MpPayloadInput): unknown {
  return {
    client_id: input.clientId,
    user_id: undefined,
    timestamp_micros: input.timestampMicros ?? Date.now() * 1000,
    user_properties: {},
    events: [
      {
        name: 'page_view',
        params: {
          page_location: input.pageLocation,
          page_referrer: input.pageReferrer,
          engagement_time_msec: 1,
          ssrc: 'mw',
        },
      },
    ],
    ip_override: input.clientIp,
    user_agent: input.userAgent,
  };
}
