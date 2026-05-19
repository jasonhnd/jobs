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

import { fetchWithTimeout } from "./http-client.js";

// ─── Production detection ────────────────────────────────────────────────
//
// Vercel sets `VERCEL_ENV` to one of: `production`, `preview`, `development`.
// We treat ONLY `production` as fail-closed-by-default. Preview/dev keep
// the historic fail-open posture so local `astro dev` and preview deploys
// can run without Upstash/Turnstile wired up.

/**
 * True when the function is running on production (`pre.mirai-shigoto.com`
 * or the apex). Defaults to false in dev/preview/test so missing config
 * doesn't break local dev and preview deploys.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isProduction(env) {
  return env && env.VERCEL_ENV === "production";
}

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
 * Returns `"anonymous"` when no usable IP header is present —
 * effectively rate-limits the endpoint as a whole rather than per-client,
 * which is safer than skipping the limiter entirely.
 *
 * 2026-05-17 H15 fix: previously this trusted the FIRST hop of
 * X-Forwarded-For. That's the original-client convention behind a
 * single CDN, but if a request reaches our Edge function from a
 * source that already sets XFF (preview deploys, alternate-domain
 * proxy, or a misconfigured ingress), an attacker controls that
 * first hop and can spoof to rotate rate-limit keys.
 *
 * Vercel's Edge runtime exposes `x-real-ip` (set by Vercel's own
 * infrastructure, not client-supplied) and `x-vercel-forwarded-for`
 * (Vercel-signed). We prefer those. XFF is only consulted when
 * neither is present, and we take the LAST hop (the one closest
 * to our function = closest to a trustable infrastructure layer).
 */
