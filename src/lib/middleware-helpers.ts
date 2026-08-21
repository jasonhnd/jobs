/**
 * src/lib/middleware-helpers.ts — pure helpers for `middleware.ts`
 * (Vercel Edge middleware that fires server-side GA4 `page_delivery`
 * hits via the Measurement Protocol).
 *
 * `page_delivery` is deliberately NOT `page_view`. The two are different
 * units — a page served vs a person viewing one — and GA4 turns whatever it
 * receives into a session, so sharing one name made every session-scoped
 * metric unreadable (#253). ANALYTICS.md §計測単位 is the contract; this file
 * and BaseLayout.astro are its two halves.
 *
 * Extracted from middleware.ts so the decision-making logic is unit-
 * testable without spinning up an Edge runtime context. The middleware
 * itself is the I/O wrapper: read headers + env → call these pure
 * helpers → POST to GA4 via `context.waitUntil`.
 *
 * Five concerns covered here:
 *
 *   1. Client classification (`BOT_UA_RE`, `AI_AGENT_UA_PATTERNS`,
 *      `classifyClientKind`) — browser / ai_agent / other_bot. Only
 *      `other_bot` is refused measurement; AI agents are measured on
 *      purpose and labelled with `agent_name`.
 *
 *   2. Delivery identity (`parseGaClientId`, `deliveryIdentity`) —
 *      reuse the client-side client_id when `_ga` exists so the
 *      delivery joins the visitor's real session, and fall back to a
 *      deterministic per-day bucket (never a per-request id) when it
 *      does not.
 *
 *   3. Should-measure decision (`shouldSendMpHit`) — composes the
 *      env + UA + Accept + URL pathname filters into one pure
 *      boolean. Side-effect-free; the middleware just calls
 *      `context.waitUntil(...)` when this returns true.
 *
 *   4. GEO referral classification (`classifyGeoReferral`) — tags
 *      `page_delivery` events with the search / AI referral baseline
 *      fields used by downstream citation analysis.
 *
 *   5. Client-IP extraction (`clientIpFromRequest`) — prefers Vercel-set
 *      headers and never trusts the first raw X-Forwarded-For hop.
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

/** True iff the User-Agent string matches a known bot, AI agents included. */
export function isBotUserAgent(ua: string): boolean {
  return BOT_UA_RE.test(ua);
}

/**
 * Social unfurlers that fetch OG tags for a timeline card.
 * Narrower than `isBotUserAgent` so Googlebot still sees the canonical `/me`.
 */
export const SHARE_UNFURLER_UA_RE =
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
export const NO_AGENT = '(none)';

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
 * The GA4 `client_id` gtag.js is already using for this browser, or null.
 *
 * `_ga` cookie shape: `GA1.1.<randomId>.<creationTimestamp>`; the canonical
 * client_id is `<randomId>.<creationTimestamp>`. When it is present the
 * server-side delivery joins the visitor's real session instead of opening a
 * parallel one.
 */
