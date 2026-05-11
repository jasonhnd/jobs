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