export function clientIpFromRequest(req) {
  // Trustable sources first.
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim()) return xRealIp.trim();
  const xVercelXff = req.headers.get("x-vercel-forwarded-for");
  if (xVercelXff && xVercelXff.trim()) {
    // x-vercel-forwarded-for is a chain like x-forwarded-for but
    // controlled by Vercel — last hop is closest to us.
    const hops = xVercelXff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  // Fallback to raw XFF; take LAST hop (infrastructure-trusted,
  // not first-hop which is client-controllable).
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "anonymous";
  const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
  if (hops.length === 0) return "anonymous";
  return hops[hops.length - 1];
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
// Degrades gracefully in PREVIEW / DEV (`VERCEL_ENV !== 'production'`):
//   - Env vars `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
//     missing → returns `{ ok: true, skipped: true }`. Caller treats this
//     as "rate limit not configured, allow through". Honeypot + body cap
//     + origin gate still apply.
//   - Network error / 5xx → returns `{ ok: true, skipped: true, error: ... }`.
//     We FAIL OPEN. Reason: a service outage at Upstash should NOT take
//     down a developer's local dev or a preview deploy without Upstash.
//   - Setting `FAIL_CLOSED_ON_RATELIMIT_ERROR=1` flips network errors to
//     fail-closed (inverse of default).
//
// In PRODUCTION (`VERCEL_ENV === 'production'`) the polarity FLIPS:
//   - Env vars missing → `{ ok: false, reason: 'production_misconfigured' }`.
//     Misconfig MUST surface, not silently let traffic through. (CODE-005.)
//   - Network error / 5xx → FAIL CLOSED by default. The reasoning: a
//     production Upstash outage is rare; the downside of fail-open in
//     prod (an attacker timing requests during an outage) outweighs a
//     brief 5xx on user submits during a real upstream incident.
//   - Setting `FAIL_CLOSED_ON_RATELIMIT_ERROR=0` flips network errors
//     back to fail-open in prod (inverse of new default). The env var's
//     POLARITY is therefore opposite in prod vs dev: it overrides the
//     mode-appropriate default in either direction.

const FAIL_CLOSED_PATTERN = /^(1|true|yes)$/i;
const FAIL_OPEN_PATTERN = /^(0|false|no)$/i;

/**
 * Decide whether an upstream-error condition should fail closed.
 *
 * Default in PRODUCTION is fail-closed. Setting the env var to a
 * fail-open value (`0` / `false` / `no`) overrides back to open.
 *
 * Default in PREVIEW / DEV is fail-open. Setting the env var to a
 * fail-closed value (`1` / `true` / `yes`) overrides to closed.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} envVarName  e.g. "FAIL_CLOSED_ON_RATELIMIT_ERROR"
 * @returns {boolean} true → fail closed; false → fail open
 */
function shouldFailClosedOnError(env, envVarName) {
  const raw = env[envVarName] || "";
  if (isProduction(env)) {
    // Default closed; explicit `0`/`false`/`no` overrides to open.
    if (FAIL_OPEN_PATTERN.test(raw)) return false;
    return true;
  }
  // Dev / preview: default open; explicit `1`/`true`/`yes` overrides closed.
  return FAIL_CLOSED_PATTERN.test(raw);
}

/**
 * Check whether `ip` has exceeded `limit` requests in the past
 * `windowSeconds` for the given `namespace` (e.g. "feedback", "subscribe").
 *
 * Returns (in PREVIEW / DEV):
 *   { ok: true, skipped: true }                     env not configured / fail-open
 *   { ok: true,  count: N, limit, remaining: M }    under quota
 *   { ok: false, count: N, limit, retryAfterSec: S} over quota
 *
 * Returns (in PRODUCTION, `VERCEL_ENV === 'production'`):
 *   { ok: false, reason: 'production_misconfigured' }   env not configured
 *   { ok: true,  count: N, limit, remaining: M }        under quota
 *   { ok: false, count: N, limit, retryAfterSec: S }    over quota
 *   { ok: false, error: '...', retryAfterSec: S }       upstream 5xx / network err
 *
 * The fail-closed polarity of `FAIL_CLOSED_ON_RATELIMIT_ERROR` FLIPS
 * between prod and dev: see `shouldFailClosedOnError` JSDoc.
 *
 * Audit CODE-005: production must default to fail-closed.
 */
export async function rateLimitCheck({ ip, namespace, limit, windowSeconds, env }) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (isProduction(env)) {
      return {
        ok: false,
        reason: "production_misconfigured",
        count: 0,
        limit,
        retryAfterSec: windowSeconds,
      };
    }
    return { ok: true, skipped: true };
  }

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
    // Upstash should respond in <100ms typical. 2000ms is a generous
    // ceiling that catches stalled connections without exposing the
    // user-visible POST to long waits. (Audit CODE-007.)
    const res = await fetchWithTimeout(`${url}/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    }, 2000);
    if (!res.ok) {
      if (shouldFailClosedOnError(env, "FAIL_CLOSED_ON_RATELIMIT_ERROR")) {
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
    if (shouldFailClosedOnError(env, "FAIL_CLOSED_ON_RATELIMIT_ERROR")) {
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
// Degrades gracefully in PREVIEW / DEV (`VERCEL_ENV !== 'production'`):
//   - `TURNSTILE_SECRET_KEY` env missing → returns `{ ok: true, skipped: true }`
//     (treats as "not configured"). Other defenses still apply.
//   - Token missing in request body → returns `{ ok: false, reason: "missing_token" }`
//     ONLY when secret is configured. If secret is missing, missing token
//     is also skipped.
//   - Cloudflare verify endpoint unreachable / 5xx → fail-open. Set
//     `FAIL_CLOSED_ON_TURNSTILE_ERROR=1` to invert.
//
// In PRODUCTION (`VERCEL_ENV === 'production'`):
//   - `TURNSTILE_SECRET_KEY` env missing → `{ ok: false, reason:
//     'production_misconfigured' }`. Misconfig MUST surface. (CODE-005.)
//   - Cloudflare verify endpoint unreachable / 5xx → FAIL CLOSED by default.
//     Set `FAIL_CLOSED_ON_TURNSTILE_ERROR=0` to invert back to fail-open.
//
// The `FAIL_CLOSED_ON_TURNSTILE_ERROR` env var POLARITY flips between
// prod and dev — see `shouldFailClosedOnError` JSDoc above.

/**
 * Verify a Turnstile token. Pass `null`/`undefined` for `token` when the
 * client form didn't include one.
 *
 * In dev/preview, returns `{ ok: false, reason }` when verification is
 * REQUIRED (secret configured) or `{ ok: true, skipped: true }` when
 * verification is disabled (secret missing) — preserving historic
 * behavior where form submits worked without Turnstile at all.
 *
 * In production, missing secret returns
 * `{ ok: false, reason: 'production_misconfigured' }` so a missing
 * key SURFACES rather than silently allowing submits.
 *
 * `remoteip` is optional; passing it tightens Cloudflare's heuristics.
 *
 * Audit CODE-005: production must default to fail-closed.
 */
export async function verifyTurnstile({ token, env, remoteip = undefined }) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (isProduction(env)) {
      return { ok: false, reason: "production_misconfigured" };
    }
    return { ok: true, skipped: true };
  }
  if (!token) return { ok: false, reason: "missing_token" };

  // 2026-05-17 H16: replay-guard. Cloudflare tokens are one-shot —
  // Turnstile docs say "tokens are single-use only" but their server
  // sometimes returns success=true on the second verify before
  // their cache catches up; we treat that as our problem. When
  // Upstash is configured, SETNX a sha256(token) key with the
  // token's lifetime as TTL (Turnstile tokens expire after 300s),
  // and refuse if the key already existed.
  //
  // When Upstash isn't configured, fall through to the verify call
  // anyway — losing replay protection but not breaking the form.
  // This matches the rate-limit "degrade gracefully" posture.
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      // SHA-256 the token so we don't leak the raw value into Redis
      // logs (Turnstile tokens can be ~600 chars). Web Crypto is
      // available in Edge runtime.
      const enc = new TextEncoder().encode(token);
      const hashBuf = await crypto.subtle.digest("SHA-256", enc);
      const hex = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const key = `ts:${hex}`;
      const setRes = await fetchWithTimeout(`${env.UPSTASH_REDIS_REST_URL}/set/${key}/1`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ NX: true, EX: 300 }),
      }, 2000);
      if (setRes.ok) {
        const data = await setRes.json();
        // Upstash returns { result: "OK" } on first set, { result: null } if NX failed.
        if (data && data.result === null) {
          return { ok: false, reason: "turnstile_replay" };
        }
      } else {
        // On Upstash failure, log + continue to verify (don't break the form).
        console.warn('[api-security] Upstash replay-guard failed, falling open:', `upstream_${setRes.status}`);
      }
    } catch (err) {
      // Same — log + continue.
      console.warn('[api-security] Upstash replay-guard failed, falling open:', err && err.message ? err.message : err);
    }
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteip) form.set("remoteip", remoteip);

  try {
    // Cloudflare verify usually responds in <300ms. 3000ms cap is
    // generous but bounds user-visible delay on a stalled upstream.
    // (Audit CODE-007.)
    const res = await fetchWithTimeout(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
      },
      3000,
    );
    if (!res.ok) {
      if (shouldFailClosedOnError(env, "FAIL_CLOSED_ON_TURNSTILE_ERROR")) {
        return { ok: false, reason: `upstream_${res.status}` };
      }
      return { ok: true, skipped: true, reason: `upstream_${res.status}` };
    }
    const data = await res.json();
    // Cloudflare verify response: { success: bool, "error-codes": [...] }
    if (data && data.success === true) return { ok: true };
    // 2026-05-17 H16: explicitly reject Cloudflare's own replay signal.
    const codes = data?.["error-codes"] || [];
    if (codes.includes("timeout-or-duplicate")) {
      return { ok: false, reason: "turnstile_replay", codes };
    }
    return { ok: false, reason: "turnstile_failed", codes };
  } catch (err) {
    if (shouldFailClosedOnError(env, "FAIL_CLOSED_ON_TURNSTILE_ERROR")) {
      return { ok: false, reason: String(err) };
    }
    return { ok: true, skipped: true, reason: String(err) };
  }
}
