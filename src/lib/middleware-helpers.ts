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
 * Compatibility entry point: implementations live in `middleware/` modules.
 * Five concerns re-exported here:
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
 *      headers and never trusts the first raw X-Forwarded-For hop. Its
 *      implementation lives in `middleware/ga-identity.ts`.
 *
 * No I/O happens here. No `fetch`, no env reads (env values are passed
 * in by the caller), no `console.warn`.
 */

export * from './middleware/client-kind.js';
export * from './middleware/ga-identity.js';
export * from './middleware/mp-hit.js';
export * from './middleware/geo-referral.js';
