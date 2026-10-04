import type { ClientKind } from './client-kind.js';

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

