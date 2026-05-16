// src/lib/api-security.js — shared request-validation helpers for the
// api/* Vercel Edge endpoints (api/feedback.js, api/subscribe.js).
//
// Lives under src/lib/ — not api/ — because Vercel auto-routes every file
// under api/ as a function endpoint, and we do NOT want this to be reachable
// over HTTP. JS-only (not TS) so Edge runtime imports work without a build
// step in case Vercel resolves before tsx-compile.
//
// Two concerns:
//   1. makeOriginGate(allowedOrigins) — rejects POSTs whose Origin and
//      Referer both fail the allow-list. CORS protects browsers; this
//      protects the endpoint from curl/server bots. Compares on parsed
//      `URL(...).origin` (NOT `startsWith`) so attackers can't bypass via
//      prefix matches like `https://mirai-shigoto.com.evil.com`.
//
//   2. readBodyText(req, capBytes) — stream-reads the request body with a
//      hard byte cap. Doesn't rely on the advisory `content-length` header
//      (which bots may omit or lie about). Aborts the read once the
//      cumulative count exceeds the cap and throws BodyTooLargeError.
//
// Pure functions — no module-level state.

/**
 * Parse a Referer header and return its origin (scheme://host[:port]) or
 * null if the header is missing/malformed.
 */
export function refererOrigin(referer) {
  if (!referer) return null;
  try { return new URL(referer).origin; } catch { return null; }
}

/**
 * Build a request gate. Returns a function `(req) => Response | null` that
 * returns a 403 Response when neither Origin nor Referer is in
 * `allowedOrigins`, else null.
 *
 * `allowedOrigins` must be a Set of fully-qualified origins, e.g.
 *   new Set(["https://mirai-shigoto.com", "http://localhost:8765"])
 */
