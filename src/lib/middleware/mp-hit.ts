import { classifyClientKind, isSuspectPath, type ClientKind } from './client-kind.js';
import { isConsentRejected } from './ga-identity.js';

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