export function parseGaClientId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/_ga=GA1\.\d\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}` : null;
}

/** Bucket window for deliveries that cannot join a real session: one day. */
export const DELIVERY_BUCKET_WINDOW_SECONDS = 86_400;

export interface DeliveryIdentityInput {
  readonly cookieHeader: string | null;
  /** `process.env.PUBLIC_GA4_MEASUREMENT_ID` — names the `_ga_<id>` session cookie. */
  readonly measurementId: string;
  readonly clientKind: ClientKind;
  readonly agentName: string;
  /** `geo_referrer_bucket` — keeps unjoinable browser deliveries separable by source. */
  readonly referrerBucket: string;
  readonly nowSeconds?: number;
}

export interface DeliveryIdentity {
  readonly clientId: string;
  readonly sessionId: string;
  /** True when the delivery joined a real gtag.js identity rather than a bucket. */
  readonly joined: boolean;
}

/**
 * Identity for a server-side `page_delivery`.
 *
 * Two cases, and the distinction is the whole point:
 *
 *   1. `_ga` present — the visitor's gtag.js identity. The delivery lands in
 *      their real session, contributing an event and no new session.
 *
 *   2. No `_ga` — gtag.js is blocked (~44% of deliveries). There is no real
 *      identity to join, so DO NOT INVENT ONE PER REQUEST. The delivery gets a
 *      deterministic bucket id keyed on (client kind × referrer bucket × day),
 *      or (agent × day) for AI agents. `eventCount` stays exact; sessions
 *      collapse from one-per-request to a handful per day.
 *
 * The previous implementation hashed IP + User-Agent + Accept-Language here.
 * That produced ~1,100 single-event sessions a day — 88% of everything GA4
 * reported — which buried the real population and let a 74% collapse in paid
 * traffic read as growth on the dashboard (#253). It was not a usable person
 * count either: its own comment conceded that JP carrier-grade NAT and office
 * egress collapse many visitors into one id.
 *
 * No cookie is set for any of this. Writing our own identifier would
 * re-identify a visitor who has explicitly blocked tracking, and would put
 * `Set-Cookie` on responses that are otherwise statically cached.
 */
export function deliveryIdentity(input: DeliveryIdentityInput): DeliveryIdentity {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (input.clientKind === 'browser') {
    const fromGtag = parseGaClientId(input.cookieHeader);
    if (fromGtag) {
      return {
        clientId: fromGtag,
        sessionId: deriveSessionId(input.cookieHeader, input.measurementId, fromGtag, now),
        joined: true,
      };
    }
  }

  const day = Math.floor(now / DELIVERY_BUCKET_WINDOW_SECONDS);
  const dayStart = day * DELIVERY_BUCKET_WINDOW_SECONDS;
  const bucketKey = input.clientKind === 'ai_agent'
    ? `ai_agent:${input.agentName}`
    : `browser:${input.referrerBucket}`;
  return {
    // Keep gtag's `<id>.<ts>` shape so the value is not visibly foreign in GA4.
    clientId: `${stableHash(`${bucketKey}|${day}`)}.${dayStart}`,
    sessionId: String(dayStart),
    joined: false,
  };
}

/**
 * FNV-1a, 32-bit. The Edge runtime only exposes async `crypto.subtle`, and this
 * value never guards anything — it just has to spread evenly and be identical
 * for identical inputs.
 */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** GA4 writes its session state to `_ga_<measurement id without the G- prefix>`. */
export function ga4SessionCookieName(measurementId: string): string {
  return `_ga_${measurementId.replace(/^G-/, '')}`;
}

/**
 * Session id gtag.js is already using for this browser, or null.
 *
 * Two encodings are live in the wild and both must be handled, or the browsers
 * on the newer one silently fall through to the synthetic window below and open
 * a second, parallel session alongside gtag's:
 *
 *   GS1.1.<sessionId>.<n>.<engaged>.<lastHit>…      dot-separated
 *   GS2.1.s<sessionId>$o<n>$g<engaged>$t<lastHit>…  `$`-separated, `s`-prefixed
 *
 * The session id is unix seconds in both.
 */
export function parseGa4SessionId(cookieHeader: string | null, measurementId: string): string | null {
  if (!cookieHeader || !measurementId) return null;
  const name = ga4SessionCookieName(measurementId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=GS\\d\\.\\d\\.s?(\\d+)`));
  return match ? match[1]! : null;
}

/** 30 minutes, matching GA4's default session timeout. */
export const SESSION_WINDOW_SECONDS = 1800;

/**
 * Session id for the Measurement Protocol hit.
 *
 * Without one, GA4 attaches the event to no session at all — which is why the
 * server-side stream showed 48,746 users against 15 sessions. Reusing gtag's id
 * when it exists keeps server and client hits inside a single session instead
 * of creating a parallel one.
 */
