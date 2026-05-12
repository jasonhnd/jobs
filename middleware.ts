/**
 * middleware.ts — Vercel Edge Middleware for server-side GA4 measurement.
 *
 * Runs at the Edge BEFORE every HTML request is served, regardless of
 * Astro's static output. Fires a server-side `page_view` to GA4 via
 * Measurement Protocol so the data lands in GA4 *even when the client's
 * browser blocks gtag.js* (Chromium 137+ Tracking Protection, ad
 * blockers, Privacy Sandbox cookieless mode, etc.).
 *
 * Pipeline:
 *
 *   1. Matcher excludes static assets, API routes, and obvious bots.
 *   2. Read the GA `_ga` cookie (if any) to reuse the same client_id
 *      the browser-side gtag.js uses — server hits + client hits then
 *      deduplicate into the same GA4 user.
 *   3. Generate a fresh client_id if no _ga cookie (first visit).
 *   4. POST to https://www.google-analytics.com/mp/collect with the
 *      page_view event. The request is fire-and-forget via
 *      `context.waitUntil(...)` so it never blocks the user response.
 *   5. Forward client IP + UA so GA4 can geo-resolve correctly.
 *
 * Why this exists (2026-05-12 diagnosis):
 *   Client-side gtag.js stopped reliably firing `g/collect` for ~94%
 *   of real visits since ~2026-05-09. ga-audiences modeling pings
 *   continue, but the actual GA4 analytics hits get silently dropped
 *   somewhere between gtag.js's internal logic and the network. Cause
 *   is industry-wide browser-side tracking protection escalation;
 *   server-side MP fully bypasses it. The client-side gtag.js block in
 *   BaseLayout.astro is intentionally kept so users with working
 *   browsers still get cookie-based attribution + Enhanced Measurement
 *   events (scroll, click, etc.) — middleware only adds the page_view
 *   baseline that browser blocking ate.
 *
 * Required env (server-side only, NOT PUBLIC_*):
 *   - PUBLIC_GA4_MEASUREMENT_ID  — same env the client side already uses
 *   - GA4_MP_API_SECRET           — Measurement Protocol API secret.
 *     Generate at: GA4 → Admin → Data Streams → click stream →
 *     Measurement Protocol API secrets → Create. Add to Vercel
 *     Production env (mark as Sensitive).
 *
 * When env is missing, the middleware passes through silently — no
 * 5xx, no client-visible effect. Only the server-side measurement
 * is skipped.
 */
import { next, type RequestContext } from '@vercel/edge';

export const config = {
  // Match user-facing HTML routes. Skip:
  //   - /api/*               (API endpoints)
  //   - /_vercel/*           (Vercel internals)
  //   - /_astro/*            (Astro build assets)
  //   - /data.*              (JSON data projections)
  //   - Anything with a file extension (images, fonts, css, js, json, xml, txt)
  matcher: '/((?!api|_vercel|_astro|data\\.|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|mjs|json|xml|txt|woff2?|ttf|otf|map)$).*)',
};

// Conservative bot UA filter. Bots that don't execute JS don't send
// browser-side gtag.js hits anyway, so adding them server-side would
// inflate counts (bot traffic) that nobody wants in GA4.
const BOT_UA_RE =
  /\b(bot|crawler|spider|crawling|scrapy|curl|wget|httpie|postman|monitor|uptime|pingdom|datadog|newrelic|sentry|googlebot|bingbot|baiduspider|yandexbot|duckduckbot|applebot|petalbot|ahrefsbot|semrushbot|mj12bot|preview|prerender|chrome-lighthouse|headlesschrome|phantomjs|slimerjs|playwright|puppeteer|cypress)\b/i;

/**
 * Best-effort GA4 client_id derivation.
 *
 * `_ga` cookie shape: `GA1.1.<randomId>.<creationTimestamp>` (10+ chars
 * each, separated by dots). The canonical client_id is
 * `<randomId>.<creationTimestamp>`. When the cookie is missing (first
 * visit, or browser blocked gtag.js entirely), fall back to a fresh
 * pseudo-id so the server-side hit still has a non-empty cid (GA4
 * requires it).
 */
