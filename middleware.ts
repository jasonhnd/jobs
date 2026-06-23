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
import {
  deriveClientId,
  shouldSendMpHit,
  buildMpPayload,
  classifyGeoReferral,
  attachPageViewParams,
} from './src/lib/middleware-helpers.js';
import { clientIpFromRequest } from './src/lib/api-security.js';
import { fetchWithTimeout } from './src/lib/http-client.js';

export const config = {
  // Match user-facing HTML routes. Skip:
  //   - /api/*               (API endpoints)
  //   - /_vercel/*           (Vercel internals)
  //   - /_astro/*            (Astro build assets)
  //   - /data.*              (JSON data projections)
  //   - Anything with a file extension (images, fonts, css, js, json, xml, txt)
  matcher: '/((?!api|_vercel|_astro|data\\.|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|mjs|json|xml|txt|woff2?|ttf|otf|map)$).*)',
};

// Pure helpers (BOT_UA_RE, deriveClientId, shouldSendMpHit,
// buildMpPayload, classifyGeoReferral) live in
// src/lib/middleware-helpers.ts so they're
// unit-testable without spinning up the Edge runtime. This file is the
// I/O wrapper: read headers + env → call helpers → POST via waitUntil.

export default function middleware(request: Request, context: RequestContext): Response {
  const measurementId = process.env.PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_MP_API_SECRET;

  const ua = request.headers.get('user-agent') ?? '';
  const accept = request.headers.get('accept') ?? '';
  const url = new URL(request.url);
  const cookieHeader = request.headers.get('cookie');

  if (!shouldSendMpHit({
    measurementId,
    apiSecret,
    userAgent: ua,
    accept,
    pathname: url.pathname,
    cookieHeader,
  })) {
    return next();
  }

  // Type-narrow: shouldSendMpHit guarantees these are defined on the
  // true branch, but TypeScript can't see across the function boundary.
  const mid = measurementId as string;
  const secret = apiSecret as string;

  const clientId = deriveClientId(cookieHeader);
  const referer = request.headers.get('referer') ?? '';
  // 2026-05-17 H15 hardening: use the shared XFF-spoof-safe helper
  // (x-real-ip > x-vercel-forwarded-for > XFF last-hop) instead of
  // the original first-hop XFF parse, which was spoofable by any
  // client setting their own X-Forwarded-For header. GA4's
  // ip_override field accepts a client IP for geolocation; safer
  // to feed it the infrastructure-trusted value.
  const clientIp = clientIpFromRequest(request) === 'anonymous'
    ? ''
    : clientIpFromRequest(request);

  // 2026-05-17 H17 hardening: GA4 Measurement Protocol REQUIRES
  // measurement_id + api_secret as query string params per Google's
  // API contract — they are not accepted in the body or headers.
  // The risk is log leakage, not API design. We mitigate by:
  //   1. NEVER logging `mpUrl` directly (only res.status / err.message
  //      below — verified line-by-line in the .then/.catch handlers).
  //   2. Marking the env as Sensitive in Vercel (operator action
  //      documented in .env.example).
  // If you add new logging here, REDACT or omit the URL.
  const mpUrl =
    `https://www.google-analytics.com/mp/collect` +
    `?measurement_id=${encodeURIComponent(mid)}` +
    `&api_secret=${encodeURIComponent(secret)}`;

  const payload = buildMpPayload({
    clientId,
    pageLocation: url.href,
    pageReferrer: referer,
    clientIp,
    userAgent: ua,
  });
  attachPageViewParams(payload, classifyGeoReferral(url, referer));

  // Fire and forget. `context.waitUntil` keeps the Edge runtime alive
  // long enough for the POST to complete in the background AFTER the
  // user already received their HTML — zero perceived latency.
  //
  // 2000ms timeout (Audit CODE-007). Even though the call is fire-
  // and-forget, an unbounded `waitUntil` could pin Edge resources on
  // a stalled GA4 endpoint; bound it explicitly.
  context.waitUntil(
    fetchWithTimeout(mpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // keepalive lets the request survive even if the Edge invocation
      // is torn down before fetch resolves (rare, but defensive).
      keepalive: true,
    }, 2000)
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