export function deriveSessionId(
  cookieHeader: string | null,
  measurementId: string,
  clientId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const fromGtag = parseGa4SessionId(cookieHeader, measurementId);
  if (fromGtag) return fromGtag;
  // No gtag session to join: bucket to a fixed window so consecutive page views
  // from the same visitor land in one session rather than one session each.
  const bucket = Math.floor(nowSeconds / SESSION_WINDOW_SECONDS) * SESSION_WINDOW_SECONDS;
  return String(bucket + (stableHash(clientId) % SESSION_WINDOW_SECONDS));
}

/**
 * Extract the best available client IP for GA4 geolocation.
 *
 * Vercel-controlled headers take priority. Raw X-Forwarded-For is only a
 * fallback, and its last hop is used so a client-supplied first hop cannot
 * spoof the value. `anonymous` keeps the missing-value contract explicit;
 * middleware.ts converts it to an empty GA4 `ip_override`.
 */
export function clientIpFromRequest(req: Pick<Request, 'headers'>): string {
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp?.trim()) return xRealIp.trim();

  const xVercelXff = req.headers.get('x-vercel-forwarded-for');
  if (xVercelXff?.trim()) {
    const hops = xVercelXff.split(',').map((hop) => hop.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }

  const xff = req.headers.get('x-forwarded-for');
  if (!xff) return 'anonymous';
  const hops = xff.split(',').map((hop) => hop.trim()).filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1]! : 'anonymous';
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
 *   - User-Agent is a bot that is NOT a named AI agent — scanners, SEO
 *     crawlers, monitoring probes, headless test runners, social unfurlers.
 *     AI agents are measured on purpose; see `AI_AGENT_UA_PATTERNS`. Dropping
 *     them here is what left "which engine fetched what" unmeasured for three
 *     months (#253).
 *   - Accept header doesn't include `text/html` (image / font / xhr)
 *   - Pathname is `/api/*` or `/_vercel/*` (defensive — the route
 *     matcher in `config.matcher` should already exclude these)
 *   - Pathname matches a known vulnerability-scanner target
 *     (`/wp-admin/...`, `/.env`, `/.git/config`, `.php`, etc.)
 */
export function shouldSendMpHit(input: ShouldSendMpHitInput): boolean {
  if (!input.measurementId || !input.apiSecret) return false;
  if (isConsentRejected(input.cookieHeader)) return false;
  if (classifyClientKind(input.userAgent).kind === 'other_bot') return false;
  if (!input.accept.includes('text/html')) return false;
  if (input.pathname.startsWith('/api/') || input.pathname.startsWith('/_vercel/')) return false;
  if (isSuspectPath(input.pathname)) return false;
  return true;
}

/**
 * The event name the middleware sends. NOT `page_view`.
 *
 * `page_view` means "a person viewed a page" and is emitted client-side only.
 * `page_delivery` means "we served a page" and is emitted here only. GA4 counts
 * anything it receives as a session, so one name for both units made sessions,
 * users and engagement rate unreadable for the 18 days it was live (#253).
 * See ANALYTICS.md §計測単位 — that section is the contract, this is one half
 * of its implementation.
 */
export const DELIVERY_EVENT_NAME = 'page_delivery';

/** Inputs to the GA4 MP `page_delivery` payload. */
export interface MpPayloadInput {
  readonly clientId: string;
  readonly pageLocation: string;
  readonly pageReferrer: string;
  readonly clientIp: string;
  readonly userAgent: string;
  /** GA4 attaches the event to no session without this. See deriveSessionId. */
  readonly sessionId: string;
  /** `browser` or `ai_agent`; `other_bot` never reaches this point. */
  readonly clientKind: ClientKind;
  /** Canonical AI agent id, or `(none)`. */
  readonly agentName: string;
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
        name: DELIVERY_EVENT_NAME,
        params: {
          page_location: input.pageLocation,
          page_referrer: input.pageReferrer,
          // Both are required for the hit to count toward a session. Omitting
          // session_id was why the server stream reported users with no
          // sessions at all.
          session_id: input.sessionId,
          engagement_time_msec: 1,
          ssrc: 'mw',
          client_kind: input.clientKind,
          agent_name: input.agentName,
        },
      },
    ],
    ip_override: input.clientIp,
    user_agent: input.userAgent,
  };
}