function deriveClientId(cookieHeader: string | null): string {
  if (cookieHeader) {
    const match = cookieHeader.match(/_ga=GA1\.\d\.(\d+)\.(\d+)/);
    if (match) return `${match[1]}.${match[2]}`;
  }
  // Pseudo-id: timestamp + 6-digit random. Format mirrors what gtag.js
  // would have generated client-side. Not stable across visits without
  // a cookie, so server-only visitors look like new users each session —
  // acceptable since they're a tiny minority.
  const ts = Math.floor(Date.now() / 1000);
  const rand = Math.floor(Math.random() * 1_000_000_000);
  return `${rand}.${ts}`;
}

export default function middleware(request: Request, context: RequestContext): Response {
  const measurementId = process.env.PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_MP_API_SECRET;

  // No env → no server-side tracking. Pass through silently.
  if (!measurementId || !apiSecret) {
    return next();
  }

  const ua = request.headers.get('user-agent') ?? '';
  // Bot filter — skip server-side measurement for known crawlers.
  if (BOT_UA_RE.test(ua)) {
    return next();
  }

  // HTML-accepting requests only. Browsers send `Accept: text/html,...`;
  // image / font / xhr requests don't. (The matcher above also excludes
  // file extensions, but Accept is a stricter second gate that catches
  // the home page `/` and other extensionless routes correctly.)
  const accept = request.headers.get('accept') ?? '';
  if (!accept.includes('text/html')) {
    return next();
  }

  const url = new URL(request.url);
  // Skip if the URL itself looks non-HTML (defensive — matcher should catch).
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/')) {
    return next();
  }

  const cookieHeader = request.headers.get('cookie');
  const clientId = deriveClientId(cookieHeader);
  const referer = request.headers.get('referer') ?? '';
  // Vercel sets x-forwarded-for; first IP is the client.
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const clientIp = forwardedFor.split(',')[0]?.trim() ?? '';

  const mpUrl =
    `https://www.google-analytics.com/mp/collect` +
    `?measurement_id=${encodeURIComponent(measurementId)}` +
    `&api_secret=${encodeURIComponent(apiSecret)}`;

  // GA4 MP payload. `ip_override` + `user_agent` ensure geo + device
  // attribution match what a real client-side hit would record. The
  // `engagement_time_msec` is required for the event to count toward
  // "engaged session" — without it, GA4 marks the session as bounce.
  const payload = {
    client_id: clientId,
    user_id: undefined, // Not tracking logged-in users on this site.
    timestamp_micros: Date.now() * 1000,
    user_properties: {},
    events: [
      {
        name: 'page_view',
        params: {
          page_location: url.href,
          page_referrer: referer,
          engagement_time_msec: 1, // Required; will be augmented if client also fires.
          // Mark these hits so they're distinguishable in GA4 from
          // client-side ones (debug filter "ssrc=mw" in Realtime).
          ssrc: 'mw',
        },
      },
    ],
    // Pass-throughs that GA4 accepts at top level for server-side hits:
    ip_override: clientIp,
    user_agent: ua,
  };

  // Fire and forget. `context.waitUntil` keeps the Edge runtime alive
  // long enough for the POST to complete in the background AFTER the
  // user already received their HTML — zero perceived latency.
  context.waitUntil(
    fetch(mpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // keepalive lets the request survive even if the Edge invocation
      // is torn down before fetch resolves (rare, but defensive).
      keepalive: true,
    })
      .then((res) => {
        // GA4 MP returns 204 on success. Any 4xx is configuration error
        // worth logging; 5xx is transient.
        if (res.status !== 204 && res.status !== 200) {
          // eslint-disable-next-line no-console
          console.warn(`[mp] non-2xx from GA4: ${res.status} ${res.statusText}`);
        }
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn(
          `[mp] send failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }),
  );

  return next();
}