export function makeOriginGate(allowedOrigins) {
  return function enforceOriginOr403(req) {
    const origin = req.headers.get("origin") || "";
    const refererHdr = req.headers.get("referer") || "";
    if (origin && allowedOrigins.has(origin)) return null;
    const refOrigin = refererOrigin(refererHdr);
    if (refOrigin && allowedOrigins.has(refOrigin)) return null;
    return new Response(JSON.stringify({ error: "forbidden_origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  };
}

export class BodyTooLargeError extends Error {
  constructor() {
    super("payload_too_large");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Stream-read the body of an Edge `Request` and return its UTF-8 text.
 * Aborts and throws BodyTooLargeError if the cumulative byte count exceeds
 * `capBytes`. Returns "" when `req.body` is null (e.g. an empty POST).
 */
export async function readBodyText(req, capBytes) {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > capBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
  return new TextDecoder("utf-8").decode(buf);
}

// ─── Client IP extraction ─────────────────────────────────────────────────
//
// Vercel Edge prepends `x-forwarded-for` with the real client IP as the
// FIRST hop (its own infrastructure adds the rest as it bounces inward).
// Per the Vercel Edge runtime docs: "the first IP in this list will always
// be the client's IP address". Same shape NGINX / Cloudflare / most CDNs
// produce. We never trust the value for anything except rate-limit keying
// — it is NOT a security boundary (clients can set `x-forwarded-for` if
// they bypass the CDN, but our endpoints only accept origins from the CORS
// allow-list anyway).
//
// Falls back to `"anonymous"` when the header is missing so the rate
// limiter still bucketizes (one shared bucket for all anon requests, which
// effectively rate-limits the API endpoint itself — strictly better than
// no limit at all when the IP is unknown).

/**
 * Extract the rate-limit key (client IP) from an Edge request.
 * Returns `"anonymous"` when `x-forwarded-for` is missing/malformed —
 * effectively rate-limits the endpoint as a whole rather than per-client,
 * which is safer than skipping the limiter entirely.
 */
export function clientIpFromRequest(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "anonymous";
  // First hop = original client per Vercel/most-CDN convention.
  const first = xff.split(",")[0]?.trim();
  return first || "anonymous";
}

// ─── Rate limiting (Upstash Redis REST API) ───────────────────────────────
//
// Sliding-window rate limiter using Upstash Redis REST. Picked Upstash over
// Vercel KV because:
//   - REST API works from Edge runtime (Vercel KV's SDK needs Node runtime
//     for some operations, and we want this to run on Edge).
//   - One ~50-line fetch keeps the dep footprint at zero new npm packages.
//   - Free tier covers our expected POST volume (< 100/hr) by ~1000x.
//
// Algorithm: INCR + EXPIRE on a fixed-window key `rl:<namespace>:<ip>:<bucket>`
// where `bucket = floor(now / windowSeconds)`. NOT a true sliding window
// — fixed windows have a worst-case 2× burst right at window boundaries,
// but that's acceptable for our use case (preventing form-spam, not
// gating monetary actions) and it's exactly 2 Redis commands per check.
//
// Degrades gracefully:
//   - Env vars `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
//     missing → returns `{ ok: true, skipped: true }`. Caller treats this
//     as "rate limit not configured, allow through". Honeypot + body cap
//     + origin gate still apply.
//   - Network error → returns `{ ok: true, skipped: true, error: ... }`.
//     We FAIL OPEN. Reason: a service outage at Upstash should NOT take
//     down our public form endpoints (better to risk one minute of
//     unrestricted POSTs than to break user-visible features). For
//     stricter posture set FAIL_CLOSED_ON_RATELIMIT_ERROR=1.

const FAIL_CLOSED_PATTERN = /^(1|true|yes)$/i;

/**
 * Check whether `ip` has exceeded `limit` requests in the past
 * `windowSeconds` for the given `namespace` (e.g. "feedback", "subscribe").
 *
 * Returns:
 *   { ok: true, skipped: true }                     env not configured / fail-open
 *   { ok: true,  count: N, limit, remaining: M }    under quota
 *   { ok: false, count: N, limit, retryAfterSec: S} over quota
 */
export async function rateLimitCheck({ ip, namespace, limit, windowSeconds, env }) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { ok: true, skipped: true };

  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${namespace}:${ip}:${bucket}`;
  // Pipeline both commands in one round-trip to halve the latency
  // contribution of this check (typical Tokyo→Upstash one-way ~20ms).
  const body = JSON.stringify([
    ["INCR", key],
    ["EXPIRE", key, windowSeconds],
  ]);
  let count = 0;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!res.ok) {
      if (FAIL_CLOSED_PATTERN.test(env.FAIL_CLOSED_ON_RATELIMIT_ERROR || "")) {
        return { ok: false, count: 0, limit, retryAfterSec: windowSeconds, error: `upstream_${res.status}` };
      }
      return { ok: true, skipped: true, error: `upstream_${res.status}` };
    }
    const data = await res.json();
    // Upstash pipeline returns [{ result }, { result }]. First command's
    // result is the post-increment count.
    const first = Array.isArray(data) ? data[0] : null;
    count = (first && typeof first.result === "number") ? first.result : 0;
  } catch (err) {
    if (FAIL_CLOSED_PATTERN.test(env.FAIL_CLOSED_ON_RATELIMIT_ERROR || "")) {
      return { ok: false, count: 0, limit, retryAfterSec: windowSeconds, error: String(err) };
    }
    return { ok: true, skipped: true, error: String(err) };
  }

  if (count > limit) {
    return { ok: false, count, limit, retryAfterSec: windowSeconds };
  }
  return { ok: true, count, limit, remaining: Math.max(0, limit - count) };
}

// ─── Cloudflare Turnstile verification ────────────────────────────────────
//
// CAPTCHA alternative — invisible by default, no user friction. The widget
// (added to the frontend form later, separately) emits a token via the
// `cf-turnstile-response` form field; this helper verifies the token
// server-side against Cloudflare's challenge API.
//
// Degrades gracefully:
//   - `TURNSTILE_SECRET_KEY` env missing → returns `{ ok: true, skipped: true }`
//     (treats as "not configured"). Other defenses still apply.
//   - Token missing in request body → returns `{ ok: false, reason: "missing_token" }`
//     ONLY when secret is configured. If secret is missing, missing token
//     is also skipped.
//   - Cloudflare verify endpoint unreachable / 5xx → fail-open identical
//     to rate-limit (set FAIL_CLOSED_ON_TURNSTILE_ERROR=1 to invert).

/**
 * Verify a Turnstile token. Pass `null`/`undefined` for `token` when the
 * client form didn't include one — this returns `{ ok: false, reason }`
 * when verification is REQUIRED (secret configured), or
 * `{ ok: true, skipped: true }` when verification is disabled (secret
 * missing) — preserving the historic behavior where form submits worked
 * without Turnstile at all.
 *
 * `remoteip` is optional; passing it tightens Cloudflare's heuristics.
 */
export async function verifyTurnstile({ token, env, remoteip = undefined }) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: "missing_token" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteip) form.set("remoteip", remoteip);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
      },
    );
    if (!res.ok) {
      if (FAIL_CLOSED_PATTERN.test(env.FAIL_CLOSED_ON_TURNSTILE_ERROR || "")) {
        return { ok: false, reason: `upstream_${res.status}` };
      }
      return { ok: true, skipped: true, reason: `upstream_${res.status}` };
    }
    const data = await res.json();
    // Cloudflare verify response: { success: bool, "error-codes": [...] }
    if (data && data.success === true) return { ok: true };
    return { ok: false, reason: "turnstile_failed", codes: data?.["error-codes"] || [] };
  } catch (err) {
    if (FAIL_CLOSED_PATTERN.test(env.FAIL_CLOSED_ON_TURNSTILE_ERROR || "")) {
      return { ok: false, reason: String(err) };
    }
    return { ok: true, skipped: true, reason: String(err) };
  }
}