export interface GeoReferralParams {
  readonly geo_referrer_engine: string;
  readonly geo_referrer_bucket: string;
  readonly geo_referrer_host: string;
  readonly geo_landing_family: string;
  readonly geo_citation_candidate: string;
}

export function landingFamily(pathname: string): string {
  if (/^\/\d{1,3}$/.test(pathname)) return 'occupation';
  if (pathname === '/answers' || pathname.startsWith('/answers/')) return 'answers';
  if (pathname === '/q' || pathname.startsWith('/q/')) return 'qa';
  if (pathname === '/sectors' || pathname.startsWith('/sectors/')) return 'sector';
  if (pathname === '/rankings' || pathname.startsWith('/rankings/')) return 'ranking';
  if (pathname === '/compare' || pathname.startsWith('/compare/')) return 'compare';
  if (pathname === '/standard') return 'standard';
  if (pathname === '/methodology') return 'methodology';
  if (pathname === '/map') return 'map';
  return 'other';
}

export function isGoogleHost(host: string): boolean {
  return /^google\.[a-z.]+$/.test(host);
}

export function classifyGeoReferral(pageUrl: URL, referer: string): GeoReferralParams {
  const refUrl = referer ? (() => {
    try {
      return new URL(referer);
    } catch {
      return null;
    }
  })() : null;

  const refHost = refUrl?.hostname.toLowerCase().replace(/^www\./, '') ?? '';
  const family = landingFamily(pageUrl.pathname);
  const citableLanding = ['answers', 'qa', 'sector', 'ranking', 'compare', 'standard', 'methodology'].includes(family);

  let engine = 'direct';
  let bucket = 'direct';

  if (refHost) {
    const sameSite = refHost === pageUrl.hostname.toLowerCase().replace(/^www\./, '')
      || refHost.endsWith('.mirai-shigoto.com');

    if (sameSite) {
      engine = 'internal';
      bucket = 'internal';
    } else if (refHost === 'perplexity.ai') {
      engine = 'perplexity';
      bucket = 'ai_engine';
    } else if (refHost === 'chatgpt.com' || refHost === 'chat.openai.com') {
      engine = 'chatgpt_search';
      bucket = 'ai_engine';
    } else if (refHost === 'gemini.google.com' || refHost === 'bard.google.com') {
      engine = 'gemini';
      bucket = 'ai_engine';
    } else if (refHost === 'copilot.microsoft.com' || (refHost === 'bing.com' && refUrl?.pathname.startsWith('/chat'))) {
      engine = 'bing_copilot';
      bucket = 'ai_engine';
    } else if (refHost === 'claude.ai') {
      engine = 'claude';
      bucket = 'ai_engine';
    } else if (refHost === 'you.com' || refHost === 'phind.com' || refHost === 'komo.ai' || refHost === 'andisearch.com') {
      engine = refHost.replace(/\./g, '_');
      bucket = 'ai_engine';
    } else if (isGoogleHost(refHost)) {
      engine = 'google_search';
      bucket = 'search';
    } else if (refHost === 'bing.com' || refHost.endsWith('.bing.com')) {
      engine = 'bing_search';
      bucket = 'search';
    } else {
      engine = 'other_external';
      bucket = 'external';
    }
  }

  const citationCandidate = bucket === 'ai_engine' || (bucket === 'search' && citableLanding);

  return {
    geo_referrer_engine: engine,
    geo_referrer_bucket: bucket,
    geo_referrer_host: refHost || '(direct)',
    geo_landing_family: family,
    geo_citation_candidate: citationCandidate ? 'true' : 'false',
  };
}

export function attachDeliveryParams(payload: unknown, params: GeoReferralParams): void {
  if (!payload || typeof payload !== 'object') return;
  const events = (payload as { events?: Array<{ params?: Record<string, unknown> }> }).events;
  const delivery = events?.[0];
  if (!delivery?.params) return;
  delivery.params = { ...delivery.params, ...params };
}
